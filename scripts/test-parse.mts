/**
 * Regression checks for product-page parsing.
 *
 *   node scripts/test-parse.mts [path/to/saved-page.html]
 *
 * Node strips the types, so there's no build step. Pass a saved product page to
 * also check extraction against real markup — retailers change their HTML
 * without warning, and a scraper fails silently when they do.
 */
import { readFileSync } from "node:fs";

import {
  canonicalizeUrl,
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

// --- Guard rails ----------------------------------------------------------
check("javascript: url rejected", normalizeUrl("javascript:alert(1)"), null);
check("bare word rejected", normalizeUrl("wat"), null);

// --- Saved page, when one is supplied -------------------------------------
const savedPage = process.argv[2];
if (savedPage) {
  const parsed = parseProduct(
    readFileSync(savedPage, "utf8"),
    "https://www.amazon.com/dp/B0DCN2KVKV",
  );

  console.log("\nParsed from saved page:");
  console.log(
    JSON.stringify({ ...parsed, images: parsed.images.slice(0, 3) }, null, 2),
  );

  check("title found", (parsed.title?.length ?? 0) > 10, true);
  check("price found", parsed.priceCents, 4999);
  check("currency found", parsed.currency, "USD");
  check("at least one image", parsed.images.length > 0, true);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
