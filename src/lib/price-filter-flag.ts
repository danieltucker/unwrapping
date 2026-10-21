/**
 * The switch for the price filter on public lists and gift-list shelves, read
 * from PRICE_FILTER when it is asked, so an operator turns it off with an
 * environment variable and a restart, not a build.
 *
 * On unless it says "off" (or "0", "false"); unset is on. Anything else it
 * doesn't recognise reads as off, like SECRET_SANTA: a switch an operator
 * reaches for in a hurry should fail closed rather than guess.
 *
 * Off means the bar is gone and ?min=&max=&unpriced= are ignored, so a shared
 * filtered link still opens, just unfiltered. Prices still read "about $X";
 * that is about what a price is, not about filtering.
 *
 * Pure, with no server-only import, so tests and pages share it.
 */
export function priceFilterEnabled(): boolean {
  const value = (process.env.PRICE_FILTER ?? "on").trim().toLowerCase();
  return value === "" || value === "on" || value === "1" || value === "true";
}
