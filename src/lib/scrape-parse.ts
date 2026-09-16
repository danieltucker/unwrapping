/**
 * Pure product-page parsing. No I/O and no framework imports, so it runs under
 * plain `node` for testing as well as inside the app.
 *
 * Order of trust: OpenGraph → JSON-LD → site-specific markup → generic markup.
 * A price is never guessed from body text; blank beats wrong.
 */
import * as cheerio from "cheerio";

export type ParsedProduct = {
  title: string | null;
  priceCents: number | null;
  currency: string | null;
  images: string[];
};

const MAX_IMAGES = 6;

/** The bare domain shown on a gift card, e.g. "kinto-europe.com". */
export function sourceDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // A bare word like "wat" parses once we prepend https://, so require a dot —
    // but allow localhost so development and tests can point at a local server.
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Params that identify the *sharer* rather than the product. Amazon's share
// links carry coliid/colid, which are that person's own wishlist identifiers —
// storing them would leak one guest's Amazon account into a public list.
const TRACKING_PARAMS = new Set([
  "coliid",
  "colid",
  "psc",
  "ref",
  "ref_",
  "channelid",
  "lv",
  "plpredirect",
  "smid",
  "th",
  "linkcode",
  "ascsubtag",
  "creative",
  "creativeasin",
  "camp",
  "qid",
  "sr",
  "sprefix",
  "crid",
  "_encoding",
  // An incoming affiliate tag belongs to somebody else; never propagate it.
  "tag",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
]);

const TRACKING_PREFIXES = ["utm_", "pd_rd_", "pf_rd_", "_gl"];

const AMAZON_ASIN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;

function isAmazon(hostname: string): boolean {
  return /(^|\.)amazon\.[a-z.]{2,}$/i.test(hostname);
}

/**
 * Strips tracking cruft so the stored link is the canonical product.
 * Keeps the URL usable and leaves room for referral tags to be added later.
 */
export function canonicalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }

  if (isAmazon(url.hostname)) {
    const asin = url.pathname.match(AMAZON_ASIN)?.[1];
    if (asin) return `${url.origin}/dp/${asin.toUpperCase()}`;
  }

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (
      TRACKING_PARAMS.has(lower) ||
      TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix))
    ) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

/** "£68.00", "1,234.56", "USD 40" → cents. Null when there's no clean number. */
export function parsePriceToCents(
  raw: string | number | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw * 100) : null;
  }

  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  // European style: 1.234,56
  const normalized =
    lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Currency symbols seen in a price string, when no explicit code is given. */
function currencyFromSymbol(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.includes("£")) return "GBP";
  if (raw.includes("€")) return "EUR";
  if (raw.includes("$")) return "USD";
  return null;
}

type JsonLdNode = Record<string, unknown>;

function findProduct(node: unknown, depth = 0): JsonLdNode | null {
  if (!node || typeof node !== "object" || depth > 6) return null;

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findProduct(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = node as JsonLdNode;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "product")) {
    return record;
  }

  for (const value of Object.values(record)) {
    const found = findProduct(value, depth + 1);
    if (found) return found;
  }

  return null;
}

function firstOffer(product: JsonLdNode): JsonLdNode | null {
  const offers = product.offers;
  if (!offers) return null;
  const candidate = Array.isArray(offers) ? offers[0] : offers;
  return candidate && typeof candidate === "object" ? (candidate as JsonLdNode) : null;
}

type Api = ReturnType<typeof cheerio.load>;

function extractProduct($: Api): JsonLdNode | null {
  for (const block of $('script[type="application/ld+json"]').toArray()) {
    try {
      const found = findProduct(JSON.parse($(block).text()));
      if (found) return found;
    } catch {
      // Malformed JSON-LD is common; ignore this block and try the next.
    }
  }
  return null;
}

/**
 * Amazon serves no OpenGraph and no JSON-LD to ordinary browsers, so read the
 * markup it does render. Selectors are checked in buy-box-first order.
 */
function amazonSignals($: Api): Partial<ParsedProduct> & { rawPrice?: string } {
  const title = $("#productTitle").first().text().trim() || null;

  const priceSelectors = [
    "#corePriceDisplay_desktop_feature_div .a-offscreen",
    "#corePrice_feature_div .a-offscreen",
    "#apex_desktop .a-offscreen",
    "#priceblock_ourprice",
    "#price_inside_buybox",
    ".a-offscreen",
  ];

  let rawPrice: string | undefined;
  for (const selector of priceSelectors) {
    for (const element of $(selector).toArray()) {
      const text = $(element).text().trim();
      if (text && parsePriceToCents(text)) {
        rawPrice = text;
        break;
      }
    }
    if (rawPrice) break;
  }

  const images: string[] = [];
  const landing = $("#landingImage").first();
  // Full-resolution source, when present.
  const hires = landing.attr("data-old-hires");
  if (hires) images.push(hires);

  // Otherwise a JSON map of {url: [width, height]} — take the widest few.
  const dynamic = landing.attr("data-a-dynamic-image");
  if (dynamic) {
    try {
      const parsed = JSON.parse(dynamic) as Record<string, [number, number]>;
      const sorted = Object.entries(parsed)
        .sort((a, b) => (b[1]?.[0] ?? 0) - (a[1]?.[0] ?? 0))
        .map(([url]) => url);
      images.push(...sorted);
    } catch {
      // Ignore a malformed attribute.
    }
  }

  const src = landing.attr("src");
  if (src) images.push(src);

  return { title, rawPrice, images };
}

export function parseProduct(html: string, baseUrl: string): ParsedProduct {
  const $ = cheerio.load(html);
  const meta = (selector: string) => $(selector).attr("content")?.trim() || null;

  const hostname = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return "";
    }
  })();

  const product = extractProduct($);
  const offer = product ? firstOffer(product) : null;
  const site = isAmazon(hostname) ? amazonSignals($) : {};

  const title =
    meta('meta[property="og:title"]') ??
    meta('meta[name="twitter:title"]') ??
    (typeof product?.name === "string" ? product.name.trim() : null) ??
    site.title ??
    $("h1").first().text().trim() ??
    $("title").first().text().trim() ??
    null;

  const rawPrice =
    meta('meta[property="product:price:amount"]') ??
    meta('meta[property="og:price:amount"]') ??
    (offer?.price as string | undefined) ??
    $('[itemprop="price"]').first().attr("content") ??
    site.rawPrice ??
    null;

  const currency =
    meta('meta[property="product:price:currency"]') ??
    meta('meta[property="og:price:currency"]') ??
    (typeof offer?.priceCurrency === "string" ? offer.priceCurrency : null) ??
    currencyFromSymbol(site.rawPrice ?? null);

  const candidates = [
    ...$('meta[property="og:image"]')
      .map((_, element) => $(element).attr("content"))
      .get(),
    meta('meta[name="twitter:image"]'),
    ...(Array.isArray(product?.image)
      ? (product.image as unknown[]).filter((i): i is string => typeof i === "string")
      : typeof product?.image === "string"
        ? [product.image]
        : []),
    ...(site.images ?? []),
    $('link[rel="image_src"]').attr("href"),
  ];

  const images: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const absolute = new URL(candidate, baseUrl).toString();
      if (!images.includes(absolute)) images.push(absolute);
    } catch {
      // Skip anything that isn't a resolvable URL.
    }
    if (images.length >= MAX_IMAGES) break;
  }

  return {
    title: title || null,
    priceCents: parsePriceToCents(rawPrice),
    currency: currency?.toUpperCase() ?? null,
    images,
  };
}
