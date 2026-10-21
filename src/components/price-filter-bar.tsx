import Form from "next/form";
import Link from "next/link";

import { PriceFilterUsage } from "@/components/price-filter-usage";
import { SortSelect } from "@/components/sort-select";
import { Input } from "@/components/ui";
import {
  activeChip,
  centsToParam,
  isPriceFilterActive,
  NO_PRICE_FILTER,
  PRICE_CHIPS,
  priceFilterHref,
  type PriceFilter,
} from "@/lib/price";
import { sortLabel, sortToParam, type SortControl } from "@/lib/sort";

/**
 * The price filter and the sort over a public list's gifts or a /gifts
 * shelf's lists. Either half can be switched off on its own (PRICE_FILTER,
 * GIFT_SORT), and the bar is only drawn while one of them is on.
 *
 * Everything it does is in the address — ?min=&max=&unpriced=&sort= — and the
 * page filters and sorts on the server, so the view is a link that can be
 * shared, bookmarked, gone back to with the back button and read by a crawler.
 * Nothing here needs JavaScript: the chips are links, and the custom range
 * and the sort are plain GET forms. With JavaScript, next/form and next/link
 * make them soft navigations that keep the reader's place on the page, and the
 * sort applies as soon as it changes (see SortSelect).
 *
 * Each control carries the other's state, so picking a chip keeps the order
 * and sorting keeps the range. "Clear filters" clears the price and keeps the
 * order too: it is a filter that is being cleared.
 *
 * Choosing a chip always turns "include items without a price" off: a gift
 * with no price isn't known to be under $25. The box only appears once a range
 * is set, since with no range nothing is hidden for it to bring back.
 */
export function PriceFilterBar({
  path,
  filter,
  sort,
  shown,
  total,
  noun,
}: {
  /** The page's own path, without a query: where the chips and forms go. */
  path: string;
  /** Null while PRICE_FILTER is off. */
  filter: PriceFilter | null;
  /** Null while GIFT_SORT is off, or with too few things to sort. */
  sort: SortControl | null;
  /** How many of `total` the filter lets through. */
  shown: number;
  total: number;
  /** What is being counted, as [one, many]: ["gift", "gifts"]. */
  noun: [string, string];
}) {
  const active = filter !== null && isPriceFilterActive(filter);
  const current = filter ? activeChip(filter) : null;
  const keepSort = sortToParam(sort);
  const counted = `${total} ${total === 1 ? noun[0] : noun[1]}`;

  return (
    <section
      aria-label={filter && sort ? "Filter and sort" : filter ? "Filter by price" : "Sort"}
      className="mb-[22px] rounded-card border border-ink-line bg-surface p-4 sm:p-[18px]"
    >
      <PriceFilterUsage>
        <div className="mb-[10px] flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {filter ? (
            <h2 className="text-2xs font-semibold uppercase tracking-[.9px] text-ink-66">
              Price
            </h2>
          ) : null}

          {/* First on a phone, so "Price" stays above its own chips. */}
          {sort ? (
            <Form
              action={path}
              scroll={false}
              prefetch={false}
              className="order-first flex w-full items-center gap-2 sm:order-none sm:ml-auto sm:w-auto"
            >
              <label
                htmlFor="sort-select"
                className="shrink-0 text-2xs font-semibold uppercase tracking-[.9px] text-ink-66"
              >
                Sort by
              </label>
              <SortSelect control={sort} path={path} />
              {/* The range rides along, so sorting keeps it. */}
              {filter?.minCents != null ? (
                <input type="hidden" name="min" value={centsToParam(filter.minCents)} />
              ) : null}
              {filter?.maxCents != null ? (
                <input type="hidden" name="max" value={centsToParam(filter.maxCents)} />
              ) : null}
              {active && filter.includeUnpriced ? (
                <input type="hidden" name="unpriced" value="1" />
              ) : null}
              {/* Only without JavaScript; with it, choosing is enough. */}
              <button
                type="submit"
                className="hidden min-h-[40px] items-center rounded-pill bg-ink px-4 text-xs font-semibold text-paper noscript:inline-flex"
              >
                Sort
              </button>
            </Form>
          ) : null}
        </div>

        {filter ? (
          <>
            <ul className="mb-[14px] flex flex-wrap gap-2">
              {PRICE_CHIPS.map((chip) => {
                const selected = current === chip.band;
                return (
                  <li key={chip.band}>
                    <Link
                      href={priceFilterHref(
                        path,
                        { minCents: chip.minCents, maxCents: chip.maxCents, includeUnpriced: false },
                        keepSort,
                      )}
                      scroll={false}
                      aria-current={selected ? "true" : undefined}
                      data-filter-event={`price_${chip.band}`}
                      className={`inline-flex min-h-[40px] items-center rounded-pill border px-[14px] text-xs font-semibold transition-colors duration-150 focus-ring ${
                        selected
                          ? "border-ink bg-ink text-paper"
                          : "border-ink-line-strong bg-surface text-ink-72 hover:bg-ink/[.03]"
                      }`}
                    >
                      {chip.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Keyed by the filter, so going back or picking a chip refills the
                boxes from the address rather than keeping what was typed before. */}
            <Form
              key={priceFilterHref(path, filter)}
              action={path}
              scroll={false}
              prefetch={false}
              data-price-form
              className="flex flex-wrap items-end gap-x-3 gap-y-3"
            >
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                <label htmlFor="price-min" className="block">
                  <span className="mb-[5px] block text-2xs font-semibold text-ink-66">From $</span>
                  <Input
                    id="price-min"
                    name="min"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    defaultValue={filter.minCents === null ? "" : centsToParam(filter.minCents)}
                    className="py-[9px] text-sm sm:w-[7.5rem]"
                  />
                </label>
                <label htmlFor="price-max" className="block">
                  <span className="mb-[5px] block text-2xs font-semibold text-ink-66">Under $</span>
                  <Input
                    id="price-max"
                    name="max"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="Any"
                    defaultValue={filter.maxCents === null ? "" : centsToParam(filter.maxCents)}
                    className="py-[9px] text-sm sm:w-[7.5rem]"
                  />
                </label>
              </div>

              {active ? (
                <label
                  htmlFor="price-unpriced"
                  className="flex min-h-[40px] w-full cursor-pointer items-center gap-2 text-sm font-medium text-ink-72 sm:w-auto"
                >
                  <input
                    id="price-unpriced"
                    type="checkbox"
                    name="unpriced"
                    value="1"
                    defaultChecked={filter.includeUnpriced}
                    className="h-[18px] w-[18px] shrink-0 accent-violet"
                  />
                  Include items without a price
                </label>
              ) : null}

              {/* The order rides along, so filtering keeps it. */}
              {keepSort ? <input type="hidden" name="sort" value={keepSort} /> : null}

              <button
                type="submit"
                className="min-h-[40px] w-full rounded-pill bg-ink px-5 text-xs font-semibold text-paper transition-colors duration-150 hover:bg-ink/90 sm:w-auto"
              >
                Apply
              </button>
            </Form>
          </>
        ) : null}

        <div className="mt-[14px] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink-line pt-3 text-xs">
          {/* A status, so a screen reader hears the new count or order after a
              chip or the select changes the page under it. */}
          <p role="status" className="font-semibold text-ink-72">
            {active ? `Showing ${shown} of ${counted}` : counted}
            {sort && keepSort ? `. Sorted by ${sortLabel(sort)}` : null}
          </p>
          {active ? (
            <Link
              href={priceFilterHref(path, NO_PRICE_FILTER, keepSort)}
              scroll={false}
              data-filter-event="all"
              className="font-semibold text-violet underline-offset-2 hover:underline focus-ring"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      </PriceFilterUsage>
    </section>
  );
}
