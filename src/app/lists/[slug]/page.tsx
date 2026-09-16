import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { EyeOffIcon } from "@/components/ui";
import { formatPrice } from "@/config/site";
import { db } from "@/db";
import { items, type Item } from "@/db/schema";
import { formatEventDate, relativeEvent } from "@/lib/date";
import { requireOwnedList } from "@/lib/list-access";

export async function generateMetadata({ params }: PageProps<"/lists/[slug]">) {
  const { slug } = await params;
  const list = await requireOwnedList(slug);
  return { title: list.name };
}

/**
 * The owner's editor. Stats, filters and drag-to-reorder still to come —
 * and by design it shows a claim *count* only, never which gifts are claimed.
 */
export default async function EditorPage({ params }: PageProps<"/lists/[slug]">) {
  const { slug } = await params;
  const list = await requireOwnedList(slug);

  const gifts = await db
    .select()
    .from(items)
    .where(eq(items.listId, list.id))
    .orderBy(asc(items.position))
    .all();

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/${slug}`;

  const eventLine = [formatEventDate(list.eventDate), relativeEvent(list.eventDate)]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-[1000px] px-[22px] py-8 sm:px-8">
      <header className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          {eventLine ? (
            <p className="mb-[9px] text-[11px] font-semibold uppercase tracking-[1.6px] text-ink-62">
              {eventLine}
            </p>
          ) : null}
          <h1 className="mb-[9px] font-display text-[40px] leading-[1.05] tracking-[-1.2px]">
            <span className="mr-3">{list.emoji}</span>
            {list.name}
          </h1>
          <p className="text-[13px] font-medium text-ink-72">
            {gifts.length === 0
              ? "No gifts yet"
              : `${gifts.length} ${gifts.length === 1 ? "gift" : "gifts"}`}
            <span className="px-2 opacity-40">·</span>
            {list.sharedAt ? "Live" : "Not shared yet"}
          </p>
        </div>
        <Link
          href={`/lists/${slug}/add`}
          className="rounded-pill bg-violet px-5 py-[11px] text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
        >
          + Add gift
        </Link>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-ink-line bg-surface px-4 py-3">
        <span className="flex-1 truncate font-mono text-[13.5px] font-medium text-ink/82">
          {url.replace(/^https?:\/\//, "")}
        </span>
        <CopyButton value={url} label="Copy link" />
      </div>

      <div className="mb-[22px] flex items-center gap-3 rounded-[12px] border border-violet-edge bg-violet-wash px-4 py-[13px]">
        <EyeOffIcon className="shrink-0 text-violet" />
        <p className="text-[12.5px] leading-[1.55] text-ink/80">
          <strong className="font-semibold">You&rsquo;ll only ever see a count.</strong>{" "}
          Guests see live status; which gifts are claimed stays hidden from you.
        </p>
      </div>

      {gifts.length === 0 ? (
        <Link
          href={`/lists/${slug}/add`}
          className="block rounded-[12px] border border-dashed border-ink-line-strong px-6 py-12 text-center transition-colors duration-150 hover:bg-ink/[.02]"
        >
          <span className="mb-2 block text-[15px] font-semibold">
            Nothing on the list yet
          </span>
          <span className="block text-[13px] leading-[1.7] text-ink-72">
            Paste a link from any shop and we&rsquo;ll fill in the rest.
          </span>
        </Link>
      ) : (
        <ul className="flex flex-col gap-2">
          {gifts.map((gift) => (
            <GiftRow key={gift.id} gift={gift} />
          ))}
        </ul>
      )}
    </main>
  );
}

function GiftRow({ gift }: { gift: Item }) {
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
          <span className="flex h-full items-center justify-center text-center text-[9px] leading-tight text-ink-62">
            No
            <br />
            photo
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-semibold">{gift.title}</span>
          {gift.isMostWanted ? <Badge tone="violet">Most wanted</Badge> : null}
          {gift.isGroupGift ? <Badge tone="rose">Group gift</Badge> : null}
          {gift.quantity > 1 ? <Badge tone="neutral">Qty {gift.quantity}</Badge> : null}
        </div>
        <p
          className={`text-[12px] ${needsPhoto ? "font-medium text-amber-dark" : "text-ink-72"}`}
        >
          {needsPhoto
            ? "No photo found — items with a photo get claimed far more often"
            : [gift.sourceDomain ?? "Added by hand · no link", `qty ${gift.quantity}`].join(
                " · ",
              )}
        </p>
      </div>

      <span className="text-[16px] font-semibold">
        {gift.priceCents === null ? "—" : formatPrice(gift.priceCents)}
      </span>
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
      className={`rounded-pill px-2 py-[2px] text-[10.5px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
