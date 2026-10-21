import "server-only";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  appSettings,
  itemEventDrops,
  itemEvents,
  items,
  lists,
  users,
  type ItemEventType,
} from "@/db/schema";
import { isBotUserAgent } from "@/lib/bot";
import {
  asksNotToBeTracked,
  parseBatch,
  type DropReason,
  type RejectReason,
} from "@/lib/event-validation";
import { secureCookies } from "@/lib/origin";
import { RateLimiter } from "@/lib/rate-limit";
import { getCurrentUser, readDraftToken } from "@/lib/session";
import { trackingEnabled } from "@/lib/tracking-flag";

/**
 * Everything that writes to item_events. See the table in src/db/schema.ts for
 * what a row may hold, and src/lib/event-validation.ts for what a browser may
 * send.
 *
 * Three things stop a row being written even when tracking is on, checked in
 * this order: the browser asked not to be tracked (Do Not Track or Global
 * Privacy Control), the operator paused it from /admin, or the person looking
 * is the list's own owner. Each is counted, never stored, so the admin screen
 * can show the filters working.
 *
 * Nothing here throws to its caller. Losing an event is always better than
 * failing the page view, the click or the reservation it was counting.
 */

/* -------------------------------------------------------------------------- */
/* Ids                                                                        */
/* -------------------------------------------------------------------------- */

const VISITOR_COOKIE = "unwrap_vid";
const SESSION_COOKIE = "unwrap_sid";
const SESSION_IDLE_SECONDS = 30 * 60;
// 16 random bytes, base64url: 22 characters.
const ID_FORMAT = /^[A-Za-z0-9_-]{22}$/;

const newId = () => randomBytes(16).toString("base64url");

/** `months` calendar months after `date` (before it, when negative). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

const cookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: "lax" as const,
  path: "/",
};

/**
 * This browser's visitor and session ids, issuing either if it is missing.
 * Server Actions and Route Handlers only; it sets cookies.
 *
 * The visitor cookie expires 13 months after it was first set and is never
 * extended, so no id lives longer than that however often someone visits. The
 * session cookie is set again on every event with a 30-minute life, so it
 * lapses after half an hour of nothing and the next event starts a new one.
 *
 * Neither is signed: they authorise nothing, and a forged one only mislabels
 * its sender's own events.
 */
async function trackingIds(): Promise<{ visitorId: string; sessionId: string }> {
  const store = await cookies();

  let visitorId = store.get(VISITOR_COOKIE)?.value;
  if (!visitorId || !ID_FORMAT.test(visitorId)) {
    visitorId = newId();
    store.set(VISITOR_COOKIE, visitorId, {
      ...cookieOptions,
      expires: addMonths(new Date(), 13),
    });
  }

  let sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId || !ID_FORMAT.test(sessionId)) sessionId = newId();
  store.set(SESSION_COOKIE, sessionId, { ...cookieOptions, maxAge: SESSION_IDLE_SECONDS });

  return { visitorId, sessionId };
}

/** The visitor id this browser already has, without issuing one. */
async function existingVisitorId(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return value && ID_FORMAT.test(value) ? value : null;
}

/* -------------------------------------------------------------------------- */
/* The pause switch                                                           */
/* -------------------------------------------------------------------------- */

const PAUSED_KEY = "tracking_paused";
/** A beacon arrives with every page view; the switch is read at most this often. */
const PAUSE_CACHE_MS = 5_000;
let pausedCache: { value: boolean; at: number } | null = null;

export async function isTrackingPaused(): Promise<boolean> {
  if (pausedCache && Date.now() - pausedCache.at < PAUSE_CACHE_MS) return pausedCache.value;
  const row = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, PAUSED_KEY))
    .get();
  const value = row?.value === "1";
  pausedCache = { value, at: Date.now() };
  return value;
}

export async function setTrackingPaused(paused: boolean): Promise<void> {
  const value = paused ? "1" : "0";
  await db
    .insert(appSettings)
    .values({ key: PAUSED_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  pausedCache = null;
}

/* -------------------------------------------------------------------------- */
/* Counting what wasn't stored                                                */
/* -------------------------------------------------------------------------- */

export async function countDrops(counts: Partial<Record<DropReason, number>>): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const rows = Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([reason, n]) => ({ day, reason, count: n! }));
  if (rows.length === 0) return;

  try {
    await db
      .insert(itemEventDrops)
      .values(rows)
      .onConflictDoUpdate({
        target: [itemEventDrops.day, itemEventDrops.reason],
        set: { count: sql`${itemEventDrops.count} + excluded.count` },
      });
  } catch (error) {
    console.error("[tracking] could not count dropped events:", error);
  }
}

/* -------------------------------------------------------------------------- */
/* Who is asking                                                              */
/* -------------------------------------------------------------------------- */

type ListOwnership = { id: string; ownerId: string | null; draftToken: string | null };

/**
 * Which of these lists the person asking owns: by account, or as the browser
 * holding an unclaimed draft. The same two ways in as viewerOwns in
 * src/lib/list-access.ts.
 */
async function ownedAmong(rows: ListOwnership[]): Promise<Set<string>> {
  const [user, draftToken] = await Promise.all([getCurrentUser(), readDraftToken()]);
  return new Set(
    rows
      .filter((list) =>
        list.ownerId === null
          ? draftToken !== null && list.draftToken === draftToken
          : user !== null && list.ownerId === user.id,
      )
      .map((list) => list.id),
  );
}

/** What the request says about itself, reduced to two booleans. */
async function readRequest(webdriver = false): Promise<{ dnt: boolean; isBot: boolean }> {
  const h = await headers();
  return { dnt: asksNotToBeTracked(h), isBot: webdriver || isBotUserAgent(h.get("user-agent")) };
}

/* -------------------------------------------------------------------------- */
/* Events the server saw happen                                               */
/* -------------------------------------------------------------------------- */

export type RecordOutcome = "stored" | "off" | DropReason;

/**
 * Records a click out to a shop or a reservation: events only the server can
 * vouch for. Server Actions and Route Handlers only, because it sets the id
 * cookies.
 */
export async function recordServerEvent(event: {
  type: Extract<ItemEventType, "outbound_click" | "item_claim">;
  list: ListOwnership;
  item: { id: string; kind: string; parentId: string | null };
  properties?: Record<string, string>;
}): Promise<RecordOutcome> {
  try {
    if (!trackingEnabled()) return "off";

    const request = await readRequest();
    let skip: DropReason | null = null;
    if (request.dnt) skip = "dnt";
    else if (await isTrackingPaused()) skip = "paused";
    else if ((await ownedAmong([event.list])).size > 0) skip = "owner";
    if (skip) {
      await countDrops({ [skip]: 1 });
      return skip;
    }

    const ids = await trackingIds();
    await db.insert(itemEvents).values({
      eventType: event.type,
      ...ids,
      listId: event.list.id,
      itemId: event.item.id,
      ideaId: event.item.kind === "idea" ? event.item.id : event.item.parentId,
      properties: event.properties ?? {},
      isBot: request.isBot,
    });
    return "stored";
  } catch (error) {
    console.error(`[tracking] could not record ${event.type}:`, error);
    return "off";
  }
}

/* -------------------------------------------------------------------------- */
/* Events a browser sent                                                      */
/* -------------------------------------------------------------------------- */

/** Per visitor: a burst of 120, then two a second. A list page sends a few dozen. */
const perVisitor = new RateLimiter(120, 2);
/** Everyone at once, per process: what a small instance should ever see. */
const overall = new RateLimiter(3000, 50);

export type IngestResult = {
  stored: number;
  dropped: Partial<Record<DropReason, number>>;
};

const add = (into: Partial<Record<DropReason, number>>, reason: DropReason, n = 1) => {
  if (n > 0) into[reason] = (into[reason] ?? 0) + n;
};

/**
 * Takes a body posted to /api/events and stores what passes. Route Handlers
 * only: it sets the id cookies.
 */
export async function ingestBatch(body: string): Promise<IngestResult | "off"> {
  if (!trackingEnabled()) return "off";

  const dropped: Partial<Record<DropReason, number>> = {};
  const done = async (stored: number): Promise<IngestResult> => {
    await countDrops(dropped);
    return { stored, dropped };
  };

  try {
    const batch = parseBatch(body);
    if (!batch.ok) {
      add(dropped, batch.reason, batch.count);
      return done(0);
    }
    for (const [reason, n] of Object.entries(batch.rejected)) {
      add(dropped, reason as RejectReason, n);
    }

    let events = batch.events;
    if (events.length === 0) return done(0);

    // Before anything is looked up: a flood should cost as little as possible.
    // A browser with no visitor cookie yet is only held to the overall limit,
    // or every first visit would share one bucket.
    const visitor = await existingVisitorId();
    if (
      (visitor !== null && !perVisitor.take(visitor, events.length)) ||
      !overall.take("all", events.length)
    ) {
      add(dropped, "rate_limited", events.length);
      return done(0);
    }

    const request = await readRequest(batch.webdriver);
    if (request.dnt) {
      add(dropped, "dnt", events.length);
      return done(0);
    }
    if (await isTrackingPaused()) {
      add(dropped, "paused", events.length);
      return done(0);
    }

    // Every id has to be real, and the gift has to be on the list it claims.
    const listIds = [...new Set(events.map((event) => event.listId))];
    const itemIds = [
      ...new Set(events.flatMap((event) => [event.itemId, event.ideaId]).filter((id) => id !== undefined)),
    ];

    const [listRows, itemRows] = await Promise.all([
      db
        .select({
          id: lists.id,
          ownerId: lists.ownerId,
          draftToken: lists.draftToken,
          kind: lists.kind,
          ownerBanned: sql<boolean>`${users.bannedAt} is not null`.mapWith(Boolean),
        })
        .from(lists)
        .leftJoin(users, eq(users.id, lists.ownerId))
        .where(inArray(lists.id, listIds))
        .all(),
      itemIds.length === 0
        ? Promise.resolve([])
        : db
            .select({ id: items.id, listId: items.listId, parentId: items.parentId, kind: items.kind })
            .from(items)
            .where(inArray(items.id, itemIds))
            .all(),
    ]);
    const listById = new Map(listRows.map((row) => [row.id, row]));
    const itemById = new Map(itemRows.map((row) => [row.id, row]));

    const rows: (typeof itemEvents.$inferInsert)[] = [];
    const known = events.filter((event) => {
      const list = listById.get(event.listId);
      if (!list || list.ownerBanned) return false;

      if (event.itemId !== undefined && itemById.get(event.itemId)?.listId !== list.id) return false;
      if (event.ideaId !== undefined) {
        const idea = itemById.get(event.ideaId);
        if (!idea || idea.listId !== list.id || idea.kind !== "idea") return false;
      }
      // Tiles on the browse pages are guides, and only guides.
      if (event.type.startsWith("suggestion_") && list.kind !== "guide") return false;
      return true;
    });
    add(dropped, "unknown_ids", events.length - known.length);
    events = known;

    const owned = await ownedAmong(listRows);
    const notOwn = events.filter((event) => !owned.has(event.listId));
    add(dropped, "owner", events.length - notOwn.length);
    events = notOwn;

    if (events.length === 0) return done(0);

    const ids = await trackingIds();
    for (const event of events) {
      const item = event.itemId === undefined ? undefined : itemById.get(event.itemId);
      rows.push({
        eventType: event.type,
        ...ids,
        listId: event.listId,
        itemId: event.itemId ?? null,
        // Worked out here rather than trusted from the browser.
        ideaId:
          event.ideaId ?? (item ? (item.kind === "idea" ? item.id : item.parentId) : null),
        properties: event.props ?? {},
        isBot: request.isBot,
      });
    }

    await db.insert(itemEvents).values(rows);
    return done(rows.length);
  } catch (error) {
    console.error("[tracking] could not ingest a batch:", error);
    return done(0);
  }
}
