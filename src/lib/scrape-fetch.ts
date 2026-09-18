/**
 * Fetching a product page, and saying out loud what happened.
 *
 * Kept apart from scrape.ts, which is the server-only door onto this, for the
 * same reason scrape-parse.ts is kept pure: no framework imports, so
 * `node scripts/scrape-url.mts <url>` runs the code the app runs rather than an
 * approximation of it. A shop that fills in for one and not the other is a
 * debugging session nobody wins.
 *
 * Every attempt writes one line to the server log. Shops break silently and
 * often — they change their markup, or they decide one day that we are a bot —
 * and without that line the only symptom is a gift form that came back empty.
 */
import { Agent, fetch as undiciFetch } from "undici";

import {
  canonicalizeUrl,
  normalizeUrl,
  parseProduct,
  sourceDomain,
  type ParsedProduct,
} from "./scrape-parse.ts";

export type ScrapeResult = {
  url: string;
  sourceDomain: string | null;
  title: string | null;
  /** Integer cents, or null. A price is never guessed; blank beats wrong. */
  priceCents: number | null;
  currency: string | null;
  images: string[];
  /** Set when the fetch failed; the UI keeps the link and falls back to manual. */
  error: string | null;
};

/**
 * What became of one attempt. Each non-ok outcome is a different fix:
 *
 * - `no-link`     nothing in the paste was an address.
 * - `blocked`     the shop hung up on us. Bot protection, almost always.
 * - `challenged`  it answered 200, but with an "are you a robot" page.
 * - `timeout`     it never answered.
 * - `unreachable` DNS, TLS, or the network.
 * - `http-error`  it answered with a status we can't read a product out of.
 * - `not-html`    a PDF, an image, a JSON endpoint.
 * - `ok`          we read the page. Whether we understood it is `via`.
 */
export type ScrapeOutcome =
  | "ok"
  | "no-link"
  | "blocked"
  | "challenged"
  | "timeout"
  | "unreachable"
  | "http-error"
  | "not-html";

export type ScrapeTrace = {
  at: string;
  outcome: ScrapeOutcome;
  ms: number;
  /** What was pasted, trimmed to something a log line can hold. */
  input: string;
  url: string | null;
  /** Where the redirects landed, when that isn't where we started. */
  finalUrl: string | null;
  status: number | null;
  contentType: string | null;
  bytes: number | null;
  /** The underlying error code, e.g. ECONNRESET. */
  cause: string | null;
  found: {
    title: string | null;
    priceCents: number | null;
    currency: string | null;
    images: number;
  };
  /** Which markup each field came out of; null on a page we never read. */
  via: ParsedProduct["via"] | null;
  /** Where the page body was kept, in debug mode. */
  savedTo?: string;
};

const TIMEOUT_MS = 8000;
// Amazon product pages run to ~3MB; anything past this is not a product page
// worth parsing, and we shouldn't hold it in memory.
const MAX_BYTES = 6_000_000;

// Some shops serve a different page to anything that looks like a bot, so
// present as a normal browser. We do NOT impersonate a search-engine crawler
// to obtain content a site only serves to search engines.
//
// A user-agent on its own is no longer enough. A real Chrome navigation also
// carries client hints (sec-ch-ua*) and fetch metadata (sec-fetch-*), and a
// shop that checks for them treats their absence as proof of a script: Amazon
// answers a bare user-agent with a 4KB "continue shopping" stub and the full
// set with the actual product page. The values below describe the browser we
// claim to be, consistently — a Chrome user-agent with no client hints is a
// contradiction, and that mismatch is itself a signal.
const CHROME_VERSION = "140";

const HEADERS = {
  "user-agent":
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION}.0.0.0 Safari/537.36`,
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-ch-ua": `"Chromium";v="${CHROME_VERSION}", "Not=A?Brand";v="24", "Google Chrome";v="${CHROME_VERSION}"`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  // A typed-in address bar: a top-level navigation, from no prior page.
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

/**
 * The cipher list Chrome offers, in Chrome's order.
 *
 * Node's TLS defaults are OpenSSL's, and the order a client offers its ciphers
 * in is a fingerprint: it is most of what JA3 hashes. Shops behind Akamai and
 * friends compare that fingerprint against the browser the user-agent claims to
 * be, and a Chrome user-agent arriving on an OpenSSL handshake is a plain
 * contradiction — which is why headers alone stopped being enough.
 *
 * Reordering our own ciphers is not a forged credential and not a defeat of any
 * access control: it is the same public handshake a browser performs, and every
 * suite here is one Node already offers. Sites that answer this still answer a
 * `403` or a challenge when they mean to refuse us, and we honour that below.
 *
 * Measured, on the shops this fixed: patagonia.com goes from a 14KB shell with
 * no product data to the full page; homedepot.com and lowes.com stop refusing
 * the connection (though they then serve a challenge, which we report).
 */
const CHROME_CIPHERS = [
  "TLS_AES_128_GCM_SHA256",
  "TLS_AES_256_GCM_SHA384",
  "TLS_CHACHA20_POLY1305_SHA256",
  "ECDHE-ECDSA-AES128-GCM-SHA256",
  "ECDHE-RSA-AES128-GCM-SHA256",
  "ECDHE-ECDSA-AES256-GCM-SHA384",
  "ECDHE-RSA-AES256-GCM-SHA384",
  "ECDHE-ECDSA-CHACHA20-POLY1305",
  "ECDHE-RSA-CHACHA20-POLY1305",
  "ECDHE-RSA-AES128-SHA",
  "ECDHE-RSA-AES256-SHA",
  "AES128-GCM-SHA256",
  "AES256-GCM-SHA384",
  "AES128-SHA",
  "AES256-SHA",
].join(":");

/**
 * One agent for the process, so connections are pooled rather than a fresh
 * handshake per gift. Node's global `fetch` will not take a dispatcher built
 * from a different undici than its own, so the fetch used here comes from the
 * same package as the Agent.
 */
const dispatcher = new Agent({
  connect: {
    ciphers: CHROME_CIPHERS,
    honorCipherOrder: true,
    minVersion: "TLSv1.2",
    ecdhCurve: "X25519:P-256:P-384",
  },
});

/**
 * Reads the body but stops at MAX_BYTES rather than buffering a huge page.
 *
 * Typed by the one thing it uses rather than by `Response`: the response here
 * comes from undici's fetch (see `dispatcher` above), whose Response type is
 * structurally the same but nominally distinct from the global one.
 */
async function readCapped(response: {
  body: { getReader(): ReadableStreamDefaultReader<Uint8Array> } | null;
}): Promise<string> {
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

/**
 * The bit of a thrown fetch worth writing down: ECONNRESET, ENOTFOUND, and so
 * on. `fetch` reports every one of them as the same "fetch failed" TypeError
 * and hides the real reason a `cause` or two down.
 */
function errorCode(error: unknown): string | null {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as { code?: unknown; name?: unknown; cause?: unknown };
    if (typeof record.code === "string") return record.code;
    if (record.name === "TimeoutError") return "TimeoutError";
    current = record.cause;
  }

  return error instanceof Error ? error.name : null;
}

// Each of these means the connection died before an answer came back, and on a
// live shop that is bot protection rather than a broken network: the edge
// decides we are not a browser and drops the socket. Worth separating out,
// because "try again later" is useless advice where "fill it in yourself" is
// the only thing that will ever work.
const HUNG_UP = new Set([
  "ECONNRESET",
  "EPROTO",
  "EPIPE",
  "ERR_HTTP2_STREAM_ERROR",
  "ERR_HTTP2_SESSION_ERROR",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "UND_ERR_SOCKET",
]);

const UNREACHABLE = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

/** Turns a thrown fetch into an outcome and a sentence the list's owner reads. */
function classify(
  code: string | null,
  host: string,
): { outcome: ScrapeOutcome; message: string } {
  if (code === "TimeoutError" || code === "ABORT_ERR" || code === "ETIMEDOUT") {
    return { outcome: "timeout", message: `${host} took too long to answer.` };
  }
  if (code && HUNG_UP.has(code)) {
    return {
      outcome: "blocked",
      message: `${host} wouldn't let us read the page. Some shops turn away anything that isn't a person in a browser.`,
    };
  }
  if (code && UNREACHABLE.has(code)) {
    return { outcome: "unreachable", message: `We couldn't reach ${host}.` };
  }
  return { outcome: "unreachable", message: "We couldn't read that page." };
}

/** The same, for a page that answered with a status we can't use. */
function fromStatus(status: number, host: string): string {
  if (status === 404 || status === 410) return "That page isn't there any more.";
  if (status === 401 || status === 403 || status === 429) {
    return `${host} turned us away (${status}). Shops do this to anything that isn't a person in a browser.`;
  }
  if (status >= 500) return `${host} is having trouble right now (${status}).`;
  return `The shop returned ${status}.`;
}

/**
 * Markers left by the big bot-protection vendors on their "are you a robot"
 * pages. Each is a script path, element id or incident string belonging to the
 * vendor's interstitial, not something a shop's own page would carry.
 */
const CHALLENGE_MARKERS = [
  // Akamai Bot Manager. rei.com and bestbuy.com both sit behind this.
  "sec-if-cpt-container",
  "_abck",
  "/akam/",
  // Cloudflare.
  "cf-browser-verification",
  "challenge-platform",
  "cf_chl_opt",
  // PerimeterX / HUMAN.
  "px-captcha",
  "_pxhd",
  // Imperva / Incapsula.
  "_incapsula_resource",
  "incapsula incident id",
  // DataDome.
  "geo.captcha-delivery.com",
  // Amazon's own. It serves this as a 200 with a plausible <title>, which is
  // exactly the shape that used to reach the form as a gift called "Amazon.com"
  // with no price and no picture.
  "/errors/validatecaptcha",
  "api-services-support@amazon",
];

/**
 * True when a 200 was the shop's bot wall rather than the product.
 *
 * Deliberately only asked once the parser has come back empty. Every marker
 * above could in principle appear on a real page — a shop selling a book about
 * Cloudflare, say — and a page we *did* read a product out of is a page we
 * read, whatever else is on it. Checking second means a false positive cannot
 * cost anyone a scrape that worked; the worst it can do is mislabel a page that
 * had nothing on it anyway.
 *
 * Worth separating from an empty page because the advice differs. A shop that
 * renders its products in the browser may still be worth adding a parser for; a
 * challenge page will never be readable without running its JavaScript, and the
 * honest thing is to say so and let the owner type the gift in.
 */
function isChallenge(html: string, parsed: ParsedProduct): boolean {
  // Anything the parser found in *product* markup means we got the real page.
  // A <title> or an <h1> does not count: the challenge page has both.
  const readSomething =
    parsed.images.length > 0 ||
    parsed.priceCents !== null ||
    (parsed.via.title !== null &&
      parsed.via.title !== "<title>" &&
      parsed.via.title !== "h1");
  if (readSomething) return false;

  // The interstitials are small; a big page that merely mentions one of these
  // is a real page that we happened to read nothing out of.
  const haystack = html.slice(0, 200_000).toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => haystack.includes(marker));
}

const DEBUG = process.env.SCRAPE_DEBUG === "1";

/**
 * One greppable line per attempt, plus the whole trace under SCRAPE_DEBUG.
 *
 * Reading it back is `docker compose logs -f | grep "\[scrape\]"`; see
 * docs/self-hosting.md.
 */
function log(trace: ScrapeTrace) {
  const host = sourceDomain(trace.finalUrl ?? trace.url) ?? "-";
  // A pasted "link" is whatever someone had on their clipboard, and a log line
  // is no place to find out it was a novel.
  const url = (trace.finalUrl ?? trace.url ?? trace.input).slice(0, 300);
  const parts = [
    `[scrape] ${trace.outcome}`,
    `dur=${trace.ms}ms`,
    `host=${host}`,
    trace.status === null ? null : `status=${trace.status}`,
    trace.bytes === null ? null : `bytes=${trace.bytes}`,
    trace.cause ? `cause=${trace.cause}` : null,
    trace.via ? `title=${trace.via.title ?? "none"}` : null,
    // The price reports where it was read *and* what came of it: a selector
    // that matched a string we then failed to turn into a number is a
    // different problem from a page that carries no price at all.
    trace.via
      ? `price=${trace.via.price ?? "none"}/${trace.found.priceCents ?? "none"}`
      : null,
    trace.via ? `images=${trace.via.images ?? "none"}/${trace.found.images}` : null,
    trace.savedTo ? `saved=${trace.savedTo}` : null,
    `url=${url}`,
  ].filter(Boolean);

  console.log(parts.join(" "));
  if (DEBUG) console.log(`[scrape] ${JSON.stringify(trace)}`);
}

/**
 * Keeps the page body under SCRAPE_DEBUG, so a shop that stopped filling in can
 * be worked on offline: `node scripts/test-parse.mts <file> <url>` re-parses it
 * without going back to the shop, which is the only way to iterate on one that
 * rate-limits or blocks.
 */
async function savePage(html: string, url: string): Promise<string | undefined> {
  if (!DEBUG || !html) return undefined;

  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const dir = process.env.SCRAPE_DEBUG_DIR ?? join(process.cwd(), "data", "scrapes");
    await mkdir(dir, { recursive: true });

    const host = sourceDomain(url)?.replace(/[^a-z0-9.-]/gi, "-") ?? "unknown";
    const path = join(dir, `${Date.now()}-${host}.html`);
    await writeFile(path, html, "utf8");
    return path;
  } catch (error) {
    // Debugging is never allowed to be the thing that breaks adding a gift.
    console.log(`[scrape] could not keep the page: ${String(error)}`);
    return undefined;
  }
}

export async function scrapeProduct(rawUrl: string): Promise<ScrapeResult> {
  return (await scrapeProductWithTrace(rawUrl)).result;
}

/**
 * The same scrape, handing back the trace as well as the result.
 *
 * The app only ever wants the result — the trace has already gone to the log by
 * the time this returns — but scripts/scrape-url.mts wants to show its working.
 */
export async function scrapeProductWithTrace(
  rawUrl: string,
): Promise<{ result: ScrapeResult; trace: ScrapeTrace }> {
  const started = Date.now();
  const url = normalizeUrl(rawUrl);

  const empty: ScrapeResult = {
    // Keeping the link means keeping a *link*. When nothing in the paste was
    // one, there is nothing to carry forward, and storing the prose would put
    // a sentence in the url column and "Added by hand" domains on the card.
    url: url ? canonicalizeUrl(url) : "",
    sourceDomain: sourceDomain(url),
    title: null,
    priceCents: null,
    currency: null,
    images: [],
    error: null,
  };

  const base: ScrapeTrace = {
    at: new Date().toISOString(),
    outcome: "ok",
    ms: 0,
    input: rawUrl.slice(0, 200),
    url,
    finalUrl: null,
    status: null,
    contentType: null,
    bytes: null,
    cause: null,
    found: { title: null, priceCents: null, currency: null, images: 0 },
    via: null,
  };

  /** Records the attempt, and hands back what the caller should return. */
  function done(
    outcome: ScrapeOutcome,
    result: ScrapeResult,
    extra: Partial<ScrapeTrace> = {},
  ): { result: ScrapeResult; trace: ScrapeTrace } {
    const trace: ScrapeTrace = { ...base, ...extra, outcome, ms: Date.now() - started };
    log(trace);
    return { result, trace };
  }

  if (!url) {
    return done("no-link", { ...empty, error: "We couldn't find a link in that." });
  }

  const host = sourceDomain(url) ?? "the shop";
  let html: string;
  let finalUrl = url;
  let status: number;
  let contentType: string;

  try {
    const response = await undiciFetch(url, {
      headers: HEADERS,
      redirect: "follow",
      dispatcher,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // Share links often redirect; parse relative URLs against where we landed.
    finalUrl = response.url || url;
    status = response.status;
    contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      return done(
        "http-error",
        { ...empty, error: fromStatus(status, host) },
        { finalUrl, status, contentType },
      );
    }

    if (!contentType.includes("html")) {
      return done(
        "not-html",
        { ...empty, error: "That link isn't a product page." },
        { finalUrl, status, contentType },
      );
    }

    html = await readCapped(response);
  } catch (error) {
    // Timeout, DNS failure, or a shop blocking us. Keep the URL either way.
    const cause = errorCode(error);
    const { outcome, message } = classify(cause, host);
    return done(outcome, { ...empty, error: message }, { finalUrl, cause });
  }

  const parsed = parseProduct(html, finalUrl);
  const canonical = canonicalizeUrl(finalUrl);
  const challenged = isChallenge(html, parsed);

  return done(
    challenged ? "challenged" : "ok",
    {
      url: canonical,
      sourceDomain: sourceDomain(canonical),
      // A challenge page has a title ("Access Denied") and sometimes an image,
      // and putting either on the card would be worse than leaving it blank:
      // the owner would have to notice the gift is wrong before fixing it.
      title: challenged ? null : parsed.title,
      priceCents: challenged ? null : parsed.priceCents,
      currency: challenged ? null : parsed.currency,
      images: challenged ? [] : parsed.images,
      error: challenged
        ? `${host} asked us to prove we're a person before showing the page. Fill this one in by hand — the link is kept.`
        : null,
    },
    {
      finalUrl,
      status,
      contentType,
      bytes: html.length,
      via: parsed.via,
      found: {
        title: parsed.title,
        priceCents: parsed.priceCents,
        currency: parsed.currency,
        images: parsed.images.length,
      },
      savedTo: await savePage(html, finalUrl),
    },
  );
}
