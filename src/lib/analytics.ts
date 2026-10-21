import "server-only";

import { count, gte } from "drizzle-orm";

import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";

/**
 * Counting what happens, without recording who it happened to.
 *
 * An event is a name and a time. Nothing else is accepted, so nothing else can
 * be stored by accident: not the account, not the exchange, not a cookie, not
 * an address. The only question this answers is "how many, and when", which is
 * all the product needs to know, and the answer can be shown to anyone.
 */

export const EVENTS = [
  "santa_group_created",
  "santa_member_joined",
  "santa_draw_run",
  "santa_reveal_opened",
] as const;
export type AnalyticsEvent = (typeof EVENTS)[number];

/**
 * Records one event. Never throws: losing a count is better than failing the
 * thing being counted.
 */
export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    await db.insert(analyticsEvents).values({ event });
  } catch (error) {
    console.error(`[analytics] could not record ${event}:`, error);
  }
}

export type EventCounts = Record<AnalyticsEvent, { last30: number; total: number }>;

/** Each event's count over the last 30 days and all time, for /admin. */
export async function eventCounts(): Promise<EventCounts> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [total, recent] = await Promise.all([
    db
      .select({ event: analyticsEvents.event, n: count() })
      .from(analyticsEvents)
      .groupBy(analyticsEvents.event)
      .all(),
    db
      .select({ event: analyticsEvents.event, n: count() })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, since))
      .groupBy(analyticsEvents.event)
      .all(),
  ]);

  return Object.fromEntries(
    EVENTS.map((event) => [
      event,
      {
        total: total.find((row) => row.event === event)?.n ?? 0,
        last30: recent.find((row) => row.event === event)?.n ?? 0,
      },
    ]),
  ) as EventCounts;
}
