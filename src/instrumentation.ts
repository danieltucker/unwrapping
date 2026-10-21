/**
 * Runs once when a server process starts. Two timers start here: the hourly
 * price and link recheck (src/lib/price-check-schedule.ts) and the daily
 * deletion of tracking events past their 13 months (src/lib/event-retention.ts).
 *
 * Imported inside the Node.js branch, so the database driver and the scraper
 * never reach any other runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPriceChecks } = await import("@/lib/price-check-schedule");
    startPriceChecks();
    const { startEventRetention } = await import("@/lib/event-retention");
    startEventRetention();
  }
}
