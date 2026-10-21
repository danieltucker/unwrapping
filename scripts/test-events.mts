/**
 * Event tracking: what a browser may send, which requests count as bots, and
 * the /go redirect that every buy button goes through.
 *
 *   npm run test:events
 *
 * Runs the same modules the route handlers do, against a throwaway SQLite
 * file migrated from drizzle/ like production. Requests are made the way the
 * Santa flow test makes them: a cookie jar and request headers set per call,
 * and the route handler called directly. See scripts/lib/app-hooks.mjs.
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const file = path.join(tmpdir(), `unwrap-events-${process.pid}.db`);
process.env.DATABASE_URL = `file:${file}`;
process.env.DB_AUTO_MIGRATE = "1";
process.env.SESSION_SECRET ??= "test-secret-for-events";
process.env.EVENT_TRACKING = "on";

const { eq, sql } = await import("drizzle-orm");
const { db } = await import("../src/db/index.ts");
const schema = await import("../src/db/schema.ts");
const { parseBatch, validateEvent, MAX_EVENTS_PER_BATCH } = await import("../src/lib/event-validation.ts");
const { isBotUserAgent } = await import("../src/lib/bot.ts");
const { RateLimiter } = await import("../src/lib/rate-limit.ts");
const { buyLink, placed } = await import("../src/lib/tracking-flag.ts");
const tracking = await import("../src/lib/tracking.ts");
const { pruneEvents } = await import("../src/lib/event-retention.ts");
const { createSession } = await import("../src/lib/session.ts");
const go = await import("../src/app/go/[itemId]/route.ts");
const { jar, requestHeaders } = (await import("next/headers")) as unknown as {
  jar: Map<string, string>;
  requestHeaders: Map<string, string>;
};

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail !== undefined) console.log(`      ${JSON.stringify(detail).slice(0, 500)}`);
}
function section(title: string) {
  console.log(`\n--- ${title}`);
}

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

/* -------------------------------------------------------------------------- */
/* Browsers                                                                   */
/* -------------------------------------------------------------------------- */

type Browser = { cookies: Map<string, string>; headers: Record<string, string> };
const browser = (headers: Record<string, string> = { "user-agent": CHROME }): Browser => ({
  cookies: new Map(),
  headers,
});

async function from<T>(who: Browser, fn: () => Promise<T>): Promise<T> {
  jar.clear();
  for (const [name, value] of who.cookies) jar.set(name, value);
  requestHeaders.clear();
  for (const [name, value] of Object.entries(who.headers)) requestHeaders.set(name, value);
  try {
    return await fn();
  } finally {
    who.cookies = new Map(jar);
  }
}

const eventCount = () =>
  db.select({ n: sql<number>`count(*)` }).from(schema.itemEvents).get()!.n;
const drops = () =>
  Object.fromEntries(
    db
      .select({ reason: schema.itemEventDrops.reason, n: sql<number>`sum(${schema.itemEventDrops.count})` })
      .from(schema.itemEventDrops)
      .groupBy(schema.itemEventDrops.reason)
      .all()
      .map((row) => [row.reason, row.n]),
  ) as Record<string, number>;

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const owner = db
  .insert(schema.users)
  .values({ handle: "dana", email: "dana@example.com", name: "Dana Example", passwordHash: "x" })
  .returning()
  .get();
const wishlist = db
  .insert(schema.lists)
  .values({ ownerId: owner.id, slug: "birthday", name: "Birthday", kind: "personal" })
  .returning()
  .get();
const guide = db
  .insert(schema.lists)
  .values({ ownerId: owner.id, slug: "campers", name: "For campers", kind: "guide" })
  .returning()
  .get();

const addItem = (values: Partial<typeof schema.items.$inferInsert> & { listId: string }) =>
  db.insert(schema.items).values({ title: "A gift", ...values }).returning().get();

const amazon = addItem({ listId: wishlist.id, url: "https://www.amazon.com/dp/B000TEST" });
const friendTagged = addItem({ listId: wishlist.id, url: "https://www.amazon.com/dp/B000FRND?tag=friend-20" });
const otherShop = addItem({ listId: wishlist.id, url: "https://shop.example/p/1?colour=red" });
const evil = addItem({ listId: wishlist.id, url: "javascript:alert(1)" });
const cash = addItem({ listId: wishlist.id, kind: "cash", url: null });
const idea = addItem({ listId: wishlist.id, kind: "idea" });
const child = addItem({ listId: wishlist.id, parentId: idea.id, url: "https://shop.example/needles" });
const guideTagged = addItem({ listId: guide.id, url: "https://www.amazon.com/dp/B000GUID?tag=friend-20" });

/* -------------------------------------------------------------------------- */
section("Validation");
/* -------------------------------------------------------------------------- */

const ok = (events: unknown[]) => parseBatch(JSON.stringify({ events }));
const one = (event: unknown) => validateEvent(event);

check("a list view is accepted", typeof one({ type: "list_view", listId: wishlist.id }) === "object");
check(
  "an impression is accepted with its item",
  typeof one({ type: "item_impression", listId: wishlist.id, itemId: amazon.id }) === "object",
);
check("an unknown type is refused", one({ type: "page_view", listId: wishlist.id }) === "unknown_type");
check(
  "outbound_click can't be sent by a browser",
  one({ type: "outbound_click", listId: wishlist.id, itemId: amazon.id }) === "unknown_type",
);
check(
  "item_claim can't be sent by a browser",
  one({ type: "item_claim", listId: wishlist.id, itemId: amazon.id }) === "unknown_type",
);
check("a missing list id is refused", one({ type: "list_view" }) === "bad_ids");
check("a malformed id is refused", one({ type: "list_view", listId: "../../etc" }) === "bad_ids");
check(
  "an id the type doesn't take is refused",
  one({ type: "list_view", listId: wishlist.id, itemId: amazon.id }) === "bad_ids",
);
check(
  "an impression without its item is refused",
  one({ type: "item_impression", listId: wishlist.id }) === "bad_ids",
);
check(
  "an unexpected field is refused",
  one({ type: "list_view", listId: wishlist.id, email: "someone@example.com" }) === "bad_props",
);
check(
  "a property the type doesn't take is refused",
  one({ type: "list_view", listId: wishlist.id, props: { userAgent: CHROME } }) === "bad_props",
);
check(
  "a filter outside the four is refused",
  one({ type: "filter_used", listId: wishlist.id, props: { filter: "<script>" } }) === "bad_props",
);
check(
  "a filter event needs its filter",
  one({ type: "filter_used", listId: wishlist.id }) === "bad_props",
);
check(
  "a known filter is accepted",
  typeof one({ type: "filter_used", listId: wishlist.id, props: { filter: "free" } }) === "object",
);
check(
  "a sample rate outside (0, 1] is refused",
  one({ type: "item_impression", listId: wishlist.id, itemId: amazon.id, props: { sample: 5 } }) === "bad_props",
);
{
  const result = parseBatch("{not json");
  check("malformed JSON refuses the batch", !result.ok && result.reason === "bad_json");
}
{
  const result = parseBatch(JSON.stringify({ events: "nope" }));
  check("a batch without an events array is refused", !result.ok && result.reason === "bad_json");
}
{
  const result = parseBatch(" ".repeat(17 * 1024));
  check("a body over 16KB is refused unread", !result.ok && result.reason === "too_large");
}
{
  const many = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => ({ type: "list_view", listId: wishlist.id }));
  const result = ok(many);
  check("more than 50 events refuses the batch", !result.ok && result.reason === "too_many");
}
{
  const result = ok([
    { type: "list_view", listId: wishlist.id },
    { type: "nonsense", listId: wishlist.id },
    { type: "filter_used", listId: wishlist.id, props: { filter: "bad" } },
  ]);
  check(
    "one bad event refuses only itself",
    result.ok && result.events.length === 1 && result.rejected.unknown_type === 1 && result.rejected.bad_props === 1,
    result,
  );
}

/* -------------------------------------------------------------------------- */
section("Bot filtering");
/* -------------------------------------------------------------------------- */

const people = [
  CHROME,
  SAFARI_IPHONE,
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  // Instagram's in-app browser is a person tapping a link.
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0",
];
const bots = [
  "",
  "-",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "WhatsApp/2.23.20.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/600.2.5 (KHTML, like Gecko) Version/8.0.2 Safari/600.2.5 (Applebot/0.1)",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
  "curl/8.7.1",
  "python-requests/2.32.3",
  "Go-http-client/2.0",
  "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)",
];
for (const ua of people) check(`a person: ${ua.slice(0, 60)}`, !isBotUserAgent(ua));
for (const ua of bots) check(`a bot: ${ua.slice(0, 60) || "(empty)"}`, isBotUserAgent(ua));

/* -------------------------------------------------------------------------- */
section("Rate limiting");
/* -------------------------------------------------------------------------- */
{
  let now = 0;
  const limiter = new RateLimiter(10, 1, () => now);
  check("a burst within capacity passes", limiter.take("a", 10));
  check("the next one doesn't", !limiter.take("a", 1));
  check("another key has its own bucket", limiter.take("b", 1));
  now = 3_000;
  check("tokens come back over time", limiter.take("a", 3) && !limiter.take("a", 1));
}

/* -------------------------------------------------------------------------- */
section("Ingesting what a browser sends");
/* -------------------------------------------------------------------------- */
{
  const guest = browser();
  const before = eventCount();
  const result = await from(guest, () =>
    tracking.ingestBatch(
      JSON.stringify({
        events: [
          { type: "list_view", listId: wishlist.id },
          { type: "item_impression", listId: wishlist.id, itemId: amazon.id },
          { type: "item_impression", listId: wishlist.id, itemId: child.id },
          { type: "filter_used", listId: wishlist.id, props: { filter: "free" } },
        ],
      }),
    ),
  );
  check("a guest's events are stored", result !== "off" && result.stored === 4, result);
  check("four rows written", eventCount() === before + 4);
  check("a visitor cookie is issued", /^[A-Za-z0-9_-]{22}$/.test(guest.cookies.get("unwrap_vid") ?? ""));
  check("a session cookie is issued", /^[A-Za-z0-9_-]{22}$/.test(guest.cookies.get("unwrap_sid") ?? ""));

  const rows = db.select().from(schema.itemEvents).all();
  const childRow = rows.find((row) => row.itemId === child.id);
  check("a gift under an idea is filed under it", childRow?.ideaId === idea.id, childRow);
  check(
    "every row carries the browser's ids",
    rows.every((row) => row.visitorId === guest.cookies.get("unwrap_vid") && row.sessionId === guest.cookies.get("unwrap_sid")),
  );
  check("a browser isn't a bot", rows.every((row) => row.isBot === false));

  const vid = guest.cookies.get("unwrap_vid");
  await from(guest, () => tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })));
  check("the visitor id is kept on the next visit", guest.cookies.get("unwrap_vid") === vid);

  // A session past its 30 idle minutes is a cookie the browser has dropped.
  const sid = guest.cookies.get("unwrap_sid");
  guest.cookies.delete("unwrap_sid");
  await from(guest, () => tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })));
  check(
    "a lapsed session starts a new one under the same visitor",
    guest.cookies.get("unwrap_sid") !== sid && guest.cookies.get("unwrap_vid") === vid,
  );
}
{
  const before = eventCount();
  const crawler = browser({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  await from(crawler, () => tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })));
  const row = db.select().from(schema.itemEvents).where(eq(schema.itemEvents.id, before + 1)).get();
  check("a crawler is stored, flagged as a bot", eventCount() === before + 1 && row?.isBot === true, row);

  const headless = browser();
  await from(headless, () =>
    tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }], webdriver: true })),
  );
  const last = db.select().from(schema.itemEvents).orderBy(sql`id desc`).get();
  check("a browser reporting navigator.webdriver is flagged", last?.isBot === true);
}
{
  const before = eventCount();
  const dropsBefore = drops();
  const dnt = browser({ "user-agent": CHROME, dnt: "1" });
  await from(dnt, () => tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })));
  check("Do Not Track stores nothing", eventCount() === before);
  check("Do Not Track sets no cookie", !dnt.cookies.has("unwrap_vid") && !dnt.cookies.has("unwrap_sid"));
  check("Do Not Track is counted", (drops().dnt ?? 0) === (dropsBefore.dnt ?? 0) + 1);

  const gpc = browser({ "user-agent": CHROME, "sec-gpc": "1" });
  await from(gpc, () => tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })));
  check("Global Privacy Control stores nothing", eventCount() === before);
}
{
  const ownerBrowser = browser();
  await from(ownerBrowser, () => createSession(owner.id));
  const before = eventCount();
  await from(ownerBrowser, () =>
    tracking.ingestBatch(
      JSON.stringify({
        events: [
          { type: "list_view", listId: wishlist.id },
          { type: "item_impression", listId: wishlist.id, itemId: amazon.id },
        ],
      }),
    ),
  );
  check("the owner's own views are skipped", eventCount() === before);
  check("and counted as such", (drops().owner ?? 0) >= 2);
}
{
  const guest = browser();
  const before = eventCount();
  const unknownBefore = drops().unknown_ids ?? 0;
  await from(guest, () =>
    tracking.ingestBatch(
      JSON.stringify({
        events: [
          // A real item, claimed to be on a list it isn't on.
          { type: "item_impression", listId: guide.id, itemId: amazon.id },
          // A well-formed id that doesn't exist.
          { type: "list_view", listId: "00000000-0000-4000-8000-000000000000" },
          // A tile event about a list that isn't a guide.
          { type: "suggestion_impression", listId: wishlist.id, props: { surface: "gifts" } },
          // An "idea" that isn't one.
          { type: "idea_expand", listId: wishlist.id, ideaId: amazon.id },
        ],
      }),
    ),
  );
  check("ids that don't add up are refused", eventCount() === before);
  check("each is counted", (drops().unknown_ids ?? 0) === unknownBefore + 4, drops());

  await from(guest, () =>
    tracking.ingestBatch(
      JSON.stringify({ events: [{ type: "suggestion_click", listId: guide.id, props: { surface: "home" } }] }),
    ),
  );
  check("a tile event about a guide is stored", eventCount() === before + 1);
}
{
  const spammer = browser();
  await from(spammer, () => tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })));
  const batch = JSON.stringify({
    events: Array.from({ length: 50 }, () => ({ type: "list_view", listId: wishlist.id })),
  });
  const results: Awaited<ReturnType<typeof tracking.ingestBatch>>[] = [];
  for (let i = 0; i < 4; i++) results.push(await from(spammer, () => tracking.ingestBatch(batch)));
  const stored = results.map((r) => (r === "off" ? -1 : r.stored));
  check("one visitor is rate limited past its burst", stored[0] === 50 && stored[1] === 50 && stored[2] === 0, stored);
  check("rate limiting is counted", (drops().rate_limited ?? 0) >= 50);
}
{
  await tracking.setTrackingPaused(true);
  const before = eventCount();
  await from(browser(), () => tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })));
  check("paused stores nothing", eventCount() === before);
  check("and says so", (drops().paused ?? 0) >= 1);
  await tracking.setTrackingPaused(false);
}
{
  process.env.EVENT_TRACKING = "off";
  const before = eventCount();
  const result = await from(browser(), () =>
    tracking.ingestBatch(JSON.stringify({ events: [{ type: "list_view", listId: wishlist.id }] })),
  );
  check("with the flag off nothing is stored", result === "off" && eventCount() === before);
  process.env.EVENT_TRACKING = "on";
}

/* -------------------------------------------------------------------------- */
section("Buy links");
/* -------------------------------------------------------------------------- */
{
  check("with tracking on, a buy link goes through /go", buyLink(amazon.id, "https://x.example/", "list") === `/go/${amazon.id}?from=list`);
  check("a gift with no link still has none", buyLink(amazon.id, null, "list") === null);
  check("placement is added to a /go link", placed(`/go/${amazon.id}?from=list`, "photo") === `/go/${amazon.id}?from=list&at=photo`);
  check("placement never touches a shop's own URL", placed("https://shop.example/p", "photo") === "https://shop.example/p");
  process.env.EVENT_TRACKING = "off";
  check("with tracking off, a buy link is the shop's own", buyLink(amazon.id, "https://x.example/", "list") === "https://x.example/");
  process.env.EVENT_TRACKING = "on";
}

/* -------------------------------------------------------------------------- */
section("The /go redirect");
/* -------------------------------------------------------------------------- */

async function visit(who: Browser, itemId: string, query = "?from=list&at=title", method: "GET" | "HEAD" = "GET") {
  const request = new Request(`http://localhost:3000/go/${itemId}${query}`, { method });
  const context = { params: Promise.resolve({ itemId }) };
  return from(who, () => (method === "GET" ? go.GET(request, context) : go.HEAD(request, context)));
}
const lastRow = () => db.select().from(schema.itemEvents).orderBy(sql`id desc`).get();

{
  const guest = browser();
  const before = eventCount();
  const response = await visit(guest, amazon.id);
  const location = response.headers.get("location") ?? "";
  check("redirects with a 302", response.status === 302);
  check("to the product, with our tag added", location === "https://www.amazon.com/dp/B000TEST?tag=unwrapping0b-20", location);
  check("uncached", response.headers.get("cache-control") === "no-store");
  check("without a referrer", response.headers.get("referrer-policy") === "no-referrer");
  check("logs one outbound_click", eventCount() === before + 1);
  const row = lastRow();
  check(
    "with the gift, its list, and where the click came from",
    row?.eventType === "outbound_click" && row.itemId === amazon.id && row.listId === wishlist.id &&
      row.properties.from === "list" && row.properties.at === "title",
    row,
  );
  check("and the browser's own ids", row?.visitorId === guest.cookies.get("unwrap_vid") && row?.sessionId != null);
}
{
  const location = (await visit(browser(), friendTagged.id)).headers.get("location");
  check("a wishlist keeps a friend's tag, as it does today", location === "https://www.amazon.com/dp/B000FRND?tag=friend-20", location);
}
{
  const location = (await visit(browser(), guideTagged.id, "?from=guide&at=button")).headers.get("location");
  check("a guide has a pasted tag replaced with ours, as it does today", location === "https://www.amazon.com/dp/B000GUID?tag=unwrapping0b-20", location);
}
{
  const location = (await visit(browser(), otherShop.id)).headers.get("location");
  check("a shop without a programme gets its URL as stored", location === "https://shop.example/p/1?colour=red", location);
}
{
  const location = (await visit(browser(), child.id, "?from=list&at=child")).headers.get("location");
  check("a gift under an idea redirects", location === "https://shop.example/needles");
  check("and its click is filed under the idea", lastRow()?.ideaId === idea.id);
}
{
  const before = eventCount();
  check("a javascript: link is a 404", (await visit(browser(), evil.id)).status === 404);
  check("a cash gift with no link is a 404", (await visit(browser(), cash.id)).status === 404);
  check("an unknown id is a 404", (await visit(browser(), "00000000-0000-4000-8000-000000000000")).status === 404);
  check("none of them is logged", eventCount() === before);
}
{
  await visit(browser(), amazon.id, "?from=evil&at=%3Cscript%3E");
  const row = lastRow();
  check("an unknown source or placement is dropped, not stored", row !== undefined && Object.keys(row.properties).length === 0, row);
}
{
  const response = await visit(browser({ "user-agent": "facebookexternalhit/1.1" }), amazon.id);
  check("a bot is still redirected", response.status === 302);
  check("and its click is flagged", lastRow()?.isBot === true);
}
{
  const before = eventCount();
  const response = await visit(browser(), amazon.id, "", "HEAD");
  check("HEAD says where the link goes", response.status === 302 && response.headers.get("location")?.includes("tag=unwrapping0b-20") === true);
  check("and logs nothing", eventCount() === before);
}
{
  const before = eventCount();
  const dnt = browser({ "user-agent": CHROME, dnt: "1" });
  const response = await visit(dnt, amazon.id);
  check("Do Not Track still gets to the shop", response.headers.get("location") === "https://www.amazon.com/dp/B000TEST?tag=unwrapping0b-20");
  check("without being logged or given a cookie", eventCount() === before && !dnt.cookies.has("unwrap_vid"));
}
{
  const ownerBrowser = browser();
  await from(ownerBrowser, () => createSession(owner.id));
  const before = eventCount();
  const response = await visit(ownerBrowser, amazon.id);
  check("the owner clicking their own gift gets to the shop", response.status === 302);
  check("without being logged", eventCount() === before);
}
{
  await tracking.setTrackingPaused(true);
  const before = eventCount();
  const response = await visit(browser(), amazon.id);
  check("paused, a click still gets to the shop", response.status === 302);
  check("without being logged", eventCount() === before);
  await tracking.setTrackingPaused(false);

  process.env.EVENT_TRACKING = "off";
  const offResponse = await visit(browser(), amazon.id);
  check("with the flag off, an old /go link still redirects", offResponse.headers.get("location") === "https://www.amazon.com/dp/B000TEST?tag=unwrapping0b-20");
  check("without being logged", eventCount() === before);
  process.env.EVENT_TRACKING = "on";
}
{
  db.update(schema.users).set({ bannedAt: new Date() }).where(eq(schema.users.id, owner.id)).run();
  check("a banned owner's links are a 404", (await visit(browser(), amazon.id)).status === 404);
  db.update(schema.users).set({ bannedAt: null }).where(eq(schema.users.id, owner.id)).run();
}

/* -------------------------------------------------------------------------- */
section("Nothing personal is stored");
/* -------------------------------------------------------------------------- */
{
  const columns = (db.all(sql`select name from pragma_table_info('item_events')`) as { name: string }[])
    .map((row) => row.name)
    .sort();
  const expected = [
    "event_type", "id", "idea_id", "is_bot", "item_id", "list_id", "occurred_at", "properties", "session_id", "visitor_id",
  ];
  check("item_events has exactly the agreed columns", JSON.stringify(columns) === JSON.stringify(expected), columns);

  const everything = JSON.stringify(db.select().from(schema.itemEvents).all());
  check("no user agent text in any row", !everything.includes("Mozilla") && !everything.includes("Googlebot"));
  check("no email or name in any row", !everything.includes("dana@example.com") && !everything.includes("Dana Example"));
  check("no account id in any row", !everything.includes(owner.id));
}

/* -------------------------------------------------------------------------- */
section("Retention");
/* -------------------------------------------------------------------------- */
{
  const now = new Date("2026-10-21T12:00:00Z");
  const old = db
    .insert(schema.itemEvents)
    .values({ eventType: "list_view", listId: wishlist.id, occurredAt: new Date("2025-09-01T00:00:00Z") })
    .returning()
    .get();
  const recent = db
    .insert(schema.itemEvents)
    .values({ eventType: "list_view", listId: wishlist.id, occurredAt: new Date("2025-10-01T00:00:00Z") })
    .returning()
    .get();
  db.insert(schema.itemEventDrops).values({ day: "2025-09-01", reason: "bad_json", count: 3 }).run();

  const result = await pruneEvents(now);
  const exists = (id: number) => db.select().from(schema.itemEvents).where(eq(schema.itemEvents.id, id)).get() !== undefined;
  check("an event older than 13 months is deleted", !exists(old.id));
  check("one inside 13 months is kept", exists(recent.id));
  check("old daily counts go too", result.drops === 1, result);
}
{
  const throwaway = db.insert(schema.lists).values({ ownerId: owner.id, slug: "gone", name: "Gone" }).returning().get();
  db.insert(schema.itemEvents).values({ eventType: "list_view", listId: throwaway.id }).run();
  db.delete(schema.lists).where(eq(schema.lists.id, throwaway.id)).run();
  const left = db.select().from(schema.itemEvents).where(eq(schema.itemEvents.listId, throwaway.id)).all();
  check("deleting a list deletes its events", left.length === 0);
}

/* -------------------------------------------------------------------------- */

// Windows won't delete a database file that is still open.
(globalThis as { __sqlite?: { close(): void } }).__sqlite?.close();
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });

console.log(failures === 0 ? "\nAll passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
