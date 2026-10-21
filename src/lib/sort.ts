/**
 * The order things are shown in on a public list and on a /gifts shelf, as a
 * guest picks it with ?sort=.
 *
 * Like the price filter, it lives in the address and is applied on the server,
 * so a sorted view is a link that can be shared, bookmarked and gone back to.
 * The default is never written into a link: a plain address is the owner's
 * own order on a list and the most popular first on a shelf.
 *
 * Every order is total. Whatever the option, ties fall back to the owner's
 * order, then the title, then the id, so the same list sorted the same way
 * always comes out the same, however the rows happened to arrive.
 *
 * Pure, with no server-only import, so the pages, the bar and the tests all
 * share it. The shelf's orders are SQL, in publishedGuides
 * (src/lib/guides.ts), because a shelf is cut to a limit after sorting.
 */
import { site } from "@/config/site";
import { hasComparablePrice } from "@/lib/price";

/* -------------------------------------------------------------------------- */
/* The options                                                                */
/* -------------------------------------------------------------------------- */

/** On a list: the gifts. Also every value sort_used may record. */
export const GIFT_SORTS = ["owner", "top", "low", "high", "newest", "az"] as const;
export type GiftSort = (typeof GIFT_SORTS)[number];

/** On a /gifts shelf: the gift lists. A shelf has no owner and no top picks. */
export const SHELF_SORTS = ["popular", "low", "high", "newest", "az"] as const;
export type ShelfSort = (typeof SHELF_SORTS)[number];

/** What the bar's select needs: the options in order, and which one is chosen. */
export type SortControl = {
  current: string;
  /** The option a plain address means, left out of every link. */
  fallback: string;
  options: readonly { value: string; label: string }[];
};

const PRICE_LABELS = { low: "Price: low to high", high: "Price: high to low" } as const;

/**
 * The options for a list's gifts. "Top" is said the way the cards say it: a
 * wishlist marks a gift "Most wanted", a gift guide marks it "Top pick".
 */
export function giftSortControl(current: GiftSort, kind: "wishlist" | "guide"): SortControl {
  const labels: Record<GiftSort, string> = {
    owner: "Owner’s order",
    top: kind === "guide" ? "Top picks first" : "Most wanted first",
    ...PRICE_LABELS,
    newest: "Newest",
    az: "A to Z",
  };
  return {
    current,
    fallback: "owner",
    options: GIFT_SORTS.map((value) => ({ value, label: labels[value] })),
  };
}

export function shelfSortControl(current: ShelfSort): SortControl {
  const labels: Record<ShelfSort, string> = {
    popular: "Most popular",
    ...PRICE_LABELS,
    newest: "Newest",
    az: "A to Z",
  };
  return {
    current,
    fallback: "popular",
    options: SHELF_SORTS.map((value) => ({ value, label: labels[value] })),
  };
}

/** The chosen option's words, for the bar's status line. */
export function sortLabel(control: SortControl): string {
  return control.options.find((option) => option.value === control.current)?.label ?? "";
}

/* -------------------------------------------------------------------------- */
/* Reading the address                                                        */
/* -------------------------------------------------------------------------- */

type SearchParams = Record<string, string | string[] | undefined>;

function sortParam(params: SearchParams): string {
  const value = params.sort;
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim().toLowerCase();
}

/**
 * ?sort= on a list. Anything unknown is the owner's order rather than an
 * error: a mangled shared link should still open the page.
 */
export function parseGiftSort(params: SearchParams): GiftSort {
  const value = sortParam(params);
  return (GIFT_SORTS as readonly string[]).includes(value) ? (value as GiftSort) : "owner";
}

/** ?sort= on a shelf. Anything unknown, "owner" and "top" included, is popular. */
export function parseShelfSort(params: SearchParams): ShelfSort {
  const value = sortParam(params);
  return (SHELF_SORTS as readonly string[]).includes(value) ? (value as ShelfSort) : "popular";
}

/** The value to write into a link: null for the default, which is left out. */
export function sortToParam(control: SortControl | null): string | null {
  return control && control.current !== control.fallback ? control.current : null;
}

/* -------------------------------------------------------------------------- */
/* Sorting a list's gifts                                                     */
/* -------------------------------------------------------------------------- */

export type Sortable = {
  id: string;
  title: string;
  /** The owner's order among siblings; see items.position. */
  position: number;
  /** When it was added, in milliseconds. Only to the second, so ties are common. */
  addedAt: number;
  priceCents: number | null;
  currency: string;
  isMostWanted: boolean;
};

/** "Book 2" before "Book 10", and "apple" level with "Apple". */
const collator = new Intl.Collator(site.locale, { sensitivity: "base", numeric: true });

function byOwner(a: Sortable, b: Sortable): number {
  return (
    a.position - b.position ||
    collator.compare(a.title, b.title) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Cheapest or dearest first. A gift with no price, or a price in another
 * currency, has nothing to compare and goes last either way: the same rule
 * the price filter uses for what counts as a price.
 */
function byPrice(direction: 1 | -1) {
  return (a: Sortable, b: Sortable): number => {
    const aPriced = hasComparablePrice(a);
    const bPriced = hasComparablePrice(b);
    if (!aPriced || !bPriced) return Number(!aPriced) - Number(!bPriced);
    return direction * ((a.priceCents as number) - (b.priceCents as number));
  };
}

const FIRST: Record<GiftSort, (a: Sortable, b: Sortable) => number> = {
  owner: () => 0,
  top: (a, b) => Number(b.isMostWanted) - Number(a.isMostWanted),
  low: byPrice(1),
  high: byPrice(-1),
  newest: (a, b) => b.addedAt - a.addedAt,
  az: (a, b) => collator.compare(a.title, b.title),
};

/** The gifts in the chosen order, as a new array. Ties go to the owner's order. */
export function sortGifts<T extends Sortable>(items: readonly T[], sort: GiftSort): T[] {
  const first = FIRST[sort];
  return [...items].sort((a, b) => first(a, b) || byOwner(a, b));
}
