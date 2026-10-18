import { runPriceChecks } from "@/lib/price-checks";

/**
 * The timer that keeps prices fresh, started once per server process from
 * src/instrumentation.ts.
 *
 * An in-process timer rather than cron, because a self-hosted instance is one
 * Node process in one container with nobody to install a crontab, and the work
 * is small: a batch of links an hour, each a minute apart at most. Over a month
 * that covers a few thousand links, which is far more than one instance holds.
 *
 * On by default in production and off in development, the same split as
 * DB_AUTO_MIGRATE: a laptop running `next dev` shouldn't start fetching shops
 * in the background unasked. PRICE_CHECKS=1 turns it on anywhere; PRICE_CHECKS=0
 * turns it off anywhere.
 */

const BATCH = Number(process.env.PRICE_CHECK_BATCH) || 20;
const EVERY_MS = 60 * 60 * 1000;
/** Let the server finish starting, and the first visitors in, before any fetching. */
const FIRST_RUN_MS = 5 * 60 * 1000;

const globalForTimer = globalThis as unknown as { __priceCheckTimer?: NodeJS.Timeout };

export function startPriceChecks(): void {
  const asked =
    process.env.PRICE_CHECKS === "1" ||
    (process.env.NODE_ENV === "production" && process.env.PRICE_CHECKS !== "0");
  if (!asked) return;

  // A build imports the app but never serves it; nothing should be fetched then.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Once per process, however many times this module is evaluated.
  if (globalForTimer.__priceCheckTimer) return;

  const tick = () => {
    runPriceChecks(BATCH).catch((error) => {
      console.error("[price-checks] batch failed:", error);
    });
  };

  const first = setTimeout(() => {
    tick();
    globalForTimer.__priceCheckTimer = setInterval(tick, EVERY_MS);
    // Never the reason a process stays alive.
    globalForTimer.__priceCheckTimer.unref();
  }, FIRST_RUN_MS);
  first.unref();
  globalForTimer.__priceCheckTimer = first;

  console.log(`[price-checks] scheduled: ${BATCH} links an hour, first in ${FIRST_RUN_MS / 60_000} minutes`);
}
