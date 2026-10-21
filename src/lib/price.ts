/**
 * What a gift costs, as people type it and as guests filter by it.
 *
 * A price is stored twice over on the items table: `price_cents`, the number
 * everything sorts and filters on, and `price_label`, the owner's own words
 * when they typed more than a number ("from $35", "$20 to $30"). Only the
 * owner's words are ever shown verbatim; a bare number is shown as "about $X",
 * because even a price the shop confirmed this morning can move before a guest
 * gets there.
 *
 * Every filter here reads `price_cents` as it stands now. The monthly recheck
 * (src/lib/price-checks.ts) keeps a shop's price current there, so the filter
 * is only ever as stale as the last check, never as stale as the day the gift
 * was added.
 *
 * Pure, with no server-only import, so the forms, the pages and the tests all
 * share it.
 */
import { formatPrice, site } from "@/config/site";

/* -------------------------------------------------------------------------- */
/* Reading what an owner typed                                                */
/* -------------------------------------------------------------------------- */

/** The longest price text an owner can keep. A price, not a note. */
export const PRICE_LABEL_MAX = 40;

/** What the add and edit forms say when parsePriceInput gives up. */
export const PRICE_ERROR =
  "That price didn’t look like a price. Try 29.99, or a few words like “from $35”.";

/** A gift that costs more than this was a typo, not a present. */
const MAX_CENTS = 100_000_000; // $1,000,000

export type PriceInput = {
  /** Integer cents: the low end, when the text gave a range. */
  cents: number | null;
  /** The owner's own words, kept only when they said more than a number. */
  label: string | null;
};

/** Nothing but a number, with a currency sign or code if they like. */
const PLAIN = /^(?:[$£€]|usd|gbp|eur)?\s*[\d.,]+\s*(?:usd|gbp|eur)?$/i;

/** A number as people write one: "1,299.50", "29.99", ".99". */
const NUMBER = /\d[\d,]*(?:\.\d+)?|\.\d+/g;

/**
 * Reads a price the way an owner might type it.
 *
 *   "$29.99"      → 2999, no label
 *   "1,299"       → 129900, no label (a thousands comma, not a decimal one)
 *   "About $40"   → 4000, label "About $40"
 *   "$20 to $30"  → 2000, label "$20 to $30" (the low end of a range)
 *   "from $35"    → 3500, label "from $35"
 *   "2 for $30"   → 3000: a number with a currency sign beats one without
 *
 * Empty text is no price at all: `{ cents: null, label: null }`. Text with no
 * number in it, or one too odd to trust, is null, and the form says so.
 *
 * Deliberately separate from parsePriceToCents in scrape-parse.ts, which reads
 * shop pages from everywhere and has to treat "12,50" as twelve euros fifty.
 * An owner here types in the site's own locale, where "1,299" is a thousand.
 */
export function parsePriceInput(raw: string | null | undefined): PriceInput | null {
  const text = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!text) return { cents: null, label: null };

  const tokens = [...text.matchAll(NUMBER)].map((match) => ({
    value: amountToCents(match[0]),
    // A sign or code right before the number marks it as the money.
    marked: /(?:[$£€]|usd|gbp|eur)\s*$/i.test(text.slice(0, match.index)),
  }));
  if (tokens.length === 0 || tokens.some((token) => token.value === null)) return null;

  const marked = tokens.filter((token) => token.marked);
  const candidates = (marked.length > 0 ? marked : tokens).map((token) => token.value!);
  const cents = Math.min(...candidates);
  if (cents > MAX_CENTS) return null;

  if (PLAIN.test(text)) return { cents, label: null };
  if (text.length > PRICE_LABEL_MAX) return null;
  return { cents, label: text };
}

/** One number token in cents, or null when its commas make no sense. */
function amountToCents(token: string): number | null {
  let normalized: string;
  if (!token.includes(",")) normalized = token;
  // 1,299 or 12,345.67: commas between groups of three.
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(token)) normalized = token.replace(/,/g, "");
  // 12,50: someone used to a decimal comma. Read it as they meant it.
  else if (/^\d+,\d{1,2}$/.test(token)) normalized = token.replace(",", ".");
  else return null;

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/* -------------------------------------------------------------------------- */
/* Showing a price                                                            */
/* -------------------------------------------------------------------------- */

/** "about $29.99". */
export function formatAboutPrice(cents: number): string {
  return `about ${formatPrice(cents)}`;
}

/** "about $12 – $80", or "about $12" when both ends agree. */
export function formatAboutRange(minCents: number, maxCents: number): string {
  return minCents === maxCents
    ? formatAboutPrice(minCents)
    : `about ${formatPrice(minCents)} – ${formatPrice(maxCents)}`;
}

/**
 * The words for a gift's price: the owner's own if they typed some, otherwise
 * "about" and the number. Null when it has neither.
 */
export function priceText(item: { priceCents: number | null; priceLabel: string | null }): string | null {
  if (item.priceLabel) return item.priceLabel;
  return item.priceCents === null ? null : formatAboutPrice(item.priceCents);
}

/* -------------------------------------------------------------------------- */
/* Bands and ranges                                                           */
/* -------------------------------------------------------------------------- */

export const PRICE_BANDS = ["under_25", "25_50", "50_100", "100_up", "none"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];

/**
 * The edges of each band in cents, low end included and high end not, so the
 * bands never overlap: $50.00 is in "50 to 100", not in both.
 */
const BAND_EDGES: Record<Exclude<PriceBand, "none">, { min: number | null; max: number | null }> = {
  under_25: { min: null, max: 2_500 },
  "25_50": { min: 2_500, max: 5_000 },
  "50_100": { min: 5_000, max: 10_000 },
  "100_up": { min: 10_000, max: null },
};

/** Which band a price falls in; "none" when there is no price. */
export function priceBand(cents: number | null): PriceBand {
  if (cents === null) return "none";
  if (cents < 2_500) return "under_25";
  if (cents < 5_000) return "25_50";
  if (cents < 10_000) return "50_100";
  return "100_up";
}

/**
 * What the presents under an idea cost, low to high.
 *
 * An idea has no price of its own (see the items table); this is the closest
 * thing it has to one. Only prices in the site's currency count, the same rule
 * the filter follows. Null when none of them has a price.
 */
export function ideaPriceRange(
  children: readonly { priceCents: number | null; currency: string }[],
): { minCents: number; maxCents: number } | null {
  const prices = children
    .filter((child) => comparable(child))
    .map((child) => child.priceCents as number);
  if (prices.length === 0) return null;
  return { minCents: Math.min(...prices), maxCents: Math.max(...prices) };
}

/* -------------------------------------------------------------------------- */
/* The filter                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A guest's price filter, as read from the address bar: ?min=&max=&unpriced=.
 *
 * min is included and max is not, the same as the bands, so the chips and the
 * bands always agree. The form says "Under" for max to match.
 */
export type PriceFilter = {
  minCents: number | null;
  maxCents: number | null;
  /**
   * Whether gifts with no price stay in. Only means anything while a range is
   * set: with no range, nothing is filtered out at all. Choosing a range turns
   * it off, because a gift with no price isn't known to be in it; ticking the
   * box brings them back.
   */
  includeUnpriced: boolean;
};

export const NO_PRICE_FILTER: PriceFilter = { minCents: null, maxCents: null, includeUnpriced: false };

export function isPriceFilterActive(filter: PriceFilter): boolean {
  return filter.minCents !== null || filter.maxCents !== null;
}

/** The chips, in order. Each one is a band. */
export const PRICE_CHIPS = (["under_25", "25_50", "50_100", "100_up"] as const).map((band) => {
  const { min, max } = BAND_EDGES[band];
  return {
    band,
    minCents: min,
    maxCents: max,
    label:
      min === null
        ? `Under ${formatPrice(max!)}`
        : max === null
          ? `${formatPrice(min)} and up`
          : `${formatPrice(min)} to ${formatPrice(max)}`,
  };
});

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The filter in a page's search params. Anything unreadable is ignored rather
 * than refused: a mangled shared link should still open the page, just with
 * less filtered. A min above the max is read as the two swapped.
 */
export function parsePriceFilter(params: SearchParams): PriceFilter {
  let minCents = dollarsParam(params.min);
  let maxCents = dollarsParam(params.max);
  if (minCents !== null && maxCents !== null && minCents > maxCents) {
    [minCents, maxCents] = [maxCents, minCents];
  }
  // Under $0 matches nothing at all, which no one means.
  if (maxCents === 0) maxCents = null;
  if (minCents === 0) minCents = null;

  const unpriced = first(params.unpriced);
  return {
    minCents,
    maxCents,
    includeUnpriced: unpriced === "1" || unpriced === "on" || unpriced === "true",
  };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** "25", "25.50" or "$25" in a query string, as cents. */
function dollarsParam(value: string | string[] | undefined): number | null {
  const text = (first(value) ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number.parseFloat(text) * 100);
  return cents <= MAX_CENTS ? cents : null;
}

/**
 * Whether a price can be compared with the filter at all: there is one, and
 * it is in the site's currency. Cents of different currencies aren't the same
 * money, so a price in pounds on a dollar site counts as no price here.
 */
function comparable(item: { priceCents: number | null; currency: string }): boolean {
  return item.priceCents !== null && item.currency.toUpperCase() === site.currency;
}

export function matchesPriceFilter(
  item: { priceCents: number | null; currency: string },
  filter: PriceFilter,
): boolean {
  if (!isPriceFilterActive(filter)) return true;
  if (!comparable(item)) return filter.includeUnpriced;

  const cents = item.priceCents as number;
  if (filter.minCents !== null && cents < filter.minCents) return false;
  if (filter.maxCents !== null && cents >= filter.maxCents) return false;
  return true;
}

/** The chip this filter is exactly, or null for a custom range or none. */
export function activeChip(filter: PriceFilter): Exclude<PriceBand, "none"> | null {
  if (!isPriceFilterActive(filter)) return null;
  return (
    PRICE_CHIPS.find(
      (chip) => chip.minCents === filter.minCents && chip.maxCents === filter.maxCents,
    )?.band ?? null
  );
}

/** Cents as the dollars a query string or a number box holds: "25", "25.5". */
export function centsToParam(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * The address for a filter on a page. Empty values are left out so a shared
 * link reads cleanly, and `unpriced` is only written while it means something.
 */
export function priceFilterHref(path: string, filter: PriceFilter): string {
  const params = new URLSearchParams();
  if (filter.minCents !== null) params.set("min", centsToParam(filter.minCents));
  if (filter.maxCents !== null) params.set("max", centsToParam(filter.maxCents));
  if (isPriceFilterActive(filter) && filter.includeUnpriced) params.set("unpriced", "1");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** What filter_used records for this filter. See src/lib/event-validation.ts. */
export function filterEventValue(filter: PriceFilter): string {
  if (!isPriceFilterActive(filter)) return "all";
  const chip = activeChip(filter);
  return chip ? `price_${chip}` : "price_custom";
}
