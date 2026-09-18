/**
 * Product identity lives here and nowhere else, so renaming is a one-file change.
 * The name is still provisional; see README.
 *
 * The address an instance is served from is *not* here: it changes per
 * deployment rather than per product, and this module reaches the browser. See
 * [`src/lib/origin.ts`](../lib/origin.ts).
 */

export const site = {
  name: "Unwrap",
  domain: "unwrapp.ing",
  tagline: "A gift list people actually use.",
  /**
   * The <title> of the landing page. The tagline is how we talk about
   * ourselves; this is what someone types into a search box, which is rarely
   * the same string.
   */
  searchTitle: "Free gift list and wishlist for any occasion",
  /**
   * The meta description. Kept under 160 characters because search results cut
   * it there, and a sentence that ends mid-word reads like a broken page.
   */
  description:
    "Make a free gift list for a birthday, wedding, baby shower or Christmas. Paste links from any shop, share one link, and nobody buys the same thing twice.",
  /** The hero's opening paragraph: the same pitch with room to breathe. */
  summary:
    "A free wishlist for birthdays, weddings, baby showers, Christmas and every other excuse for a present. Paste links from any shop, share one link, and guests claim what they’re buying without making an account.",
  currency: "USD",
  locale: "en-US",
} as const;

/**
 * The occasions we say out loud.
 *
 * Two jobs, which is why they live in config rather than in the page: they are
 * the words someone searches for, and each one is a way into the product, so
 * `prefill` is the list name we hand to /new. Keep every prefill inside the
 * vocabulary in `src/lib/emoji.ts`, or the suggested emoji arrives as a plain
 * present and the shortcut feels broken.
 */
export const occasions = [
  { emoji: "🎂", label: "Birthdays", prefill: "My birthday" },
  { emoji: "💍", label: "Weddings", prefill: "Our wedding" },
  { emoji: "🍼", label: "Baby showers", prefill: "Baby shower" },
  { emoji: "🎄", label: "Christmas", prefill: "Christmas list" },
  { emoji: "🏡", label: "Housewarming", prefill: "Housewarming" },
  { emoji: "🎓", label: "Graduation", prefill: "Graduation" },
  { emoji: "❤️", label: "Anniversaries", prefill: "Our anniversary" },
  { emoji: "🥂", label: "Engagements", prefill: "Engagement party" },
  { emoji: "✈️", label: "Honeymoon fund", prefill: "Honeymoon fund" },
  { emoji: "🏖️", label: "Retirement", prefill: "Retirement" },
  { emoji: "🕎", label: "Hanukkah", prefill: "Hanukkah" },
  { emoji: "🪔", label: "Diwali", prefill: "Diwali" },
] as const;

/**
 * What an owner may upload as a gift photo.
 *
 * Here rather than in `src/lib/uploads.ts` because the browser needs the same
 * number: a photo straight off a phone is routinely over the limit, and the
 * only pleasant place to say so is before it is sent. The limit is then
 * enforced twice more, in saveUpload once the bytes land and by Next's own
 * Server Action body cap in next.config.ts — which sits deliberately *above*
 * this, so an oversized file is refused by us, in a sentence, rather than by
 * the framework, with a 500.
 *
 * SVG is deliberately absent: it can carry script, and these are shown on a
 * page shared with strangers. The sniffing in uploads.ts is what enforces
 * that; this list only decides what the file picker offers.
 */
export const uploads = {
  maxBytes: 8_000_000,
  maxLabel: "8MB",
  accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
} as const;

/** "12.4MB", for telling someone how far over the limit they are. */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

/** Prices are stored as integer cents to keep arithmetic exact. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat(site.locale, {
    style: "currency",
    currency: site.currency,
    // Whole amounts read better without trailing zeros on gift cards
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** The public URL a list is shared under, e.g. unwrap.party/maya-30 */
export function listUrl(slug: string): string {
  return `${site.domain}/${slug}`;
}

/** Cents as an editable amount: "42.00", or blank when there isn't one. */
export function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}
