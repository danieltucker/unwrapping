import "server-only";

import {
  and,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  max,
  min,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { itemEventDrops, itemEvents, items, lists, type ItemEventType } from "@/db/schema";
import { isTrackingPaused } from "@/lib/tracking";
import { trackingEnabled } from "@/lib/tracking-flag";
import { DEFAULT_FILTER, isFocused, type TrackingFilter } from "@/lib/tracking-filter";

/**
 * What /admin/analytics shows about event tracking: enough to tell at a glance
 * that it is switched on, that events are arriving, and that the filters are
 * doing their job — and, narrowed down, what one visitor did. Counts and ids
 * only, plus the names of the lists and gifts they were about; see the
 * item_events table for why there is nothing else to show.
 */

export type DayCounts = { day: string; counts: Partial<Record<ItemEventType, number>>; total: number };

export type FeedEvent = {
  id: number;
  occurredAt: string;
  eventType: ItemEventType;
  listId: string | null;
  listName: string | null;
  itemId: string | null;
  itemTitle: string | null;
  ideaId: string | null;
  visitorId: string | null;
  sessionId: string | null;
  properties: Record<string, string | number | boolean>;
  isBot: boolean;
};

/** The live feed's length, and a timeline's when narrowed to one visitor or session. */
const FEED_LIMIT = 50;
const TIMELINE_LIMIT = 500;

/** Midnight UTC at the start of the window, so the first day is a whole one. */
function windowStart(days: number): Date {
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  return since;
}

/**
 * The filter as SQL: everything but the time window, which the drops table
 * shares and so is applied by each query itself.
 */
function filterConditions(filter: TrackingFilter): SQL[] {
  const conditions: SQL[] = [];
  if (filter.bots === "hide") conditions.push(eq(itemEvents.isBot, false));
  if (filter.bots === "only") conditions.push(eq(itemEvents.isBot, true));
  if (filter.types.length > 0) conditions.push(inArray(itemEvents.eventType, filter.types));
  if (filter.visitor) conditions.push(eq(itemEvents.visitorId, filter.visitor));
  if (filter.session) conditions.push(eq(itemEvents.sessionId, filter.session));
  if (filter.list) conditions.push(eq(itemEvents.listId, filter.list));
  if (filter.hide.length > 0) {
    // `not in` alone would also drop every row with no visitor id.
    conditions.push(or(isNull(itemEvents.visitorId), not(inArray(itemEvents.visitorId, filter.hide)))!);
  }
  return conditions;
}

/**
 * The newest events first, filtered. Shared by the page and its live feed.
 * Narrowed to one visitor or session it is their timeline, so it reaches
 * further back.
 */
export async function latestEvents(filter: TrackingFilter = DEFAULT_FILTER): Promise<FeedEvent[]> {
  const rows = await db
    .select({
      id: itemEvents.id,
      occurredAt: itemEvents.occurredAt,
      eventType: itemEvents.eventType,
      listId: itemEvents.listId,
      listName: lists.name,
      itemId: itemEvents.itemId,
      itemTitle: items.title,
      ideaId: itemEvents.ideaId,
      visitorId: itemEvents.visitorId,
      sessionId: itemEvents.sessionId,
      properties: itemEvents.properties,
      isBot: itemEvents.isBot,
    })
    .from(itemEvents)
    .leftJoin(lists, eq(lists.id, itemEvents.listId))
    .leftJoin(items, eq(items.id, itemEvents.itemId))
    .where(and(gte(itemEvents.occurredAt, windowStart(filter.days)), ...filterConditions(filter)))
    .orderBy(desc(itemEvents.id))
    .limit(isFocused(filter) ? TIMELINE_LIMIT : FEED_LIMIT)
    .all();
  return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
}

/** Ages rather than dates, worked out here: the page can't read the clock while it renders. */
export type VisitorRow = {
  visitorId: string;
  events: number;
  sessions: number;
  lists: number;
  botEvents: number;
  lastSeenAgoMs: number;
};

export type VisitorSummary = VisitorRow & { firstSeenAgoMs: number };

export async function trackingOverview(filter: TrackingFilter = DEFAULT_FILTER) {
  const since = windowStart(filter.days);
  const sinceDay = since.toISOString().slice(0, 10);
  const where = and(gte(itemEvents.occurredAt, since), ...filterConditions(filter));

  const visitorColumns = {
    events: sql<number>`count(*)`,
    sessions: countDistinct(itemEvents.sessionId),
    lists: countDistinct(itemEvents.listId),
    botEvents: sql<number>`coalesce(sum(${itemEvents.isBot}), 0)`,
    lastSeen: max(itemEvents.occurredAt),
  };

  const [perDay, bots, topItems, visitors, focused, drops, feed, paused] = await Promise.all([
    db
      .select({
        day: sql<string>`date(${itemEvents.occurredAt}, 'unixepoch')`,
        eventType: itemEvents.eventType,
        n: sql<number>`count(*)`,
      })
      .from(itemEvents)
      .where(where)
      .groupBy(sql`1`, itemEvents.eventType)
      .all(),

    db
      .select({
        total: sql<number>`count(*)`,
        bots: sql<number>`coalesce(sum(${itemEvents.isBot}), 0)`,
      })
      .from(itemEvents)
      .where(where)
      .get(),

    // People only unless bots were asked for: a crawler following every link
    // would otherwise top it.
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
          where,
          eq(itemEvents.eventType, "outbound_click"),
          filter.bots === "all" ? eq(itemEvents.isBot, false) : undefined,
        ),
      )
      .groupBy(itemEvents.itemId)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all(),

    // The busiest visitors: where a bot the user-agent check missed shows up,
    // as one id with hundreds of events. Not asked for when looking at one.
    filter.visitor
      ? Promise.resolve([])
      : db
          .select({ visitorId: itemEvents.visitorId, ...visitorColumns })
          .from(itemEvents)
          .where(and(where, sql`${itemEvents.visitorId} is not null`))
          .groupBy(itemEvents.visitorId)
          .orderBy(desc(sql`count(*)`))
          .limit(10)
          .all(),

    filter.visitor
      ? db
          .select({ ...visitorColumns, firstSeen: min(itemEvents.occurredAt) })
          .from(itemEvents)
          .where(where)
          .get()
      : Promise.resolve(undefined),

    db
      .select({ reason: itemEventDrops.reason, n: sql<number>`sum(${itemEventDrops.count})` })
      .from(itemEventDrops)
      .where(gte(itemEventDrops.day, sinceDay))
      .groupBy(itemEventDrops.reason)
      .all(),

    latestEvents(filter),
    isTrackingPaused(),
  ]);

  // Every day in the window, oldest first, so a quiet day shows as a gap
  // rather than disappearing.
  const days: DayCounts[] = [];
  for (let i = filter.days - 1; i >= 0; i--) {
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

  const now = Date.now();
  const visitor: VisitorSummary | null =
    filter.visitor && focused && focused.events > 0 && focused.lastSeen && focused.firstSeen
      ? {
          visitorId: filter.visitor,
          events: focused.events,
          sessions: focused.sessions,
          lists: focused.lists,
          botEvents: focused.botEvents,
          lastSeenAgoMs: now - focused.lastSeen.getTime(),
          firstSeenAgoMs: now - focused.firstSeen.getTime(),
        }
      : null;

  return {
    enabled: trackingEnabled(),
    paused,
    filter,
    days,
    total: bots?.total ?? 0,
    botShare: bots && bots.total > 0 ? bots.bots / bots.total : null,
    lastEvent: feed[0] ?? null,
    lastEventAgeMs: feed[0] ? Date.now() - new Date(feed[0].occurredAt).getTime() : null,
    topItems,
    topVisitors: visitors.flatMap(({ visitorId, lastSeen, ...counts }): VisitorRow[] =>
      visitorId && lastSeen ? [{ ...counts, visitorId, lastSeenAgoMs: now - lastSeen.getTime() }] : [],
    ),
    visitor,
    drops: Object.fromEntries(drops.map((row) => [row.reason, row.n])) as Record<string, number>,
    feed,
  };
}
