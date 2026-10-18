import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  claims,
  items,
  lists,
  priceHistory,
  productChecks,
  type Item,
  type LinkStatus,
} from "@/db/schema";
import { sourceDomain } from "@/lib/outbound";
import { scrapeProductWithTrace } from "@/lib/scrape";

/**
 * Rechecking product links, about once a month, and remembering what they cost.
 *
 * THE RULES:
 *
 * - **A link is checked, not a gift.** The same product can sit on hundreds of
 *   lists once guides are copied, so the unit of work is the URL and every gift
 *   pointing at it shares the answer.
 * - **A typed price is never overwritten.** Only gifts whose price came from the
 *   shop (items.priceSource = "scrape") are moved by a recheck; an owner's own
 *   figure outranks anything we read, the same rule refetchItem keeps.
 * - **Blocked is not dead.** Big retailers turn us away every time (see
 *   docs/referrals-and-product-data.md). Only a 404 or 410, twice running,
 *   calls a link dead; everything else is "couldn't read it", and says nothing
 *   about the product.
 * - **Only links someone still needs.** A gift already claimed, or on a list
 *   whose day has passed, is nobody's business to price. Guides are always in,
 *   because they are read for years.
 *
 * Runs in the background from src/instrumentation.ts, a small batch at a time,
 * and from the admin screen on demand.
 */

/** How long a link is left alone after a check. */
const RECHECK_DAYS = Number(process.env.PRICE_CHECK_DAYS) || 30;
/** At most this many links from one shop per batch, so we never hammer anyone. */
const PER_SHOP = 3;
/** The pause between requests within a batch. */
const PAUSE_MS = 4000;
/** Two 404s in a row, a month apart, is a link that has gone. */
export const DEAD_AFTER = 2;

/* -------------------------------------------------------------------------- */
/* Price history                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Notes a price seen for a link. Writes a row only when it differs from the
 * last one recorded, so history is a list of changes rather than of visits.
 */
export async function recordPrice(
  url: string | null,
  priceCents: number | null,
  currency: string | null,
): Promise<void> {
  if (!url || priceCents === null) return;
  const code = (currency ?? "USD").toUpperCase();

  const last = await db
    .select({ priceCents: priceHistory.priceCents, currency: priceHistory.currency })
    .from(priceHistory)
    .where(eq(priceHistory.url, url))
    .orderBy(desc(priceHistory.observedAt))
    .get();

  if (last && last.priceCents === priceCents && last.currency === code) return;
  await db.insert(priceHistory).values({ url, priceCents, currency: code });
}

/** What changed about a gift's link since it went on the list. */
export type LinkInfo = {
  /**
   * The price when this gift was added, if the shop's price has moved since.
   * Null when it hasn't, when the price was typed by hand, or when we don't know.
   */
  wasCents: number | null;
  /** Two 404s running: the shop says the page is gone. */
  dead: boolean;
};

/**
 * For each gift, whether its price has moved since it was added and whether its
 * link still works — read in two queries for a whole list.
 *
 * "Since it was added" is measured against the newest price recorded at or
 * before the gift's own createdAt, so a gift copied last week compares against
 * last week's price rather than whatever the original was a year ago. A gift
 * older than any history compares against the earliest price we have.
 */
export async function linkInfo(rows: Item[]): Promise<Map<string, LinkInfo>> {
  const urls = [...new Set(rows.map((row) => row.url).filter((url): url is string => !!url))];
  const result = new Map<string, LinkInfo>();
  if (urls.length === 0) return result;

  const [history, checks] = await Promise.all([
    db
      .select()
      .from(priceHistory)
      .where(inArray(priceHistory.url, urls))
      .orderBy(asc(priceHistory.observedAt))
      .all(),
    db.select().from(productChecks).where(inArray(productChecks.url, urls)).all(),
  ]);

  for (const row of rows) {
    if (!row.url) continue;
    const dead = (checks.find((check) => check.url === row.url)?.goneStreak ?? 0) >= DEAD_AFTER;

    let wasCents: number | null = null;
    if (row.priceSource === "scrape" && row.priceCents !== null) {
      const seen = history.filter(
        (entry) => entry.url === row.url && entry.currency === row.currency,
      );
      // A minute's grace: the history row for a new gift is written in the
      // same request, a moment after the gift itself.
      const cutoff = row.createdAt.getTime() + 60_000;
      const baseline =
        seen.filter((entry) => entry.observedAt.getTime() <= cutoff).at(-1) ?? seen[0];
      if (baseline && baseline.priceCents !== row.priceCents) wasCents = baseline.priceCents;
    }

    if (dead || wasCents !== null) result.set(row.id, { wasCents, dead });
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Rechecking                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Links that are due a check, oldest first.
 *
 * A link never checked counts from when it was first added, so a new instance
 * — or this feature arriving on an old one — doesn't try to fetch everything
 * on its first hour.
 */
export async function dueLinks(limit: number): Promise<string[]> {
  const now = Date.now();
  const cutoff = Math.floor((now - RECHECK_DAYS * 86_400_000) / 1000);
  // Yesterday, so a party happening today is still worth a look.
  const today = Math.floor((now - 86_400_000) / 1000);

  const lastSeen = sql<number>`coalesce(max(${productChecks.checkedAt}), min(${items.createdAt}))`;

  const rows = await db
    .select({ url: items.url, lastSeen })
    .from(items)
    .innerJoin(lists, eq(lists.id, items.listId))
    .leftJoin(productChecks, eq(productChecks.url, items.url))
    .where(
      and(
        eq(items.kind, "thing"),
        sql`${items.url} is not null`,
        or(
          eq(lists.kind, "guide"),
          isNull(lists.eventDate),
          sql`${lists.eventDate} >= ${today}`,
        ),
        sql`not exists (select 1 from ${claims} where ${claims.itemId} = ${items.id} and ${claims.releasedAt} is null)`,
      ),
    )
    .groupBy(items.url)
    .having(sql`${lastSeen} < ${cutoff}`)
    .orderBy(asc(lastSeen))
    // Read past the limit so the per-shop cap below still leaves a full batch.
    .limit(limit * 4)
    .all();

  const perShop = new Map<string, number>();
  const picked: string[] = [];
  for (const { url } of rows) {
    if (!url) continue;
    const shop = sourceDomain(url) ?? url;
    const count = perShop.get(shop) ?? 0;
    if (count >= PER_SHOP) continue;
    perShop.set(shop, count + 1);
    picked.push(url);
    if (picked.length >= limit) break;
  }
  return picked;
}

export type CheckOutcome = {
  url: string;
  status: LinkStatus;
  /** The price the shop showed, when we could read one. */
  priceCents: number | null;
  /** How many gifts had their price moved by this check. */
  updated: number;
};

/** Checks one link now and writes down what it found. */
export async function checkLink(url: string): Promise<CheckOutcome> {
  const { result, trace } = await scrapeProductWithTrace(url);

  const status: LinkStatus =
    trace.outcome === "ok"
      ? "ok"
      : trace.outcome === "http-error" && (trace.status === 404 || trace.status === 410)
        ? "gone"
        : "unreadable";

  const previous = await db
    .select()
    .from(productChecks)
    .where(eq(productChecks.url, url))
    .get();

  const row = {
    url,
    checkedAt: new Date(),
    status,
    goneStreak: status === "gone" ? (previous?.goneStreak ?? 0) + 1 : status === "ok" ? 0 : (previous?.goneStreak ?? 0),
    failStreak: status === "unreadable" ? (previous?.failStreak ?? 0) + 1 : 0,
    detail: trace.status !== null ? `${trace.outcome} (${trace.status})` : trace.outcome,
  };

  await db
    .insert(productChecks)
    .values(row)
    .onConflictDoUpdate({ target: productChecks.url, set: row });

  if (status !== "ok" || result.priceCents === null) {
    return { url, status, priceCents: null, updated: 0 };
  }

  const currency = (result.currency ?? "USD").toUpperCase();
  await recordPrice(url, result.priceCents, currency);

  // The shop's figure, onto every gift that took the shop's figure in the
  // first place — and onto gifts that never had a price at all, which is what
  // refetchItem does by hand. Owner-typed prices are left exactly as they are.
  const moved = db
    .update(items)
    .set({ priceCents: result.priceCents, currency, priceSource: "scrape" })
    .where(
      and(
        eq(items.url, url),
        eq(items.kind, "thing"),
        or(
          and(eq(items.priceSource, "scrape"), sql`${items.priceCents} is not ${result.priceCents}`),
          and(isNull(items.priceCents), isNull(items.priceSource)),
        ),
      ),
    )
    .run();

  return { url, status, priceCents: result.priceCents, updated: moved.changes };
}

type RunState = { running: boolean; lastRun: Date | null; lastSummary: string | null };

/**
 * One process-wide record of the batch in flight. On globalThis so a dev-server
 * reload can't start a second batch beside the first.
 */
const state = ((globalThis as unknown as { __priceChecks?: RunState }).__priceChecks ??= {
  running: false,
  lastRun: null,
  lastSummary: null,
});

export function priceCheckState(): Readonly<RunState> {
  return state;
}

/**
 * Checks up to `limit` due links, one at a time with a pause between them.
 * Returns null when a batch is already running, rather than starting another.
 */
export async function runPriceChecks(limit: number): Promise<string | null> {
  if (state.running) return null;
  state.running = true;

  const tally = { ok: 0, gone: 0, unreadable: 0, updated: 0 };
  try {
    const urls = await dueLinks(limit);
    for (const [index, url] of urls.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      try {
        const outcome = await checkLink(url);
        tally[outcome.status] += 1;
        tally.updated += outcome.updated;
      } catch (error) {
        // One bad link is never allowed to stop the rest of the batch.
        console.error(`[price-checks] ${url}:`, error);
        tally.unreadable += 1;
      }
    }

    const summary =
      urls.length === 0
        ? "Nothing was due."
        : `Checked ${urls.length}: ${tally.ok} read, ${tally.gone} gone, ${tally.unreadable} couldn't be read; ${tally.updated} ${tally.updated === 1 ? "price" : "prices"} updated.`;
    console.log(`[price-checks] ${summary}`);
    state.lastSummary = summary;
    return summary;
  } finally {
    state.running = false;
    state.lastRun = new Date();
  }
}

/** How many failed reads in a row before a link is worth an operator's look. */
const UNREADABLE_FLAG = 3;

/**
 * The admin screen's view: how many links there are, how many have been
 * checked, and the ones that need a person — dead, or unreadable for months.
 */
export async function linkHealth() {
  const [tracked, checked, problems] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${items.url})` })
      .from(items)
      .where(and(eq(items.kind, "thing"), sql`${items.url} is not null`))
      .get(),
    db.select({ count: sql<number>`count(*)` }).from(productChecks).get(),
    db
      .select({
        check: productChecks,
        // The outer column is written out in full: in a single-table query Drizzle
        // leaves names unqualified, and productChecks.url would resolve to
        // items.url inside the subquery. See the note in src/app/lists/page.tsx.
        giftCount: sql<number>`(select count(*) from ${items} where ${items.url} = "product_checks"."url")`,
      })
      .from(productChecks)
      .where(
        or(
          sql`${productChecks.goneStreak} >= ${DEAD_AFTER}`,
          sql`${productChecks.failStreak} >= ${UNREADABLE_FLAG}`,
        ),
      )
      .orderBy(desc(productChecks.goneStreak), desc(productChecks.failStreak))
      .limit(100)
      .all(),
  ]);

  return {
    tracked: tracked?.count ?? 0,
    checked: checked?.count ?? 0,
    problems: problems.map(({ check, giftCount }) => ({
      ...check,
      giftCount,
      dead: check.goneStreak >= DEAD_AFTER,
    })),
  };
}
