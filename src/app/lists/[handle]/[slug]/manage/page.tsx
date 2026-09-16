import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { EyeOffIcon } from "@/components/ui";
import { formatPrice } from "@/config/site";
import { db } from "@/db";
import { items, type Item, type List } from "@/db/schema";
import { formatEventDate, relativeEvent } from "@/lib/date";
import { requireOwnedList } from "@/lib/list-access";
import * as routes from "@/lib/routes";

export async function generateMetadata({
  params,
}: PageProps<"/lists/[handle]/[slug]/manage">) {
  const { handle, slug } = await params;
  const { list } = await requireOwnedList(handle, slug);
  return { title: list.name };
}

/**
 * The owner's editor. By design it shows a claim *count* only, never which
 * gifts are claimed — see getPublicList for where that is enforced.
 */
export default async function EditorPage({
  params,
}: PageProps<"/lists/[handle]/[slug]/manage">) {
  const { handle, slug } = await params;
  const { list, ownerHandle } = await requireOwnedList(handle, slug);

  const gifts = await db
    .select()
    .from(items)
    .where(eq(items.listId, list.id))
    .orderBy(asc(items.position))
    .all();

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const short = routes.shortLink(list);
  const shareUrl = `${protocol}://${host}${short ?? routes.publicList(list, ownerHandle)}`;

  const eventLine = [formatEventDate(list.eventDate), relativeEvent(list.eventDate)]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-[1000px] px-[22px] py-8 sm:px-8">
      <header className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          {eventLine ? (
            <p className="mb-[9px] text-2xs font-semibold uppercase tracking-[1.6px] text-ink-62">
              {eventLine}
            </p>
          ) : null}
          <h1 className="mb-[9px] font-display text-[2.5rem] leading-[1.05] tracking-[-1.2px]">
            <span className="mr-3">{list.emoji}</span>
            {list.name}
          </h1>
          <p className="text-sm font-medium text-ink-72">
            {gifts.length === 0
              ? "No gifts yet"
              : `${gifts.length} ${gifts.length === 1 ? "gift" : "gifts"}`}
            <span className="px-2 opacity-40">·</span>
            {ownerHandle ? "Saved to your account" : "Draft — not saved to an account"}
          </p>
        </div>
        <div className="flex flex-wrap gap-[10px]">
          <Link
            href={routes.publicList(list, ownerHandle)}
            className="rounded-pill border border-ink-line-strong bg-surface px-[18px] py-[11px] text-sm font-semibold"
          >
            Preview as guest
          </Link>
          <Link
            href={routes.addGift(list, ownerHandle)}
            className="rounded-pill bg-violet px-5 py-[11px] text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
          >
            + Add gift
          </Link>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-ink-line bg-surface px-4 py-3">
        <span className="flex-1 truncate font-mono text-sm font-medium text-ink/82">
          {shareUrl.replace(/^https?:\/\//, "")}
        </span>
        <CopyButton value={shareUrl} label="Copy link" />
        <Link
          href={routes.shareList(list, ownerHandle)}
          className="rounded-pill border border-ink-line-strong px-[15px] py-2 text-xs font-semibold"
        >
          QR code
        </Link>
      </div>

      <div className="mb-[22px] flex items-center gap-3 rounded-[12px] border border-violet-edge bg-violet-wash px-4 py-[13px]">
        <EyeOffIcon className="shrink-0 text-violet" />
        <p className="text-xs leading-[1.55] text-ink/80">
          <strong className="font-semibold">You&rsquo;ll only ever see a count.</strong>{" "}
          Guests see live status; which gifts are claimed stays hidden from you.
        </p>
      </div>

      {gifts.length === 0 ? (
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
        <ul className="flex flex-col gap-2">
          {gifts.map((gift) => (
            <GiftRow
              key={gift.id}
              gift={gift}
              list={list}
              ownerHandle={ownerHandle}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function GiftRow({
  gift,
  list,
  ownerHandle,
}: {
  gift: Item;
  list: List;
  ownerHandle: string | null;
}) {
  const image = gift.images[gift.selectedImageIndex] ?? gift.images[0] ?? null;
  const needsPhoto = gift.needsAttention === "no-photo";

  return (
    <li
      className={`flex items-center gap-[15px] rounded-[12px] border px-[15px] py-3 ${
        needsPhoto ? "border-amber/30 bg-amber-wash" : "border-ink-line bg-surface"
      }`}
    >
      <div className="h-[52px] w-11 shrink-0 overflow-hidden rounded-[7px] bg-ink/[.05]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-center text-2xs leading-tight text-ink-62">
            No
            <br />
            photo
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{gift.title}</span>
          {gift.isMostWanted ? <Badge tone="violet">Most wanted</Badge> : null}
          {gift.isGroupGift ? <Badge tone="rose">Group gift</Badge> : null}
          {gift.quantity > 1 ? <Badge tone="neutral">Qty {gift.quantity}</Badge> : null}
        </div>
        <p
          className={`text-xs ${needsPhoto ? "font-medium text-amber-dark" : "text-ink-72"}`}
        >
          {needsPhoto
            ? "No photo found — items with a photo get claimed far more often"
            : [gift.sourceDomain ?? "Added by hand · no link", `qty ${gift.quantity}`].join(
                " · ",
              )}
        </p>
      </div>

      <span className="text-base font-semibold">
        {gift.priceCents === null ? "—" : formatPrice(gift.priceCents)}
      </span>

      <Link
        href={routes.editGift(list, ownerHandle, gift.id)}
        className="rounded-control border border-ink-line px-3 py-[6px] text-xs font-semibold text-ink-72 transition-colors duration-150 hover:bg-ink/[.03]"
      >
        Edit
      </Link>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "violet" | "rose" | "neutral";
  children: React.ReactNode;
}) {
  const tones = {
    violet: "bg-violet/10 text-violet-hover",
    rose: "bg-rose/10 text-rose-dark",
    neutral: "bg-ink/[.07] text-ink-72",
  } as const;

  return (
    <span
      className={`rounded-pill px-2 py-[2px] text-2xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
