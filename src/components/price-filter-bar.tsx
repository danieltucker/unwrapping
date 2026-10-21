import Form from "next/form";
import Link from "next/link";

import { PriceFilterUsage } from "@/components/price-filter-usage";
import { Input } from "@/components/ui";
import {
  activeChip,
  centsToParam,
  isPriceFilterActive,
  PRICE_CHIPS,
  priceFilterHref,
  type PriceFilter,
} from "@/lib/price";

/**
 * The price filter over a public list's gifts or a /gifts shelf's lists.
 *
 * Everything it does is in the address — ?min=&max=&unpriced= — and the page
 * filters on the server, so a filtered view is a link that can be shared,
 * bookmarked, gone back to with the back button and read by a crawler.
 * Nothing here needs JavaScript: the chips are links and the custom range is a
 * plain GET form. With JavaScript, next/form and next/link make both a soft
 * navigation that keeps the reader's place on the page.
 *
 * Choosing a chip always turns "include items without a price" off: a gift
 * with no price isn't known to be under $25. The box only appears once a range
 * is set, since with no range nothing is hidden for it to bring back.
 */
export function PriceFilterBar({
  path,
  filter,
  shown,
  total,
  noun,
}: {
  /** The page's own path, without a query: where the chips and form go. */
  path: string;
  filter: PriceFilter;
  /** How many of `total` the filter lets through. */
  shown: number;
  total: number;
  /** What is being counted, as [one, many]: ["gift", "gifts"]. */
  noun: [string, string];
}) {
  const active = isPriceFilterActive(filter);
  const current = activeChip(filter);

  return (
    <section
      aria-labelledby="price-filter-heading"
      className="mb-[22px] rounded-card border border-ink-line bg-surface p-4 sm:p-[18px]"
    >
      <PriceFilterUsage>
        <h2
          id="price-filter-heading"
          className="mb-[10px] text-2xs font-semibold uppercase tracking-[.9px] text-ink-66"
        >
          Price
        </h2>

        <ul className="mb-[14px] flex flex-wrap gap-2">
          {PRICE_CHIPS.map((chip) => {
            const selected = current === chip.band;
            return (
              <li key={chip.band}>
                <Link
                  href={priceFilterHref(path, {
                    minCents: chip.minCents,
                    maxCents: chip.maxCents,
                    includeUnpriced: false,
                  })}
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

          <button
            type="submit"
            className="min-h-[40px] w-full rounded-pill bg-ink px-5 text-xs font-semibold text-paper transition-colors duration-150 hover:bg-ink/90 sm:w-auto"
          >
            Apply
          </button>
        </Form>

        <div className="mt-[14px] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink-line pt-3 text-xs">
          <p role="status" className="font-semibold text-ink-72">
            {active
              ? `Showing ${shown} of ${total} ${total === 1 ? noun[0] : noun[1]}`
              : `${total} ${total === 1 ? noun[0] : noun[1]}`}
          </p>
          {active ? (
            <Link
              href={path}
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
