/**
 * The switch for event tracking, read from EVENT_TRACKING when it is asked, so
 * an operator turns it on with an environment variable and a restart, not a
 * build.
 *
 * Off unless it says "on". Off means the feature isn't there: buy buttons link
 * straight to the shop as they always did, no tracking cookie is set, the
 * browser sends nothing, and /api/events stores nothing. /go/<itemId> still
 * redirects, because a link someone copied while it was on should keep working.
 *
 * Separate from the pause switch on /admin (see isTrackingPaused), which only
 * stops rows being written and leaves every link where it is.
 *
 * Pure, with no server-only import, so tests and the route handlers share it.
 */
export function trackingEnabled(): boolean {
  const value = (process.env.EVENT_TRACKING ?? "").trim().toLowerCase();
  return value === "on" || value === "1" || value === "true";
}

/** Where a buy button was pressed from, for outbound_click. */
export const GO_SOURCES = ["list", "guide", "reserved", "contributions"] as const;
export type GoSource = (typeof GO_SOURCES)[number];

/** Which link on the card it was. */
export const GO_PLACEMENTS = ["photo", "title", "domain", "button", "child"] as const;
export type GoPlacement = (typeof GO_PLACEMENTS)[number];

/**
 * The link a buy button renders: /go/<itemId> while tracking is on, so the
 * click is counted on the way through, or the shop's own address while it is
 * off. Null when the gift has no link, exactly like the href it stands in for.
 */
export function buyLink(
  itemId: string,
  href: string | null,
  from: GoSource,
): string | null {
  if (!href) return null;
  if (!trackingEnabled()) return href;
  return `/go/${encodeURIComponent(itemId)}?from=${from}`;
}

/**
 * Says which of a card's links this is. Leaves a shop's own URL untouched:
 * a parameter added there would be sent to the shop.
 */
export function placed(href: string, at: GoPlacement): string {
  return href.startsWith("/go/") ? `${href}&at=${at}` : href;
}
