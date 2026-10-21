import Link from "next/link";

import { CardPhoto } from "@/components/card-photo";
import { CopyItemButton, CopyListButton } from "@/components/copy-dialog";
import { PriceChange } from "@/components/price-change";
import { PriceFilterBar } from "@/components/price-filter-bar";
import { IdeaRange, PriceTag } from "@/components/price-tag";
import { ReferralDisclosure } from "@/components/referral-disclosure";
import { ItemImpression } from "@/components/tracking";
import { Avatar, EyeOffIcon } from "@/components/ui";
import type { Category, List } from "@/db/schema";
import type { PublicItem } from "@/lib/claims";
import {
  formatAboutRange,
  isPriceFilterActive,
  matchesPriceFilter,
  priceText,
  type PriceFilter,
} from "@/lib/price";
import * as routes from "@/lib/routes";
import { giftSortControl, sortGifts, type GiftSort } from "@/lib/sort";
import { placed } from "@/lib/tracking-flag";

/**
 * A gift guide as anyone sees it: gift ideas for a kind of person, by someone
 * who knows them.
 *
 * Deliberately not the wishlist page with things switched off. Almost
 * everything that page is built around — who has taken what, what the owner
 * can see, the race for the last one — has no meaning here, because a guide is
 * for anyone and a thousand people can buy the same headlamp. What is left is
 * a shop window: each gift, why it's a good one, where to buy it, and the two
 * ways to keep it: add one to a list of your own, or copy the lot.
 */
export function GuideView({
  list,
  items,
  ownerHandle,
  owner,
  category,
  copyCount,
  viewerIsOwner,
  priceFilter,
  sort,
  path,
}: {
  list: List;
  items: PublicItem[];
  ownerHandle: string | null;
  owner: { name: string; avatarUrl: string | null } | null;
  category: Pick<Category, "slug" | "name" | "emoji"> | null;
  copyCount: number;
  viewerIsOwner: boolean;
  /** Null while PRICE_FILTER is off: no bar, nothing filtered. */
  priceFilter: PriceFilter | null;
  /** ?sort=; null while GIFT_SORT is off: no select, the curator's order. */
  sort: GiftSort | null;
  /** This page's own address, which the filter's links and form point at. */
  path: string;
}) {
  const ideas = items.filter((item) => item.kind === "idea");
  const gifts = items.filter((item) => item.kind !== "idea" && item.parentId === null);
  // Filtered and sorted on the server, so a filtered link is a page a crawler
  // can read.
  // TODO(ideas): ideas and the picks under them are shown whatever the filter
  // says, as they always have been. Once ideas settle, decide whether an idea
  // whose picks are all out of range should drop out too; ideaPriceRange is
  // the number to decide it with.
  //
  // TODO(ideas): and they keep the curator's order whatever ?sort= says. How
  // an idea sorts is the ideas feature's to define (it has no single price);
  // see the matching note in the wishlist page. The rule goes in sortGifts.
  const inRange = priceFilter
    ? gifts.filter((item) => matchesPriceFilter(item, priceFilter))
    : gifts;
  const shownGifts = sort ? sortGifts(inRange, sort) : inRange;
  const sortControl = sort && gifts.length > 1 ? giftSortControl(sort, "guide") : null;
  const filtering = priceFilter !== null && isPriceFilterActive(priceFilter);
  const childrenOf = (id: string) => items.filter((item) => item.parentId === id);

  const prices = items
    .map((item) => item.priceCents)
    .filter((price): price is number => price !== null);
  const presentCount = items.length - ideas.length;

  return (
    <div className="flex flex-1 flex-col">
      {viewerIsOwner ? (
        <p className="flex items-center gap-3 border-b border-violet-edge bg-violet-wash px-[22px] py-3 text-xs leading-[1.55] text-ink/80 sm:px-8">
          <EyeOffIcon size={17} className="shrink-0 text-violet" />
          <span>
            <strong className="font-semibold">You&rsquo;re previewing your gift list.</strong>{" "}
            {list.publishedAt
              ? "It's live on Gift lists, and this is exactly what visitors see."
              : "Only people with the link can see it until you publish it."}{" "}
            <Link
              href={routes.manageList(list, ownerHandle)}
              className="font-semibold text-violet"
            >
              Back to editing
            </Link>
          </span>
        </p>
      ) : null}

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[344px_1fr]">
        <aside className="flex flex-col gap-[22px] bg-ink px-[22px] py-8 sm:px-[30px] lg:sticky lg:top-0 lg:h-screen lg:py-9">
          <div>
            <div className="mb-4 flex items-center gap-[9px]">
              <span className="text-xl">{list.emoji}</span>
              {category ? (
                <Link
                  href={routes.giftCategory(category.slug)}
                  className="text-2xs font-semibold uppercase tracking-[1.6px] text-champagne hover:underline"
                >
                  Gift list · {category.name}
                </Link>
              ) : (
                <span className="text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
                  Gift list
                </span>
              )}
            </div>
            <h1 className="font-display text-[2.375rem] leading-[1.02] tracking-[-1.4px] text-paper lg:text-[2.875rem]">
              {list.name}
            </h1>
          </div>

          {owner ? (
            <p className="flex items-center gap-[10px] text-sm font-medium text-paper-88">
              <Avatar name={owner.name} url={owner.avatarUrl} size={28} />
              <span>
                Picked by {owner.name}
                {ownerHandle ? (
                  <span className="text-paper/60"> · @{ownerHandle}</span>
                ) : null}
              </span>
            </p>
          ) : null}

          {list.note ? (
            <p className="text-sm leading-[1.8] text-paper-88">{list.note}</p>
          ) : null}

          {items.length > 0 ? <CopyListButton prominent /> : null}

          <dl className="flex flex-col gap-px overflow-hidden rounded-[12px]">
            <Stat
              label="Gift ideas"
              value={String(presentCount + ideas.length)}
            />
            <Stat
              label="Price range"
              value={
                prices.length === 0
                  ? "-"
                  : formatAboutRange(Math.min(...prices), Math.max(...prices))
              }
            />
            {copyCount > 0 ? (
              <Stat
                label="Copied"
                value={`${copyCount} ${copyCount === 1 ? "time" : "times"}`}
                highlight
              />
            ) : null}
          </dl>

          <p className="text-xs leading-[1.7] text-paper/84">
            Nothing here is reserved, so buy whatever you like. Adding a gift to
            your own list copies it; nothing you change touches this one.
          </p>

          <Link
            href={category ? routes.giftCategory(category.slug) : routes.giftGuides}
            className="mt-auto border-t border-paper-line pt-6 text-sm font-semibold text-paper hover:underline"
          >
            {category ? `More ${category.name} gift lists →` : "Browse more gift lists →"}
          </Link>

          <ReferralDisclosure
            hrefs={items.map((item) => item.href)}
            className="text-paper/70"
          />
        </aside>

        <main className="bg-paper px-[22px] py-7 sm:px-7">
          {items.length === 0 ? (
            <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-16 text-center text-sm text-ink-72">
              Nothing has been added to this list yet.
            </p>
          ) : (
            <>
              {(priceFilter || sortControl) && gifts.length > 0 ? (
                <PriceFilterBar
                  path={path}
                  filter={priceFilter}
                  sort={sortControl}
                  shown={shownGifts.length}
                  total={gifts.length}
                  noun={["gift", "gifts"]}
                />
              ) : null}

              {shownGifts.length > 0 ? (
                <ul className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
                  {shownGifts.map((item) => (
                    <GuideGiftCard key={item.id} item={item} />
                  ))}
                </ul>
              ) : filtering ? (
                <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center text-sm text-ink-72">
                  No gifts in that price range. Try a wider one, or clear the filter.
                </p>
              ) : null}

              {ideas.length > 0 ? (
                <section
                  className={gifts.length > 0 ? "mt-9 border-t border-ink-line pt-7" : undefined}
                >
                  <h2 className="text-lg font-semibold tracking-[-.2px]">
                    Ideas to shop around
                  </h2>
                  <p className="mb-[18px] mt-1 max-w-[42rem] text-sm leading-[1.65] text-ink-72">
                    Directions rather than one particular thing, for when you&rsquo;d
                    rather choose. Some come with a few that fit.
                  </p>
                  <ul className="grid grid-cols-1 items-start gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
                    {ideas.map((idea) => (
                      <GuideIdeaCard key={idea.id} item={idea} suggestions={childrenOf(idea.id)} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function GuideGiftCard({ item }: { item: PublicItem }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-ink-line bg-surface">
      <ItemImpression itemId={item.id} />
      <CardPhoto
        image={item.image}
        emoji={item.emoji}
        fallback="No photo for this one"
        href={item.buyHref && placed(item.buyHref, "photo")}
      />
      {/* Violet for a top pick, the same band "most wanted" uses on a wishlist,
          with the pill below saying so in words. */}
      <div className={`h-1 ${item.isMostWanted ? "bg-violet" : "bg-ink/12"}`} aria-hidden="true" />

      <div className="flex flex-1 flex-col p-[17px]">
        {item.isMostWanted ? (
          <span className="mb-[10px] self-start rounded-pill bg-violet/10 px-[10px] py-[3px] text-2xs font-semibold text-violet-hover">
            Top pick
          </span>
        ) : null}

        <div className="mb-[7px] flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold leading-[1.25] tracking-[-.2px]">
            {item.buyHref ? (
              <a
                href={placed(item.buyHref, "title")}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:underline focus-ring"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>
          {item.priceCents !== null || item.priceLabel ? (
            <span className="whitespace-nowrap font-display text-[1.375rem]">
              <PriceTag cents={item.priceCents} label={item.priceLabel} />
            </span>
          ) : null}
        </div>

        <PriceChange
          nowCents={item.priceCents}
          wasCents={item.wasPriceCents}
          className="-mt-[3px] mb-[9px]"
        />

        <p className="mb-[14px] flex-1 text-sm leading-[1.65] text-ink-76">{item.reason}</p>

        {item.buyHref ? (
          <a
            href={placed(item.buyHref, "button")}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="block w-full rounded-pill border border-violet/45 py-3 text-center text-sm font-semibold text-violet transition-colors duration-150 hover:bg-violet-wash"
          >
            Buy it at {item.sourceDomain ?? "the shop"} ↗
          </a>
        ) : (
          <p className="rounded-pill bg-ink/[.04] py-3 text-center text-xs font-medium text-ink-62">
            No link: find it anywhere you like
          </p>
        )}

        <CopyItemButton itemId={item.id} title={item.title} />
      </div>
    </li>
  );
}

function GuideIdeaCard({
  item,
  suggestions,
}: {
  item: PublicItem;
  suggestions: PublicItem[];
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-ink-line bg-surface">
      <ItemImpression itemId={item.id} />
      <CardPhoto
        image={item.image}
        emoji={item.emoji}
        fallback="Pick whatever you think fits"
        height="h-[160px]"
      />
      <div className={`h-1 ${item.isMostWanted ? "bg-violet" : "bg-ink/12"}`} aria-hidden="true" />

      <div className="flex flex-1 flex-col p-[17px]">
        {item.isMostWanted ? (
          <span className="mb-[10px] self-start rounded-pill bg-violet/10 px-[10px] py-[3px] text-2xs font-semibold text-violet-hover">
            Top pick
          </span>
        ) : null}
        <h3 className="mb-[7px] text-lg font-semibold leading-[1.25] tracking-[-.2px]">
          {item.title}
        </h3>
        <p className="mb-[14px] flex-1 text-sm leading-[1.65] text-ink-76">
          {item.reason ?? "Anything along these lines would land well."}
        </p>

        {suggestions.length > 0 ? (
          <div className="mb-[10px] border-t border-ink-line pt-[13px]">
            <p className="mb-[9px] text-2xs font-semibold uppercase tracking-[1.3px] text-ink-62">
              {suggestions.length === 1 ? "One that fits" : `${suggestions.length} that fit`}
              <IdeaRange suggestions={suggestions} />
            </p>
            <ul className="flex flex-col gap-[7px]">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="flex items-center gap-[10px] rounded-[9px] border border-ink-line bg-surface px-[9px] py-2"
                >
                  <ItemImpression itemId={suggestion.id} />
                  <span className="flex h-[38px] w-[32px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-ink/[.05]">
                    {suggestion.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={suggestion.image} alt="" className="h-full w-full object-cover" />
                    ) : suggestion.emoji ? (
                      <span className="text-base leading-none">{suggestion.emoji}</span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold leading-[1.35]">
                      {suggestion.buyHref ? (
                        <a
                          href={placed(suggestion.buyHref, "child")}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="underline-offset-2 hover:underline focus-ring"
                        >
                          {suggestion.title}
                        </a>
                      ) : (
                        suggestion.title
                      )}
                    </span>
                    <span className="block text-2xs leading-[1.4] text-ink-62">
                      {[priceText(suggestion), suggestion.sourceDomain]
                        .filter(Boolean)
                        .join(" · ") || "No price listed"}
                    </span>
                  </span>
                  <CopyItemButton
                    itemId={suggestion.id}
                    title={suggestion.title}
                    label="+ Add"
                    className="shrink-0 px-1 py-2 text-xs font-semibold text-violet transition-colors duration-150 hover:text-violet-hover focus-ring"
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <CopyItemButton
          itemId={item.id}
          title={item.title}
          label={suggestions.length > 0 ? "+ Add this idea and its picks to my list" : "+ Add this idea to my list"}
        />
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between bg-paper-fill px-[15px] py-[13px] text-sm">
      <dt className="font-medium text-paper/84">{label}</dt>
      <dd className={`font-semibold ${highlight ? "text-champagne" : "text-paper"}`}>
        {value}
      </dd>
    </div>
  );
}
