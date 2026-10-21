import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { itemEventDrops, itemEvents, items, lists, type ItemEventType } from "@/db/schema";
import { isTrackingPaused } from "@/lib/tracking";
import { trackingEnabled } from "@/lib/tracking-flag";

/**
 * What /admin shows about event tracking: enough to tell at a glance that it
 * is switched on, that events are arriving, and that the filters are doing
 * their job. Counts and ids only; see the item_events table for why there is
 * nothing else to show.
 */

const DAYS = 30;

export type DayCounts = { day: string; counts: Partial<Record<ItemEventType, number>>; total: number };

export type FeedEvent = {
  id: number;
  occurredAt: string;
  eventType: ItemEventType;
  listId: string | null;
  itemId: string | null;
  ideaId: string | null;
  visitorId: string | null;
  sessionId: string | null;
  isBot: boolean;
};

/** The newest events first, ids only. Shared by the page and its live feed. */
export async function latestEvents(limit = 50): Promise<FeedEvent[]> {
  const rows = await db
    .select({
      id: itemEvents.id,
      occurredAt: itemEvents.occurredAt,
      eventType: itemEvents.eventType,
      listId: itemEvents.listId,
      itemId: itemEvents.itemId,
      ideaId: itemEvents.ideaId,
      visitorId: itemEvents.visitorId,
      sessionId: itemEvents.sessionId,
      isBot: itemEvents.isBot,
    })
    .from(itemEvents)
    .orderBy(desc(itemEvents.id))
    .limit(limit)
    .all();
  return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
}

export async function trackingOverview() {
  const since = new Date(Date.now() - DAYS * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const sinceDay = since.toISOString().slice(0, 10);

  const [perDay, bots, topItems, drops, feed, paused] = await Promise.all([
    db
      .select({
        day: sql<string>`date(${itemEvents.occurredAt}, 'unixepoch')`,
        eventType: itemEvents.eventType,
        n: sql<number>`count(*)`,
      })
      .from(itemEvents)
      .where(gte(itemEvents.occurredAt, since))
      .groupBy(sql`1`, itemEvents.eventType)
      .all(),

    db
      .select({
        total: sql<number>`count(*)`,
        bots: sql<number>`coalesce(sum(${itemEvents.isBot}), 0)`,
      })
      .from(itemEvents)
      .where(gte(itemEvents.occurredAt, since))
      .get(),

    // People only: a crawler following every link would otherwise top it.
    db
      .select({
        itemId: itemEvents.itemId,
        title: items.title,
        listName: lists.name,
        clicks: sql<number>`count(*)`,
      })
      .from(itemEvents)
      .innerJoin(items, eq(items.id, itemEvents.itemId))
      .innerJoin(lists, eq(lists.id, items.listId))
      .where(
        and(
          eq(itemEvents.eventType, "outbound_click"),
          eq(itemEvents.isBot, false),
          gte(itemEvents.occurredAt, since),
        ),
      )
      .groupBy(itemEvents.itemId)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all(),

    db
      .select({ reason: itemEventDrops.reason, n: sql<number>`sum(${itemEventDrops.count})` })
      .from(itemEventDrops)
      .where(gte(itemEventDrops.day, sinceDay))
      .groupBy(itemEventDrops.reason)
      .all(),

    latestEvents(),
    isTrackingPaused(),
  ]);

  // Every one of the 30 days, oldest first, so a quiet day shows as a gap
  // rather than disappearing.
  const days: DayCounts[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ day, counts: {}, total: 0 });
  }
  const byDay = new Map(days.map((entry) => [entry.day, entry]));
  for (const row of perDay) {
    const entry = byDay.get(row.day);
    if (!entry) continue;
    entry.counts[row.eventType] = row.n;
    entry.total += row.n;
  }

  return {
    enabled: trackingEnabled(),
    paused,
    days,
    total: bots?.total ?? 0,
    botShare: bots && bots.total > 0 ? bots.bots / bots.total : null,
    lastEvent: feed[0] ?? null,
    lastEventAgeMs: feed[0] ? Date.now() - new Date(feed[0].occurredAt).getTime() : null,
    topItems,
    drops: Object.fromEntries(drops.map((row) => [row.reason, row.n])) as Record<string, number>,
    feed,
  };
}
