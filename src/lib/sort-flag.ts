/**
 * The switch for ?sort= on public lists and gift-list shelves, read from
 * GIFT_SORT when it is asked, so an operator turns it off with an environment
 * variable and a restart, not a build.
 *
 * The same rules as PRICE_FILTER: on unless it says "off" (or "0", "false");
 * unset is on, and anything it doesn't recognise reads as off.
 *
 * Off means the select is gone from the bar and ?sort= is ignored, so a shared
 * sorted link still opens, in the owner's order. A list's grid gets back the
 * sort it had before, which only reorders what is already on the screen.
 *
 * Pure, with no server-only import, so tests and pages share it.
 */
export function giftSortEnabled(): boolean {
  const value = (process.env.GIFT_SORT ?? "on").trim().toLowerCase();
  return value === "" || value === "on" || value === "1" || value === "true";
}
