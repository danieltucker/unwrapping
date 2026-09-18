/**
 * Regression checks for product-page parsing.
 *
 *   node scripts/test-parse.mts [path/to/saved-page.html]
 *
 * Node strips the types, so there's no build step. Pass a saved product page to
 * also check extraction against real markup; retailers change their HTML
 * without warning, and a scraper fails silently when they do.
 */
import { readFileSync } from "node:fs";

import {
  canonicalizeUrl,
  extractUrl,
  normalizeUrl,
  parsePriceToCents,
  parseProduct,
} from "../src/lib/scrape-parse.ts";

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

// --- URL canonicalisation -------------------------------------------------
check(
  "amazon share link reduces to /dp/ASIN",
  canonicalizeUrl(
    "https://www.amazon.com/dp/B0DCN2KVKV/?coliid=I1BW5G0W3GSQ2V&colid=YVY0VX3KHFTJ&psc=1&ref_=cm_sw_r_cp_ud_lstpd_W783689KZ2BMADEKA8T0",
  ),
  "https://www.amazon.com/dp/B0DCN2KVKV",
);
check(
  "someone else's affiliate tag is stripped",
  canonicalizeUrl("https://www.amazon.co.uk/gp/product/B0DCN2KVKV?tag=someoneelse-21"),
  "https://www.amazon.co.uk/dp/B0DCN2KVKV",
);
check(
  "utm params stripped, real params kept",
  canonicalizeUrl("https://shop.example.com/p/thing?utm_source=x&size=medium"),
  "https://shop.example.com/p/thing?size=medium",
);

// --- Price parsing --------------------------------------------------------
check("$49.99", parsePriceToCents("$49.99"), 4999);
check("European 1.234,56", parsePriceToCents("1.234,56"), 123456);
check("£68 without decimals", parsePriceToCents("£68"), 6800);
check("no digits at all", parsePriceToCents("Currently unavailable"), null);

// --- Pulling the link out of pasted share text ----------------------------
check(
  "amazon's app puts the title in front of the link",
  extractUrl(
    "Rhinowalk Motorcycle Fuel Tank Bag, Magnetic Quick Release, Black, One Size https://a.co/d/9xKqLmN",
  ),
  "https://a.co/d/9xKqLmN",
);
check(
  "a link on its own line, with a lead-in above it",
  extractUrl("Check out this product on Amazon:\nhttps://www.amazon.com/dp/B0DCN2KVKV?ref_=cm_sw"),
  "https://www.amazon.com/dp/B0DCN2KVKV?ref_=cm_sw",
);
check(
  "the sentence's full stop is not part of the address",
  extractUrl("I'd love this one: https://shop.example.com/p/kettle."),
  "https://shop.example.com/p/kettle",
);
check(
  "a bracket the address opened is kept",
  extractUrl("see https://en.example.com/wiki/Kettle_(vessel) for it"),
  "https://en.example.com/wiki/Kettle_(vessel)",
);
check(
  "a bracket the sentence opened is not",
  extractUrl("the good one (https://shop.example.com/p/kettle)"),
  "https://shop.example.com/p/kettle",
);
check(
  "the product link wins over the app plug behind it",
  extractUrl("https://a.co/d/abc123 — shared via the Amazon Shopping app https://amazon.com/apps"),
  "https://a.co/d/abc123",
);
check(
  "www with no scheme, mid-sentence",
  extractUrl("get it from www.kinto-europe.com/slow-coffee please"),
  "www.kinto-europe.com/slow-coffee",
);
check("a bare pasted domain is left alone", extractUrl("kinto-europe.com/slow-coffee"), "kinto-europe.com/slow-coffee");
check("prose with no link at all", extractUrl("a jar of really good olive oil"), null);
check(
  "an abbreviation is not a domain",
  normalizeUrl("something warm for winter, e.g. a scarf"),
  null,
);
check(
  "share text normalises to a usable url",
  normalizeUrl("Nice mug https://shop.example.com/p/mug"),
  "https://shop.example.com/p/mug",
);

// --- Guard rails ----------------------------------------------------------
check("javascript: url rejected", normalizeUrl("javascript:alert(1)"), null);
check("bare word rejected", normalizeUrl("wat"), null);

// --- Saved page, when one is supplied -------------------------------------
//
// With a URL of its own, the page is somebody's bug report rather than the
// fixture: parse it against the address it came from and report, but assert
// nothing, since we have no idea what it is meant to contain. `via` is the
// thing to read there — it says which markup each field was found in, and a
// row of "none" means the shop renders its product data in the browser.
const savedPage = process.argv[2];
const savedPageUrl = process.argv[3];
if (savedPage) {
  const parsed = parseProduct(
    readFileSync(savedPage, "utf8"),
    savedPageUrl ?? "https://www.amazon.com/dp/B0DCN2KVKV",
  );

  console.log("\nParsed from saved page:");
  console.log(
    JSON.stringify({ ...parsed, images: parsed.images.slice(0, 3) }, null, 2),
  );

  if (!savedPageUrl) {
    check("title found", (parsed.title?.length ?? 0) > 10, true);
    check("price found", parsed.priceCents, 4999);
    check("currency found", parsed.currency, "USD");
    check("at least one image", parsed.images.length > 0, true);
  }
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
