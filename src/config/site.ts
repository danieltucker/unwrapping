/**
 * Product identity lives here and nowhere else, so renaming is a one-file change.
 * The name is still provisional — see README.
 */
export const site = {
  name: "Unwrap",
  domain: "unwrapp.ing",
  tagline: "A gift list people actually use.",
  description:
    "Paste a link from any shop and we fill in the photo, title and price. Share one link. Guests claim what they're buying, so nobody doubles up — and you never find out who chose what.",
  currency: "USD",
  locale: "en-US",
} as const;

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
