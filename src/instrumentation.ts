/**
 * Runs once when a server process starts. The only thing started here is the
 * hourly price and link recheck; see src/lib/price-check-schedule.ts.
 *
 * Imported inside the Node.js branch, so the database driver and the scraper
 * never reach any other runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPriceChecks } = await import("@/lib/price-check-schedule");
    startPriceChecks();
  }
}
