/**
 * Lists every gift whose stored price is worth a second look. Read-only: it
 * changes nothing, and prints what an owner (or you) might want to fix.
 *
 *   npm run prices:audit
 *
 * Why it exists: until price_label, an owner's price went through the shop
 * scraper's parser, which deleted everything but digits, so "$20 to $30" was
 * saved as $2,030 and "1,299" as $1.30. The text they typed was never kept, so
 * there is nothing to re-parse; what can be done is find the prices that look
 * like one of those accidents. Each row says why it was picked out.
 *
 * Reads DATABASE_URL like the app, defaulting to ./data/app.db.
 */
import Database from "better-sqlite3";

const file = (process.env.DATABASE_URL ?? "file:./data/app.db").replace(/^file:/, "");
const SITE_CURRENCY = "USD";

const db = new Database(file, { readonly: true, fileMustExist: true });

type Row = {
  id: string;
  title: string;
  kind: string;
  price_cents: number | null;
  price_source: string | null;
  currency: string;
  list_name: string;
  handle: string | null;
  slug: string;
};

const rows = db
  .prepare(
    `select items.id, items.title, items.kind, items.price_cents, items.price_source, items.currency,
            lists.name as list_name, users.handle, lists.slug
       from items
       join lists on lists.id = items.list_id
       left join users on users.id = lists.owner_id
      order by lists.name, items.position`,
  )
  .all() as Row[];

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Why a price looks wrong, or null when it looks fine. */
function suspicion(row: Row): string | null {
  if (row.price_cents === null) return null;
  if (row.kind === "idea") return "an idea with a price; ideas never have one, and it is never shown";
  if (row.currency.toUpperCase() !== SITE_CURRENCY) {
    return `priced in ${row.currency}; the price filter treats it as having no price`;
  }
  // Only typed prices went through the bad path; a shop's own is the shop's.
  if (row.price_source !== "owner") return null;
  const digits = String(Math.round(row.price_cents / 100));
  // "$20 to $30" became 2030: an even split into two plausible prices.
  if (row.price_cents >= 100_000 && digits.length % 2 === 0) {
    const half = digits.length / 2;
    const [low, high] = [Number(digits.slice(0, half)), Number(digits.slice(half))];
    if (low > 0 && high > low) return `typed, and ${dollars(row.price_cents)} looks like a range ($${low} to $${high}) run together`;
  }
  if (row.price_cents >= 100_000) return `typed, and over $1,000`;
  // "1,299" became 130 cents: a typed price under $10 with cents.
  if (row.price_cents < 1_000 && row.price_cents % 100 !== 0) {
    return `typed, and ${dollars(row.price_cents)} may be a thousands comma read as a decimal one`;
  }
  return null;
}

const flagged = rows
  .map((row) => ({ row, why: suspicion(row) }))
  .filter((entry): entry is { row: Row; why: string } => entry.why !== null);

const priced = rows.filter((row) => row.price_cents !== null).length;
console.log(`${rows.length} gifts, ${priced} with a price, ${rows.length - priced} without.`);

if (flagged.length === 0) {
  console.log("Nothing looks wrong.");
} else {
  console.log(`${flagged.length} worth a look:\n`);
  for (const { row, why } of flagged) {
    const where = row.handle ? `/lists/${row.handle}/${row.slug}` : `(draft) ${row.slug}`;
    console.log(`- ${row.title} — ${dollars(row.price_cents!)} on "${row.list_name}" ${where}`);
    console.log(`  ${why}  [${row.id}]`);
  }
}

db.close();
