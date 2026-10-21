/**
 * Sorting: every ?sort= option on a list's gifts and on a /gifts shelf, its
 * ties, gifts with no price, reading the address, the links that carry it,
 * sort_used, and the GIFT_SORT flag.
 *
 *   npm run test:sort
 *
 * The list's sorts are pure and checked directly. A shelf sorts in SQL, so
 * that part runs against a throwaway SQLite file migrated from drizzle/ like
 * production, the same way test-prices does. See scripts/lib/app-hooks.mjs.
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const file = path.join(tmpdir(), `unwrap-sort-${process.pid}.db`);
process.env.DATABASE_URL = `file:${file}`;
process.env.DB_AUTO_MIGRATE = "1";
process.env.SESSION_SECRET ??= "test-secret-for-sort";

const { db } = await import("../src/db/index.ts");
const schema = await import("../src/db/schema.ts");
const sorting = await import("../src/lib/sort.ts");
const { giftSortEnabled } = await import("../src/lib/sort-flag.ts");
const { NO_PRICE_FILTER, parsePriceFilter, priceFilterHref } = await import("../src/lib/price.ts");
const { validateEvent } = await import("../src/lib/event-validation.ts");
const { publishedGuides } = await import("../src/lib/guides.ts");

const {
  GIFT_SORTS,
  SHELF_SORTS,
  giftSortControl,
  parseGiftSort,
  parseShelfSort,
  shelfSortControl,
  sortGifts,
  sortLabel,
  sortToParam,
} = sorting;
type GiftSort = (typeof GIFT_SORTS)[number];
type Sortable = import("../src/lib/sort.ts").Sortable;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`      expected ${JSON.stringify(expected)}`);
    console.log(`      actual   ${JSON.stringify(actual)}`);
  }
}
function section(title: string) {
  console.log(`\n--- ${title}`);
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

let made = 0;
/** A gift with every sort key defaulted: position 0, no price, not wanted. */
function gift(title: string, values: Partial<Sortable> = {}): Sortable {
  made += 1;
  return {
    id: `gift-${String(made).padStart(3, "0")}`,
    title,
    position: 0,
    addedAt: 0,
    priceCents: null,
    currency: "USD",
    isMostWanted: false,
    ...values,
  };
}

/**
 * The titles in sorted order. Sorted from the given order and from its
 * reverse, and only answered when both agree, so every check below is also a
 * check that the order doesn't depend on how the rows arrived.
 */
function sorted(items: Sortable[], sort: GiftSort): string[] | string {
  const forward = sortGifts(items, sort).map((item) => item.title);
  const backward = sortGifts([...items].reverse(), sort).map((item) => item.title);
  return JSON.stringify(forward) === JSON.stringify(backward)
    ? forward
    : `unstable: ${forward.join(",")} vs ${backward.join(",")}`;
}

/* -------------------------------------------------------------------------- */
section("Owner's order");
/* -------------------------------------------------------------------------- */

{
  const items = [gift("C", { position: 2 }), gift("A", { position: 0 }), gift("B", { position: 1 })];
  check("by position", sorted(items, "owner"), ["A", "B", "C"]);
  check("the input is left alone", items.map((item) => item.title), ["C", "A", "B"]);

  check(
    "same position: by title",
    sorted([gift("Pegs", { position: 1 }), gift("Mug", { position: 1 }), gift("Axe", { position: 0 })], "owner"),
    ["Axe", "Mug", "Pegs"],
  );

  const twinA = gift("Twin", { position: 3 });
  const twinB = gift("Twin", { position: 3 });
  check(
    "same position and title: by id, the same every time",
    sortGifts([twinB, twinA], "owner").map((item) => item.id),
    [twinA.id, twinB.id],
  );
  check("…from either direction", sorted([twinB, twinA, gift("Zero")], "owner"), ["Zero", "Twin", "Twin"]);
}

/* -------------------------------------------------------------------------- */
section("Top picks first");
/* -------------------------------------------------------------------------- */

{
  const items = [
    gift("Plain 1", { position: 0 }),
    gift("Wanted 3", { position: 3, isMostWanted: true }),
    gift("Plain 2", { position: 2 }),
    gift("Wanted 1", { position: 1, isMostWanted: true }),
  ];
  check("wanted first, each half in the owner's order", sorted(items, "top"), ["Wanted 1", "Wanted 3", "Plain 1", "Plain 2"]);
  check(
    "none wanted: the owner's order",
    sorted([gift("B", { position: 1 }), gift("A", { position: 0 })], "top"),
    ["A", "B"],
  );
  check(
    "wanted at the same position: by title",
    sorted([gift("Zip", { isMostWanted: true }), gift("Ant", { isMostWanted: true }), gift("Mid")], "top"),
    ["Ant", "Zip", "Mid"],
  );
}

/* -------------------------------------------------------------------------- */
section("Price, low to high and high to low");
/* -------------------------------------------------------------------------- */

{
  const items = [
    gift("No price B", { position: 5 }),
    gift("$50", { position: 4, priceCents: 5000 }),
    gift("$10", { position: 3, priceCents: 1000 }),
    gift("No price A", { position: 1 }),
    gift("£5", { position: 0, priceCents: 500, currency: "GBP" }),
    gift("$30 second", { position: 6, priceCents: 3000 }),
    gift("$30 first", { position: 2, priceCents: 3000 }),
  ];
  check(
    "low: cheapest first, no price last",
    sorted(items, "low"),
    ["$10", "$30 first", "$30 second", "$50", "£5", "No price A", "No price B"],
  );
  check(
    "high: dearest first, no price still last",
    sorted(items, "high"),
    ["$50", "$30 first", "$30 second", "$10", "£5", "No price A", "No price B"],
  );
  check(
    "a price in another currency counts as no price, in the owner's order with the rest",
    sorted(items, "low").slice(-3),
    ["£5", "No price A", "No price B"],
  );
  check(
    "a price tie goes to the owner's order in both directions",
    [sorted(items, "low"), sorted(items, "high")].map((order) =>
      (order as string[]).filter((title) => title.startsWith("$30")),
    ),
    [["$30 first", "$30 second"], ["$30 first", "$30 second"]],
  );
  check(
    "same price and position: by title",
    sorted([gift("Zebra", { priceCents: 900 }), gift("Aardvark", { priceCents: 900 })], "high"),
    ["Aardvark", "Zebra"],
  );
  check(
    "$0 is a price, not a missing one",
    sorted([gift("None"), gift("Free", { priceCents: 0 })], "high"),
    ["Free", "None"],
  );

  const unpriced = [gift("C", { position: 2 }), gift("A", { position: 0 }), gift("B", { position: 1 })];
  check("nothing priced: low is the owner's order", sorted(unpriced, "low"), ["A", "B", "C"]);
  check("nothing priced: high is the owner's order", sorted(unpriced, "high"), ["A", "B", "C"]);
}

/* -------------------------------------------------------------------------- */
section("Newest");
/* -------------------------------------------------------------------------- */

{
  const second = 1_760_000_000_000;
  const items = [
    gift("Oldest", { position: 0, addedAt: second - 60_000 }),
    gift("Newest", { position: 3, addedAt: second + 60_000 }),
    // Added in the same second, as copying a list or a quick run of adds does.
    gift("Same second, later spot", { position: 2, addedAt: second }),
    gift("Same second, earlier spot", { position: 1, addedAt: second }),
  ];
  check(
    "newest first; the same second goes to the owner's order",
    sorted(items, "newest"),
    ["Newest", "Same second, earlier spot", "Same second, later spot", "Oldest"],
  );
}

/* -------------------------------------------------------------------------- */
section("A to Z");
/* -------------------------------------------------------------------------- */

{
  const items = [
    gift("banana", { position: 0 }),
    gift("Book 10", { position: 1 }),
    gift("apple", { position: 2 }),
    gift("Book 2", { position: 3 }),
    gift("Cherry", { position: 4 }),
  ];
  check("ignores case, reads numbers as numbers", sorted(items, "az"), ["apple", "banana", "Book 2", "Book 10", "Cherry"]);
  check(
    "the same title in a different case: the owner's order",
    sorted([gift("Mug", { position: 2 }), gift("mug", { position: 1 })], "az"),
    ["mug", "Mug"],
  );
}

/* -------------------------------------------------------------------------- */
section("Every option on one list");
/* -------------------------------------------------------------------------- */

{
  const items = [
    gift("Kettle", { position: 0, priceCents: 4000, addedAt: 3 }),
    gift("Apron", { position: 1, addedAt: 1 }),
    gift("Mixer", { position: 2, priceCents: 25000, addedAt: 2, isMostWanted: true }),
    gift("Ladle", { position: 3, priceCents: 1200, addedAt: 3 }),
  ];
  const expected: Record<GiftSort, string[]> = {
    owner: ["Kettle", "Apron", "Mixer", "Ladle"],
    top: ["Mixer", "Kettle", "Apron", "Ladle"],
    low: ["Ladle", "Kettle", "Mixer", "Apron"],
    high: ["Mixer", "Kettle", "Ladle", "Apron"],
    newest: ["Kettle", "Ladle", "Mixer", "Apron"],
    az: ["Apron", "Kettle", "Ladle", "Mixer"],
  };
  for (const sort of GIFT_SORTS) check(sort, sorted(items, sort), expected[sort]);
}

/* -------------------------------------------------------------------------- */
section("Reading the address");
/* -------------------------------------------------------------------------- */

check("no sort is the owner's order", parseGiftSort({}), "owner");
check("every option reads back", GIFT_SORTS.map((sort) => parseGiftSort({ sort })), [...GIFT_SORTS]);
check("case and spaces don't matter", parseGiftSort({ sort: " LOW " }), "low");
check("the first of a repeated param", parseGiftSort({ sort: ["high", "low"] }), "high");
check("nonsense is the owner's order", parseGiftSort({ sort: "<script>" }), "owner");
check("a shelf's option on a list is the owner's order", parseGiftSort({ sort: "popular" }), "owner");
check("no sort on a shelf is popular", parseShelfSort({}), "popular");
check("every shelf option reads back", SHELF_SORTS.map((sort) => parseShelfSort({ sort })), [...SHELF_SORTS]);
check("a list's owner or top on a shelf is popular", [parseShelfSort({ sort: "owner" }), parseShelfSort({ sort: "top" })], ["popular", "popular"]);

/* -------------------------------------------------------------------------- */
section("The select's options");
/* -------------------------------------------------------------------------- */

{
  const values = (control: { options: readonly { value: string }[] }) => control.options.map((option) => option.value);
  check("a list offers all six, owner's order first", values(giftSortControl("owner", "wishlist")), [...GIFT_SORTS]);
  check("a shelf offers five, popular first and no top picks", values(shelfSortControl("popular")), [...SHELF_SORTS]);
  check("a wishlist says it the way its cards do", sortLabel(giftSortControl("top", "wishlist")), "Most wanted first");
  check("…and so does a guide", sortLabel(giftSortControl("top", "guide")), "Top picks first");
  check("the chosen option comes from the address", giftSortControl(parseGiftSort({ sort: "newest" }), "guide").current, "newest");
  check("the default is never written", sortToParam(giftSortControl("owner", "wishlist")), null);
  check("…on a shelf either", sortToParam(shelfSortControl("popular")), null);
  check("anything else is", sortToParam(giftSortControl("az", "wishlist")), "az");
  check("no control, nothing written", sortToParam(null), null);
}

/* -------------------------------------------------------------------------- */
section("Links that carry the sort");
/* -------------------------------------------------------------------------- */

{
  const page = "/lists/dana/birthday";
  const range = { minCents: 2500, maxCents: 5000, includeUnpriced: false };
  check("a sort alone", priceFilterHref(page, NO_PRICE_FILTER, "low"), `${page}?sort=low`);
  check("a chip keeps the sort", priceFilterHref(page, range, "high"), `${page}?min=25&max=50&sort=high`);
  check("the default sort is the bare path", priceFilterHref(page, NO_PRICE_FILTER, null), page);
  const params = Object.fromEntries(new URL(priceFilterHref(page, range, "newest"), "https://x").searchParams);
  check("reads back as the same filter and sort", [parsePriceFilter(params), parseGiftSort(params)], [range, "newest"]);
}

/* -------------------------------------------------------------------------- */
section("sort_used");
/* -------------------------------------------------------------------------- */

{
  const listId = crypto.randomUUID();
  const event = (sort: string) => validateEvent({ type: "sort_used", listId, props: { sort } });
  check("every list option is accepted", GIFT_SORTS.map((sort) => typeof event(sort)), Array(GIFT_SORTS.length).fill("object"));
  check("a shelf's popular is not: shelves aren't tracked", event("popular"), "bad_props");
  check("nor is anything else", event("price"), "bad_props");
  check("the sort is required", validateEvent({ type: "sort_used", listId }), "bad_props");
}

/* -------------------------------------------------------------------------- */
section("The flag");
/* -------------------------------------------------------------------------- */

{
  const flag = (value: string | undefined) => {
    if (value === undefined) delete process.env.GIFT_SORT;
    else process.env.GIFT_SORT = value;
    return giftSortEnabled();
  };
  check("unset is on", flag(undefined), true);
  check("empty is on", flag(""), true);
  check("on, 1 and true are on", flag("on") && flag(" ON ") && flag("1") && flag("true"), true);
  check("off, 0 and false are off", flag("off") || flag("0") || flag("false"), false);
  check("a typo is off", flag("onn"), false);
  delete process.env.GIFT_SORT;
}

/* -------------------------------------------------------------------------- */
section("Sorting a shelf");
/* -------------------------------------------------------------------------- */

{
  const owner = db
    .insert(schema.users)
    .values({ handle: "dana", email: "dana@example.com", name: "Dana Example", passwordHash: "x" })
    .returning()
    .get();
  const category = db
    .insert(schema.categories)
    .values({ slug: "campers", name: "Campers", emoji: "⛺" })
    .returning()
    .get();
  const now = Math.floor(Date.now() / 1000) * 1000;
  const guide = (name: string, ageSeconds: number, copies: number, prices: (number | null)[]) => {
    const list = db
      .insert(schema.lists)
      .values({
        ownerId: owner.id,
        slug: name.toLowerCase(),
        name,
        kind: "guide",
        categoryId: category.id,
        publishedAt: new Date(now - ageSeconds * 1000),
      })
      .returning()
      .get();
    for (const priceCents of prices) {
      db.insert(schema.items).values({ listId: list.id, title: "A gift", priceCents }).run();
    }
    // Copies are other people's lists that point back at this one.
    for (let i = 0; i < copies; i += 1) {
      db.insert(schema.lists)
        .values({ ownerId: owner.id, slug: `${name.toLowerCase()}-copy-${i}`, name: "Copy", copiedFromListId: list.id })
        .run();
    }
    return list;
  };

  guide("Bravo", 300, 0, [3000, 9000]);
  guide("alpha", 200, 2, [5000]);
  const charlie = guide("Charlie", 100, 0, [null]);
  // Nothing comparable: a price in pounds and an idea count as no price.
  db.insert(schema.items).values({ listId: charlie.id, title: "Pounds", priceCents: 100, currency: "GBP" }).run();
  db.insert(schema.items).values({ listId: charlie.id, title: "An idea", kind: "idea", priceCents: 1 }).run();
  // Published in the same second as Charlie, and cheapest-equal with Bravo.
  guide("Delta", 100, 1, [3000]);

  const shelf = async (order: (typeof SHELF_SORTS)[number], extra: Parameters<typeof publishedGuides>[0] = {}) =>
    (await publishedGuides({ categoryId: category.id, limit: 60, order, ...extra })).map((g) => g.name);

  check("popular: most copied, then newest", await shelf("popular"), ["alpha", "Delta", "Charlie", "Bravo"]);
  check(
    "low: by the cheapest gift; a tie goes to the more popular; no price last",
    await shelf("low"),
    ["Delta", "Bravo", "alpha", "Charlie"],
  );
  check("high: no price still last", await shelf("high"), ["alpha", "Delta", "Bravo", "Charlie"]);
  check("newest: the same second goes to the more popular", await shelf("newest"), ["Delta", "Charlie", "alpha", "Bravo"]);
  check("A to Z ignores case", await shelf("az"), ["alpha", "Bravo", "Charlie", "Delta"]);

  const range = { minCents: 5000, maxCents: 10000, includeUnpriced: false };
  check("filtered, low goes by the cheapest gift in the range", await shelf("low", { price: range }), ["alpha", "Bravo"]);
  check("filtered, high too", await shelf("high", { price: range }), ["Bravo", "alpha"]);

  check("the shelf is cut after sorting, not before", await shelf("az", { limit: 2 }), ["alpha", "Bravo"]);
  check("…which differs from the popular cut", await shelf("popular", { limit: 2 }), ["alpha", "Delta"]);
  check(
    "every order is repeatable",
    await Promise.all(SHELF_SORTS.map(async (order) => JSON.stringify(await shelf(order)) === JSON.stringify(await shelf(order)))),
    Array(SHELF_SORTS.length).fill(true),
  );
}

/* -------------------------------------------------------------------------- */

// Windows won't delete a database file that is still open.
(globalThis as { __sqlite?: { close(): void } }).__sqlite?.close();
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
