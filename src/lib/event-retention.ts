import { lt } from "drizzle-orm";

import { db } from "@/db";
import { itemEventDrops, itemEvents } from "@/db/schema";
import { addMonths } from "@/lib/tracking";

/**
 * Raw events are kept for 13 months and then deleted, along with the daily
 * counts of what was turned away. Long enough to compare one December with the
 * last; no longer than the visitor cookie that labels them can live.
 *
 * Runs whether or not tracking is switched on: rows written while it was on
 * still have to go when their time is up.
 */
export const RETENTION_MONTHS = 13;

export async function pruneEvents(now = new Date()): Promise<{ events: number; drops: number }> {
  const cutoff = addMonths(now, -RETENTION_MONTHS);
  const events = await db.delete(itemEvents).where(lt(itemEvents.occurredAt, cutoff));
  const drops = await db
    .delete(itemEventDrops)
    .where(lt(itemEventDrops.day, cutoff.toISOString().slice(0, 10)));
  return { events: events.changes, drops: drops.changes };
}

const EVERY_MS = 24 * 60 * 60 * 1000;
/** After the server has settled, like the price checks. */
const FIRST_RUN_MS = 10 * 60 * 1000;

const globalForTimer = globalThis as unknown as { __eventRetentionTimer?: NodeJS.Timeout };

/** Started once per server process from src/instrumentation.ts. */
export function startEventRetention(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (globalForTimer.__eventRetentionTimer) return;

  const tick = () => {
    pruneEvents()
      .then(({ events, drops }) => {
        if (events || drops) {
          console.log(`[event-retention] deleted ${events} events and ${drops} daily counts older than ${RETENTION_MONTHS} months`);
        }
      })
      .catch((error) => console.error("[event-retention] failed:", error));
  };

  const first = setTimeout(() => {
    tick();
    globalForTimer.__eventRetentionTimer = setInterval(tick, EVERY_MS);
    globalForTimer.__eventRetentionTimer.unref();
  }, FIRST_RUN_MS);
  first.unref();
  globalForTimer.__eventRetentionTimer = first;
}
