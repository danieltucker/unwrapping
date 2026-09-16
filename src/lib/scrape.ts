import "server-only";

import {
  canonicalizeUrl,
  normalizeUrl,
  parseProduct,
  sourceDomain,
} from "@/lib/scrape-parse";

export { canonicalizeUrl, normalizeUrl, parsePriceToCents } from "@/lib/scrape-parse";

export type ScrapeResult = {
  url: string;
  sourceDomain: string | null;
  title: string | null;
  /** Integer cents, or null. A price is never guessed — blank beats wrong. */
  priceCents: number | null;
  currency: string | null;
  images: string[];
  /** Set when the fetch failed; the UI keeps the link and falls back to manual. */
  error: string | null;
};

const TIMEOUT_MS = 8000;
// Amazon product pages run to ~3MB; anything past this is not a product page
// worth parsing, and we shouldn't hold it in memory.
const MAX_BYTES = 6_000_000;

// Some shops serve a different page to anything that looks like a bot, so
// present as a normal browser. We do NOT impersonate a search-engine crawler
// to obtain content a site only serves to search engines.
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "upgrade-insecure-requests": "1",
};

/** Reads the body but stops at MAX_BYTES rather than buffering a huge page. */
async function readCapped(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let html = "";

  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }

  await reader.cancel().catch(() => {});
  return html;
}

export async function scrapeProduct(rawUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(rawUrl);

  const empty: ScrapeResult = {
    url: url ? canonicalizeUrl(url) : rawUrl,
    sourceDomain: sourceDomain(url),
    title: null,
    priceCents: null,
    currency: null,
    images: [],
    error: null,
  };

  if (!url) return { ...empty, error: "That doesn't look like a web address." };

  let html: string;
  let finalUrl = url;

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // Share links often redirect; parse relative URLs against where we landed.
    finalUrl = response.url || url;

    if (!response.ok) {
      return { ...empty, error: `The shop returned ${response.status}.` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { ...empty, error: "That link isn't a product page." };
    }

    html = await readCapped(response);
  } catch {
    // Timeout, DNS failure, or a shop blocking us. Keep the URL either way.
    return { ...empty, error: "We couldn't read that page." };
  }

  const parsed = parseProduct(html, finalUrl);
  const canonical = canonicalizeUrl(finalUrl);

  return {
    url: canonical,
    sourceDomain: sourceDomain(canonical),
    title: parsed.title,
    priceCents: parsed.priceCents,
    currency: parsed.currency,
    images: parsed.images,
    error: null,
  };
}
