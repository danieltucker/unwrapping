/**
 * Prices: reading what an owner types, the bands, an idea's range, and the
 * price filter on public lists and /gifts shelves, with its PRICE_FILTER flag.
 *
 *   npm run test:prices
 *
 * The pure rules are checked directly. The parts that touch the database —
 * the add and edit actions, and the SQL a shelf filters guides with — run
 * against a throwaway SQLite file migrated from drizzle/ like production,
 * the same way test-events does. See scripts/lib/app-hooks.mjs.
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const file = path.join(tmpdir(), `unwrap-prices-${process.pid}.db`);
process.env.DATABASE_URL = `file:${file}`;
process.env.DB_AUTO_MIGRATE = "1";
process.env.SESSION_SECRET ??= "test-secret-for-prices";

const { eq } = await import("drizzle-orm");
const { db } = await import("../src/db/index.ts");
const schema = await import("../src/db/schema.ts");
const price = await import("../src/lib/price.ts");
const { priceFilterEnabled } = await import("../src/lib/price-filter-flag.ts");
const { validateEvent } = await import("../src/lib/event-validation.ts");
const { publishedGuides } = await import("../src/lib/guides.ts");
const { createSession } = await import("../src/lib/session.ts");
const { addGift } = await import("../src/app/lists/[handle]/[slug]/manage/add/actions.ts");
const { updateItem } = await import("../src/app/lists/[handle]/[slug]/manage/items/[itemId]/edit/actions.ts");
const { jar } = (await import("next/headers")) as unknown as { jar: Map<string, string> };

const {
  parsePriceInput,
  priceBand,
  ideaPriceRange,
  parsePriceFilter,
  matchesPriceFilter,
  activeChip,
  priceFilterHref,
  filterEventValue,
  formatAboutPrice,
  formatAboutRange,
  priceText,
  isPriceFilterActive,
  PRICE_CHIPS,
} = price;

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
section("Reading a typed price");
/* -------------------------------------------------------------------------- */

const parsed = (raw: string) => parsePriceInput(raw);

check("$29.99", parsed("$29.99"), { cents: 2999, label: null });
check("a bare number", parsed("29.99"), { cents: 2999, label: null });
check("whole dollars", parsed("$40"), { cents: 4000, label: null });
check("a currency code", parsed("USD 40"), { cents: 4000, label: null });
check("empty is no price", parsed("   "), { cents: null, label: null });
check("About $40 keeps its words", parsed("About $40"), { cents: 4000, label: "About $40" });
check("a range files under its low end", parsed("$20 to $30"), { cents: 2000, label: "$20 to $30" });
check("a dashed range too", parsed("$20-$30"), { cents: 2000, label: "$20-$30" });
check("a range written high to low", parsed("$30 to $20"), { cents: 2000, label: "$30 to $20" });
check("from $35", parsed("from $35"), { cents: 3500, label: "from $35" });
check("the marked number wins: 2 for $30", parsed("2 for $30"), { cents: 3000, label: "2 for $30" });
check("1,299 is a thousand, not $1.30", parsed("1,299"), { cents: 129900, label: null });
check("$1,299.50", parsed("$1,299.50"), { cents: 129950, label: null });
check("12,50 as a decimal comma", parsed("12,50"), { cents: 1250, label: null });
check("spaces inside are tidied", parsed("  from   $35 "), { cents: 3500, label: "from $35" });
check("no number at all", parsed("ask me"), null);
check("nonsense commas", parsed("1,2345"), null);
check("absurdly expensive", parsed("$2,000,000"), null);
check("words too long to be a price", parsed(`from $35 ${"and then some ".repeat(4)}`), null);

/* -------------------------------------------------------------------------- */
section("Showing a price");
/* -------------------------------------------------------------------------- */

check("about, then the number", formatAboutPrice(2999), "about $29.99");
check("whole amounts drop the cents", formatAboutPrice(4000), "about $40");
check("a range", formatAboutRange(1200, 8000), "about $12 – $80");
check("a range of one", formatAboutRange(1200, 1200), "about $12");
check("the owner's words win", priceText({ priceCents: 3500, priceLabel: "from $35" }), "from $35");
check("otherwise about", priceText({ priceCents: 3500, priceLabel: null }), "about $35");
check("nothing for no price", priceText({ priceCents: null, priceLabel: null }), null);

/* -------------------------------------------------------------------------- */
section("Bands");
/* -------------------------------------------------------------------------- */

check("no price", priceBand(null), "none");
check("free", priceBand(0), "under_25");
check("$24.99", priceBand(2499), "under_25");
check("$25.00 starts the next band", priceBand(2500), "25_50");
check("$49.99", priceBand(4999), "25_50");
check("$50.00", priceBand(5000), "50_100");
check("$99.99", priceBand(9999), "50_100");
check("$100.00", priceBand(10000), "100_up");
check("$2,500", priceBand(250000), "100_up");
check(
  "the chips are the bands, in order",
  PRICE_CHIPS.map((chip) => [chip.band, chip.label]),
  [
    ["under_25", "Under $25"],
    ["25_50", "$25 to $50"],
    ["50_100", "$50 to $100"],
    ["100_up", "$100 and up"],
  ],
);
check(
  "every chip's range holds exactly its band's prices",
  PRICE_CHIPS.every((chip) =>
    [0, 2499, 2500, 4999, 5000, 9999, 10000, 50000].every(
      (cents) =>
        matchesPriceFilter(
          { priceCents: cents, currency: "USD" },
          { minCents: chip.minCents, maxCents: chip.maxCents, includeUnpriced: false },
        ) === (priceBand(cents) === chip.band),
    ),
  ),
  true,
);

/* -------------------------------------------------------------------------- */
section("An idea's range");
/* -------------------------------------------------------------------------- */

const usd = (priceCents: number | null) => ({ priceCents, currency: "USD" });
check("low to high from its presents", ideaPriceRange([usd(4000), usd(1200), usd(null), usd(2500)]), {
  minCents: 1200,
  maxCents: 4000,
});
check("none priced", ideaPriceRange([usd(null)]), null);
check("no presents", ideaPriceRange([]), null);
check(
  "another currency doesn't count",
  ideaPriceRange([usd(3000), { priceCents: 100, currency: "GBP" }]),
  { minCents: 3000, maxCents: 3000 },
);

/* -------------------------------------------------------------------------- */
section("Reading the filter from the address");
/* -------------------------------------------------------------------------- */

check("nothing", parsePriceFilter({}), { minCents: null, maxCents: null, includeUnpriced: false });
check("min and max", parsePriceFilter({ min: "25", max: "50" }), {
  minCents: 2500,
  maxCents: 5000,
  includeUnpriced: false,
});
check("cents and a dollar sign", parsePriceFilter({ min: "$19.50" }).minCents, 1950);
check("the wrong way round is swapped", parsePriceFilter({ min: "50", max: "25" }), {
  minCents: 2500,
  maxCents: 5000,
  includeUnpriced: false,
});
check("garbage is ignored, not refused", parsePriceFilter({ min: "lots", max: "-5" }), {
  minCents: null,
  maxCents: null,
  includeUnpriced: false,
});
check("empty boxes from the form", parsePriceFilter({ min: "", max: "" }).minCents, null);
check("a repeated param takes the first", parsePriceFilter({ max: ["30", "90"] }).maxCents, 3000);
check("max=0 means no max", parsePriceFilter({ max: "0" }).maxCents, null);
check("unpriced=1", parsePriceFilter({ min: "25", unpriced: "1" }).includeUnpriced, true);
check("unpriced=on, as a checkbox sends it", parsePriceFilter({ min: "25", unpriced: "on" }).includeUnpriced, true);
check("unpriced=yes isn't on", parsePriceFilter({ min: "25", unpriced: "yes" }).includeUnpriced, false);
check("active with a max only", isPriceFilterActive(parsePriceFilter({ max: "25" })), true);
check("not active with unpriced alone", isPriceFilterActive(parsePriceFilter({ unpriced: "1" })), false);

/* -------------------------------------------------------------------------- */
section("Filtering");
/* -------------------------------------------------------------------------- */

const range = (min: number | null, max: number | null, includeUnpriced = false) => ({
  minCents: min,
  maxCents: max,
  includeUnpriced,
});
const gifts = [usd(1000), usd(2500), usd(4999), usd(5000), usd(12000), usd(null), { priceCents: 3000, currency: "GBP" }];
const kept = (filter: ReturnType<typeof range>) =>
  gifts.filter((gift) => matchesPriceFilter(gift, filter)).map((gift) => `${gift.priceCents}${gift.currency === "USD" ? "" : gift.currency}`);

check("no filter keeps everything, unpriced too", kept(range(null, null)), ["1000", "2500", "4999", "5000", "12000", "null", "3000GBP"]);
check("under $25", kept(range(null, 2500)), ["1000"]);
check("$25 to $50: min in, max out", kept(range(2500, 5000)), ["2500", "4999"]);
check("$100 and up", kept(range(10000, null)), ["12000"]);
check("unpriced is out by default once filtering", kept(range(2500, 5000)).includes("null"), false);
check("…and back in when asked", kept(range(2500, 5000, true)), ["2500", "4999", "null", "3000GBP"]);
check("another currency counts as unpriced", kept(range(0, 100000)).includes("3000GBP"), false);

/* -------------------------------------------------------------------------- */
section("Links and chips");
/* -------------------------------------------------------------------------- */

const page = "/lists/dana/birthday";
check("no filter is the bare path", priceFilterHref(page, range(null, null, true)), page);
check("a chip's link", priceFilterHref(page, range(2500, 5000)), `${page}?min=25&max=50`);
check("cents survive", priceFilterHref(page, range(1950, null)), `${page}?min=19.50`);
check("unpriced only while filtering", priceFilterHref(page, range(null, 2500, true)), `${page}?max=25&unpriced=1`);
check(
  "a link reads back as the same filter",
  parsePriceFilter(Object.fromEntries(new URL(priceFilterHref(page, range(1950, 5000, true)), "https://x").searchParams)),
  range(1950, 5000, true),
);
check("the active chip", activeChip(range(2500, 5000)), "25_50");
check("a custom range is no chip", activeChip(range(2000, 5000)), null);
check("no filter, no chip", activeChip(range(null, null)), null);
check("event for a chip", filterEventValue(range(null, 2500)), "price_under_25");
check("event for a custom range", filterEventValue(range(1000, 3000)), "price_custom");
check("event for clearing", filterEventValue(range(null, null)), "all");
check(
  "every event value is one the server accepts",
  ["all", "price_custom", ...PRICE_CHIPS.map((chip) => `price_${chip.band}`)].map((filter) =>
    typeof validateEvent({ type: "filter_used", listId: crypto.randomUUID(), props: { filter } }),
  ),
  Array(6).fill("object"),
);

/* -------------------------------------------------------------------------- */
section("The flag");
/* -------------------------------------------------------------------------- */

{
  const flag = (value: string | undefined) => {
    if (value === undefined) delete process.env.PRICE_FILTER;
    else process.env.PRICE_FILTER = value;
    return priceFilterEnabled();
  };
  check("unset is on", flag(undefined), true);
  check("empty is on", flag(""), true);
  check("on, 1 and true are on", flag("on") && flag(" ON ") && flag("1") && flag("true"), true);
  check("off, 0 and false are off", flag("off") || flag("0") || flag("false"), false);
  check("a typo is off", flag("onn"), false);
  delete process.env.PRICE_FILTER;
}

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
const category = db
  .insert(schema.categories)
  .values({ slug: "campers", name: "Campers", emoji: "⛺" })
  .returning()
  .get();
const guide = (slug: string) =>
  db
    .insert(schema.lists)
    .values({ ownerId: owner.id, slug, name: slug, kind: "guide", categoryId: category.id, publishedAt: new Date() })
    .returning()
    .get();
const addItem = (values: Partial<typeof schema.items.$inferInsert> & { listId: string }) =>
  db.insert(schema.items).values({ title: "A gift", ...values }).returning().get();

/* -------------------------------------------------------------------------- */
section("The add and edit forms");
/* -------------------------------------------------------------------------- */

jar.clear();
await createSession(owner.id);

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ handle: "dana", key: "birthday", ...fields })) data.set(key, value);
  return data;
};
const latest = () =>
  db.select().from(schema.items).where(eq(schema.items.listId, wishlist.id)).all().at(-1)!;

{
  check("a range is accepted", await addGift({}, form({ title: "Tent pegs", price: "$20 to $30" })), { ok: true });
  const pegs = latest();
  check("…stored as its low end, words kept", [pegs.priceCents, pegs.priceLabel, pegs.priceSource], [2000, "$20 to $30", "owner"]);

  check("1,299 through the form", await addGift({}, form({ title: "Kayak", price: "1,299" })), { ok: true });
  check("…is $1,299 and has no label", [latest().priceCents, latest().priceLabel], [129900, null]);

  check("a shop price left alone", await addGift({}, form({ title: "Lamp", url: "https://shop.example/lamp", price: "68.00", scrapedPrice: "6800" })), { ok: true });
  check("…stays the shop's", [latest().priceCents, latest().priceSource, latest().priceLabel], [6800, "scrape", null]);

  const refused = await addGift({}, form({ title: "Mystery", price: "ask me" }));
  check("no number is refused, in words", refused, { error: price.PRICE_ERROR });

  check("an idea never keeps a price", await addGift({}, form({ title: "Knitting", kind: "idea", price: "$40" })), { ok: true });
  check("…none stored", [latest().priceCents, latest().priceLabel], [null, null]);

  const edit = (itemId: string, priceText: string) =>
    updateItem({}, form({ itemId, title: "Tent pegs", price: priceText, quantity: "1" }));
  const pegsId = pegs.id;
  const reread = () => db.select().from(schema.items).where(eq(schema.items.id, pegsId)).get()!;

  check("editing to plain words", await edit(pegsId, "from $35"), { ok: true });
  check("…moves the number and the words", [reread().priceCents, reread().priceLabel], [3500, "from $35"]);
  check("editing to a plain number", await edit(pegsId, "29.99"), { ok: true });
  check("…drops the words", [reread().priceCents, reread().priceLabel], [2999, null]);
  check("emptying the box", await edit(pegsId, ""), { ok: true });
  check("…removes the price", [reread().priceCents, reread().priceLabel, reread().priceSource], [null, null, null]);
}

/* -------------------------------------------------------------------------- */
section("A shelf filtered by price");
/* -------------------------------------------------------------------------- */

{
  const cheap = guide("cheap");
  addItem({ listId: cheap.id, priceCents: 1500 });
  addItem({ listId: cheap.id, priceCents: 2000 });
  addItem({ listId: cheap.id, priceCents: 8000 });

  const pricey = guide("pricey");
  addItem({ listId: pricey.id, priceCents: 25000 });
  // An idea "under" the range must not let the guide in: ideas have no price.
  addItem({ listId: pricey.id, kind: "idea" });

  const unpriced = guide("unpriced");
  addItem({ listId: unpriced.id, priceCents: null });
  addItem({ listId: unpriced.id, priceCents: 1000, currency: "GBP" });

  const shelf = async (filter?: ReturnType<typeof range>) =>
    (await publishedGuides({ categoryId: category.id, limit: 60, price: filter }))
      .map((g) => `${g.name}:${g.priceMatches}`)
      .sort();

  check("unfiltered: everything, no counts", await shelf(), ["cheap:null", "pricey:null", "unpriced:null"]);
  check("under $25: only the cheap one, with 2 in range", await shelf(range(null, 2500)), ["cheap:2"]);
  check("$100 and up", await shelf(range(10000, null)), ["pricey:1"]);
  check("with unpriced: the unpriced guide comes in", await shelf(range(null, 2500, true)), ["cheap:2", "unpriced:2"]);
  check("a range nobody has", await shelf(range(3000, 5000)), []);
  check("an inactive filter is no filter", await shelf(range(null, null, true)), ["cheap:null", "pricey:null", "unpriced:null"]);
}

/* -------------------------------------------------------------------------- */

// Windows won't delete a database file that is still open.
(globalThis as { __sqlite?: { close(): void } }).__sqlite?.close();
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
