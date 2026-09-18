import "server-only";

/**
 * The app's way in to scraping. Everything real lives in scrape-fetch.ts and
 * scrape-parse.ts, which carry no framework imports so the same code can be run
 * from the command line against a real shop:
 *
 *   node scripts/scrape-url.mts https://www.example.com/p/thing
 *
 * This file exists to keep the marker: fetching happens on the server, on the
 * owner's behalf, and never from a browser.
 */
export {
  canonicalizeUrl,
  normalizeUrl,
  parsePriceToCents,
} from "@/lib/scrape-parse";

export { scrapeProduct } from "@/lib/scrape-fetch";
export type { ScrapeOutcome, ScrapeResult, ScrapeTrace } from "@/lib/scrape-fetch";
