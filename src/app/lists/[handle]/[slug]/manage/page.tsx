import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import QRCode from "qrcode";

import { GiftRows, type EditorRow } from "@/components/gift-rows";
import { ListSettings } from "@/components/list-settings";
import { ShareDialog } from "@/components/share-dialog";
import { SharePanel } from "@/components/share-panel";
import { ButtonLink } from "@/components/ui";
import { formatPrice } from "@/config/site";
import { db } from "@/db";
import { items } from "@/db/schema";
import { getOwnerItemStatus, getOwnerStats } from "@/lib/claims";
import { fundingForList } from "@/lib/contributions";
import {
  formatEventDate,
  formatShortDate,
  relativeEvent,
  toDateInput,
} from "@/lib/date";
import { requireOwnedList } from "@/lib/list-access";
import { displayHost, origin } from "@/lib/origin";
import * as routes from "@/lib/routes";

export async function generateMetadata({
  params,
}: PageProps<"/lists/[handle]/[slug]/manage">) {
  const { handle, slug } = await params;
  const { list } = await requireOwnedList(handle, slug);
  return { title: list.name };
}

/**
 * The owner's editor.
 *
 * On a surprise list it shows claim *counts* only, never which gifts are
 * claimed; on a list where the owner has turned surprise off, each row carries
 * its status so they can see what's left to cover. Both are enforced in the
 * data layer; see getPublicList and getOwnerItemStatus.
 */
export default async function EditorPage({
  params,
}: PageProps<"/lists/[handle]/[slug]/manage">) {
  const { handle, slug } = await params;
  const { list, ownerHandle } = await requireOwnedList(handle, slug);

  const [gifts, stats, funding, status] = await Promise.all([
    db
      .select()
      .from(items)
      .where(eq(items.listId, list.id))
      .orderBy(asc(items.position))
      .all(),
    getOwnerStats(list),
    fundingForList(list.id),
    getOwnerItemStatus(list),
  ]);

  const short = routes.shortLink(list);
  const shareUrl = `${origin}${short ?? routes.publicList(list, ownerHandle)}`;
  const canonical = `${displayHost}${routes.publicList(list, ownerHandle)}`;
  const qrSvg = await QRCode.toString(shareUrl, {
    type: "svg",
    margin: 0,
    color: { dark: "#17112B", light: "#FFFFFF00" },
  });

  const rows: EditorRow[] = gifts.map((gift) => ({
    id: gift.id,
    kind: gift.kind,
    title: gift.title,
    image: gift.images[gift.selectedImageIndex] ?? gift.images[0] ?? null,
    emoji: gift.emoji,
    sourceDomain: gift.sourceDomain,
    priceCents: gift.priceCents,
    quantity: gift.quantity,
    isMostWanted: gift.isMostWanted,
    isGroupGift: gift.isGroupGift,
    goalCents: gift.goalCents,
    raisedCents: funding.find((f) => f.itemId === gift.id)?.raisedCents ?? 0,
    contributorCount: funding.find((f) => f.itemId === gift.id)?.contributorCount ?? 0,
    needsAttention: gift.needsAttention,
    // Null on a surprise list: the row is not allowed to know.
    claimedCount: status?.get(gift.id)?.claimedCount ?? (status ? 0 : null),
    boughtCount: status?.get(gift.id)?.boughtCount ?? (status ? 0 : null),
    editHref: routes.editGift(list, ownerHandle, gift.id),
  }));

  const eventLine = [formatEventDate(list.eventDate), relativeEvent(list.eventDate)]
    .filter(Boolean)
    .join(" · ");

  const prices = gifts
    .map((gift) => gift.priceCents)
    .filter((price): price is number => price !== null);

  // Ideas are counted apart from presents here for the same reason they are on
  // the public list: they are not things anyone is buying.
  const ideaCount = gifts.filter((gift) => gift.kind === "idea").length;
  const giftCount = gifts.length - ideaCount;

  const meta = [
    giftCount === 0 && ideaCount === 0
      ? "No gifts yet"
      : giftCount === 0
        ? null
        : `${giftCount} ${giftCount === 1 ? "gift" : "gifts"}`,
    ideaCount === 0 ? null : `${ideaCount} ${ideaCount === 1 ? "idea" : "ideas"}`,
    prices.length
      ? `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}`
      : null,
    ownerHandle ? null : "Draft, not saved to an account",
  ].filter(Boolean);

  const hasGroupGift = gifts.some((gift) => gift.isGroupGift);

  const claimedLabel = list.surpriseMode
    ? stats.claimedCount === 1
      ? "gift claimed, which one is hidden"
      : "gifts claimed, which ones is hidden"
    : stats.boughtCount > 0
      ? `${stats.claimedCount === 1 ? "gift claimed" : "gifts claimed"} · ${stats.boughtCount} bought`
      : stats.claimedCount === 1
        ? "gift claimed"
        : "gifts claimed";

  return (
    <main className="mx-auto w-full max-w-[1000px] px-[22px] py-8 sm:px-8">
      {/* Identity on the left, the three things you do with a list on the
          right: look at it as a guest, hand it out, add to it. Editing what
          the list *is* hangs off the title, because that's what it changes. */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eventLine ? (
            <p className="mb-[9px] text-2xs font-semibold uppercase tracking-[1.6px] text-ink-62">
              {eventLine}
            </p>
          ) : null}
          <div className="mb-[9px] flex items-center gap-[10px]">
            <h1 className="font-display text-[2.5rem] leading-[1.05] tracking-[-1.2px]">
              <span className="mr-3">{list.emoji}</span>
              {list.name}
            </h1>
            <ListSettings
              handle={handle}
              listKey={slug}
              details={{
                name: list.name,
                emoji: list.emoji,
                eventDate: toDateInput(list.eventDate),
                note: list.note ?? "",
                claimRule: list.claimRule,
                surpriseMode: list.surpriseMode,
                deliveryAddress: list.deliveryAddress ?? "",
                paymentDetails: list.paymentDetails ?? "",
              }}
            />
          </div>
          <p className="text-sm font-medium text-ink-72">
            {meta.join(" · ")}
            {list.sharedAt ? (
              <span className="text-pine-dark">
                <span className="px-2 opacity-40">·</span>
                <span aria-hidden="true">● </span>
                Live since {formatShortDate(list.sharedAt)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[10px]">
          <ButtonLink href={routes.publicList(list, ownerHandle)} variant="outline">
            Preview
          </ButtonLink>
          <ShareDialog>
            <SharePanel shareUrl={shareUrl} canonical={canonical} qrSvg={qrSvg} />
          </ShareDialog>
          <ButtonLink href={routes.addGift(list, ownerHandle)}>+ Add gift</ButtonLink>
        </div>
      </header>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          figure={String(stats.linkOpens)}
          label={
            stats.linkOpens === 1
              ? "person opened your link"
              : "people opened your link"
          }
        />
        <Stat figure={String(stats.claimedCount)} label={claimedLabel} tone="pine" />
        {hasGroupGift ? (
          <Stat
            figure={formatPrice(stats.raisedCents)}
            label="chipped in toward group gifts"
            tone="rose"
          />
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Link
          href={routes.addGift(list, ownerHandle)}
          className="block rounded-[12px] border border-dashed border-ink-line-strong px-6 py-12 text-center transition-colors duration-150 hover:bg-ink/[.02]"
        >
          <span className="mb-2 block text-base font-semibold">
            Nothing on the list yet
          </span>
          <span className="block text-sm leading-[1.7] text-ink-72">
            Paste a link from any shop and we&rsquo;ll fill in the rest.
          </span>
        </Link>
      ) : (
        <GiftRows rows={rows} handle={handle} listKey={slug} />
      )}
    </main>
  );
}

/** One owner-visible number. Figures are display type; the label carries the caveat. */
function Stat({
  figure,
  label,
  tone,
}: {
  figure: string;
  label: string;
  tone?: "pine" | "rose";
}) {
  const tones = {
    pine: "text-pine-dark",
    rose: "text-rose-dark",
  } as const;

  return (
    <div className="rounded-[12px] border border-ink-line bg-surface px-4 py-[14px]">
      <p className={`font-display text-[1.875rem] leading-none ${tone ? tones[tone] : ""}`}>
        {figure}
      </p>
      <p className="mt-[7px] text-xs leading-[1.45] text-ink-62">{label}</p>
    </div>
  );
}
