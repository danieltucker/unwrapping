/**
 * Runs a real scrape against a real shop and prints everything we learned.
 *
 *   npm run scrape -- "https://www.example.com/p/thing"
 *   SCRAPE_DEBUG=1 npm run scrape -- "<url>"    # also keeps the page body
 *
 * This is the same code path the Add a gift form uses, so whatever happens here
 * is what happens in the app. When a shop stops filling in, start here: the
 * trace says whether we got the page at all, and if we did, which bit of markup
 * each field came out of.
 *
 * Node strips the types, so there is no build step.
 */
import { scrapeProductWithTrace } from "../src/lib/scrape-fetch.ts";

const url = process.argv[2];

if (!url) {
  console.error('Usage: npm run scrape -- "<url>"');
  process.exit(1);
}

const { result, trace } = await scrapeProductWithTrace(url);

console.log("\nTrace:");
console.log(JSON.stringify(trace, null, 2));

console.log("\nWhat the Add a gift form would show:");
console.log(JSON.stringify(result, null, 2));

/** The one sentence worth reading, given how it went. */
const advice: Record<typeof trace.outcome, string> = {
  "no-link":
    "Nothing in that paste parsed as an address. src/lib/scrape-parse.ts:extractUrl decides this.",
  blocked:
    "The shop hung up on us before answering. That is bot protection at their\n" +
    "edge, not a bug in the parser: it rejects the connection itself, so no\n" +
    "header we can honestly send changes it. This link has to be written in by\n" +
    "hand, and the form says so.",
  timeout:
    "No answer inside the timeout. Worth one retry — but a shop that stalls\n" +
    "every time is refusing us rather than being slow.",
  unreachable: "DNS, TLS or the network. Check the address resolves from this machine.",
  "http-error":
    "The shop answered, but not with a page. A 403 or 429 is it turning us\n" +
    "away; a 404 usually means the link itself has expired.",
  "not-html": "Not an HTML page, so there is nothing to parse.",
  ok: "",
};

if (trace.outcome !== "ok") {
  console.log(`\n${advice[trace.outcome]}`);
} else if (!trace.via?.title && !trace.found.images) {
  console.log(
    "\nThe page came back, but carried nothing we could read — every `via` above\n" +
      "is null. Shops that render their product data in the browser look exactly\n" +
      "like this. Re-run with SCRAPE_DEBUG=1 to keep the HTML, then work on it\n" +
      "offline: node scripts/test-parse.mts <saved file> <url>",
  );
} else {
  console.log(
    `\nRead it in ${trace.ms}ms. Each \`via\` above names the markup a field came\n` +
      "out of; a null one is the field to go looking for in the saved page.",
  );
}
