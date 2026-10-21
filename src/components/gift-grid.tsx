"use client";

import { useState } from "react";

import { GiftCard } from "@/components/gift-card";
import { useTrackingScope } from "@/components/tracking";
import { formatPrice } from "@/config/site";
import type { ClaimRule } from "@/db/schema";
import type { PublicItem } from "@/lib/claims";
import { isStillOpen } from "@/lib/funding";
import { track } from "@/lib/track";

/** The price the "under" filter draws its line at. */
const AFFORDABLE_CENTS = 5000;

type Filter = "all" | "free" | "affordable" | "wanted";
type Sort = "owner" | "low" | "high";

const MATCHES: Record<Filter, (item: PublicItem) => boolean> = {
  all: () => true,
  free: isStillOpen,
  affordable: (item) => item.priceCents !== null && item.priceCents < AFFORDABLE_CENTS,
  wanted: (item) => item.isMostWanted,
};

/**
 * The guest's view of the gifts: filters and sorting, both client-side over the
 * list already on the page. Nothing here re-queries, so nothing here can leak
 * more than the server already decided this viewer may see.
 *
 * Price is the exception, and isn't here: the price filter above the grid
 * lives in the address and is applied on the server before `items` arrives
 * (see PriceFilterBar). The old "Under $50" chip only comes back while that
 * filter is switched off with PRICE_FILTER.
 */
export function GiftGrid({
  items,
  handle,
  listKey,
  claimRule,
  viewerIsOwner,
  signedIn,
  surpriseMode,
  affordableChip = false,
}: {
  items: PublicItem[];
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  viewerIsOwner: boolean;
  signedIn: boolean;
  surpriseMode: boolean;
  /** Offer "Under $50" here; only while the price filter bar is off. */
  affordableChip?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("owner");
  // Which controls get used, never what was on screen when they were.
  const scope = useTrackingScope();

  const chooseFilter = (key: Filter) => {
    setFilter(key);
    if (scope && key !== filter) track("filter_used", { listId: scope.listId, props: { filter: key } });
  };
  const chooseSort = (key: Sort) => {
    setSort(key);
    if (scope && key !== sort) track("sort_used", { listId: scope.listId, props: { sort: key } });
  };

  const labels: Record<Filter, string> = {
    all: "All",
    free: "Still free",
    affordable: `Under ${formatPrice(AFFORDABLE_CENTS)}`,
    wanted: "Most wanted",
  };

  const visible = items.filter(MATCHES[filter]);

  // A gift with no price has nothing to sort by, so it keeps to the end.
  const sorted =
    sort === "owner"
      ? visible
      : [...visible].sort((a, b) => {
          if (a.priceCents === null) return 1;
          if (b.priceCents === null) return -1;
          return sort === "low"
            ? a.priceCents - b.priceCents
            : b.priceCents - a.priceCents;
        });

  // Exactly one filled button per screen: the most-wanted gift still free.
  const primaryId = sorted.find(
    (item) => item.isMostWanted && isStillOpen(item) && !item.claimedByViewer,
  )?.id;

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        {(Object.keys(MATCHES) as Filter[]).map((key) => {
          const count = items.filter(MATCHES[key]).length;
          if (key !== "all" && count === 0) return null;
          if (key === "affordable" && !affordableChip) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => chooseFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-pill px-[13px] py-[7px] text-xs font-semibold transition-colors duration-150 ${
                filter === key
                  ? "bg-ink text-paper"
                  : "border border-ink-line-strong bg-surface text-ink-72 hover:bg-ink/[.03]"
              }`}
            >
              {labels[key]} {count}
            </button>
          );
        })}

        {items.length > 1 ? (
          <label className="ml-auto flex items-center gap-2 text-xs font-medium text-ink-62">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => chooseSort(event.target.value as Sort)}
              className="rounded-control border border-ink-line-strong bg-surface px-[10px] py-[6px] text-xs font-semibold text-ink-72 focus-ring"
            >
              <option value="owner">The list&rsquo;s own order</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </label>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-16 text-center text-sm text-ink-72">
          {items.length === 0
            ? "No gifts in that price range. Try a wider one, or clear the filter."
            : "Nothing matches that filter."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item) => (
            <GiftCard
              key={item.id}
              item={item}
              handle={handle}
              listKey={listKey}
              claimRule={claimRule}
              emphasis={item.id === primaryId ? "filled" : "outline"}
              viewerIsOwner={viewerIsOwner}
              signedIn={signedIn}
              surpriseMode={surpriseMode}
            />
          ))}
        </ul>
      )}
    </>
  );
}
