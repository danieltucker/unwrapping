# Referrals and retailer product data

A plan for filling in the gifts we currently cannot read, by asking the retailer
instead of the page — and for the referral relationships that come with the same
signup.

Two things that look separate turn out to be one piece of work:

1. **Product data we can't scrape.** A handful of large retailers will never
   yield to an HTTP fetch, and they are exactly the ones people paste most.
2. **Referral income.** [`src/lib/outbound.ts`](../src/lib/outbound.ts) already
   has the scaffolding and an empty `REFERRAL_TAGS`.

The same affiliate signup is the door to both. You apply once, and get a product
API *and* a commission on gifts people actually buy.

## The one decision everything else follows from

**We identify ourselves and use the front door. We do not get better at
disguise.**

This is already the standing decision in the code — see the comment above
`HEADERS` in [`scrape-fetch.ts`](../src/lib/scrape-fetch.ts) about never
impersonating a search-engine crawler. This document extends it rather than
reopening it, because the alternative was measured and it does not work.

### What was measured

Against `rei.com` and `bestbuy.com`, from a residential connection:

| Layer | Result |
|---|---|
| DNS | Resolves to Akamai (`e5816.x.akamaiedge.net`) |
| TCP :443 | Connects |
| TLS handshake | Completes in ~55ms, negotiates h2 |
| HTTP request | REI: a challenge page. Best Buy: no answer at all |

So the network path is fine and the IP is not blocked — Best Buy's edge accepts
the connection, completes the crypto, and then holds the socket open without
answering. That is a deliberate tarpit, and it is cheaper for them than serving
a challenge.

Two changes *did* help and are now in the code: a full modern-Chrome header set
including client hints, and Chrome's cipher ordering on the undici agent. Between
them, `patagonia.com` went from a 14KB shell with no product data to a complete
parse, and `homedepot.com` and `lowes.com` stopped refusing the connection.

Neither touches a real bot manager, because a bot manager does not score claims —
it scores whether everything about the connection agrees:

- **TLS fingerprint (JA3/JA4).** Cipher order is one input. Extension ordering,
  GREASE values, key-share and signature-algorithm order and ALPS are others, and
  Node's OpenSSL cannot be made to emit BoringSSL's shape.
- **HTTP/2 fingerprint.** SETTINGS values and order, window sizes, pseudo-header
  order. Akamai publishes a fingerprint format for exactly this.
- **Behavioural challenge.** The `_abck` cookie is earned by executing Akamai's
  JavaScript, which collects canvas, WebGL, fonts, screen metrics and event
  timing and posts a sensor payload.
- **Request pattern.** One document, no CSS, no images, no fonts, no referrer.

**The counterintuitive part, and the reason to stop here:** better headers
without a matching transport can score *worse*. `curl/8.19` on curl's TLS is
internally consistent — a tool, honestly labelled. "Chrome 140 on Windows"
arriving on an OpenSSL handshake with undici's h2 settings is a specific claim
contradicted by the evidence, which reads as deliberate evasion. Going further
means curl-impersonate or a patched TLS stack: an arms race lost on a side
project, and an unambiguous signal of circumventing rather than identifying.

### How the platforms actually do it

Worth knowing, because it reframes the problem. Bing is not out-scraping anyone.

- **Verified crawlers are allowlisted, not clever.** Bingbot is verified by
  reverse DNS to `*.search.msn.com` with a forward-confirming lookup back to the
  same IP, plus Microsoft's published IP ranges. Akamai and Cloudflare ship
  "verified bot" categories that pass these by policy. You cannot join by sending
  the user-agent — that *is* the check.
- **Product data arrives as a feed.** Retailers push catalogs to Microsoft
  Merchant Center and Google Merchant Center in Google Shopping feed format (id,
  title, link, image_link, price, availability, gtin, mpn, brand), by SFTP or
  Content API. Best Buy hands Bing the data deliberately, because Best Buy wants
  the traffic.

Which is the whole insight: **the data is freely given to anyone who asks
through the right door.** We have been knocking on the wrong one.

## The front doors

Verified September 2026. Commission rates and cookie windows change; re-check
before relying on a number.

| Retailer | Route | Product data | Notes |
|---|---|---|---|
| **Best Buy** | [developer.bestbuy.com](https://developer.bestbuy.com/) | Products, Categories, Stores, Buying Options | Free public API, historically open to anyone with a valid email. Pricing, availability, specs, descriptions and images for 700k+ products, near real-time. Affiliates append an Impact Partner ID (IPID) for sale credit |
| **REI** | [AvantLink](https://www.avantlink.com/programs/10248/rei-com-affiliate-program/) | REST Product Data API | Apply and be approved on site quality. ~5% commission, 15-day cookie |
| **Amazon** | Product Advertising API 5.0 | Full catalog | Gated behind an Associates account *with qualifying sales* — a chicken-and-egg problem worth planning around, not assuming |
| **Target, Walmart, Home Depot** | Impact / CJ / Rakuten | Varies by programme | Check which network each runs on; several moved recently |

Networks worth one signup each, since they aggregate many merchants: **Impact**
(Best Buy and others), **AvantLink** (REI and outdoor brands), **CJ Affiliate**,
**Rakuten Advertising**, **Awin**.

**Best Buy is the one to do first.** No approval gate, no sales threshold, and it
is one of the two links that prompted this work.

## How it fits what exists

Very little new machinery. Three things already point this way:

- **`sourceDomain()`** already normalises the host on every scrape, which is the
  natural key for "is there a better way to ask about this shop?"
- **`REFERRAL_TAGS` in `outbound.ts`** is already the right shape, already
  applied at render time rather than stored, and `hasReferralTags()` already
  exists to drive a disclosure line.
- **`scrapeProduct()`** already returns a `ScrapeResult` that the form knows how
  to handle, including the empty-with-a-reason case.

So a retailer resolver is a thing that returns a `ScrapeResult` and gets first
refusal, with the existing fetch as the fallback:

```
addGift(url)
  └─ resolveProduct(url)
       ├─ registry lookup by sourceDomain
       │    └─ hit  → retailer API  → ScrapeResult
       │    └─ miss → scrapeProduct() as today
       └─ either way: a ScrapeResult, or an honest error
```

```ts
// src/lib/retailers/registry.ts
type RetailerResolver = {
  /** Hosts this handles, bare, as sourceDomain returns them. */
  domains: readonly string[];
  /** The product id in the URL, or null when this isn't a product page. */
  identify(url: URL): string | null;
  /** Null when the API is unconfigured or doesn't know it — never a throw. */
  lookup(id: string): Promise<ScrapeResult | null>;
};
```

Three rules that keep this from becoming a liability:

1. **An unconfigured resolver is not an error.** No API key means the registry
   misses and the ordinary scrape runs, exactly as today. A fresh clone must
   behave identically to now.
2. **A resolver never throws into the add-gift path.** Same contract
   `scrapeProduct` already keeps: answer with a blank and a reason.
3. **One log line per attempt, same convention as `[scrape]`**, so one `grep`
   still reaches everything:

   ```
   [retailer] ok host=bestbuy.com sku=6535788 dur=180ms title=api price=api/2999 images=api/3
   [retailer] miss host=bestbuy.com reason=no-key
   ```

Environment, alongside the existing entries in `.env.example` — every one
optional, every one absent by default:

```bash
# Best Buy product lookups. Without it, Best Buy links fall back to the ordinary
# scrape, which they currently fail. https://developer.bestbuy.com/
# BESTBUY_API_KEY=
# BESTBUY_IMPACT_ID=          # affiliate credit on the links we render

# REI and other AvantLink merchants.
# AVANTLINK_AFFILIATE_ID=
# AVANTLINK_API_KEY=
```

## Disclosure

If referral tags are ever switched on, the site has to say so. `hasReferralTags()`
exists for this and currently returns false, so the line is correctly absent.

Two obligations, both worth writing a test for rather than remembering:

- **A visible disclosure** wherever tagged links are rendered — FTC rules on
  affiliate links are about what an ordinary reader notices, not what a terms
  page contains.
- **Email links stay clean.** `outboundHref` already does this, because several
  programmes forbid tagged links in email. That rule predates this plan and
  survives it.

A registry gift list is squarely the use case these programmes exist for: we are
sending buyers to the retailer. But the *owner's* list must never be shaped by
commission — no reordering, no "you might also like" steered by rate. The tag is
applied at render time to a link somebody already chose.

## Prices from a feed

One trap worth naming. Feed prices go stale, and a wrong price on a gift card is
worse than no price — that is the standing rule in `scrape-parse.ts`, and it does
not relax because the number came from an API.

So: a price from a retailer API is treated exactly like a scraped one. It fills
the form, the owner can overwrite it, and an owner's correction survives a
refetch. The existing `refetchItem` rule already says this.

## Phases

| | What | Done when |
|---|---|---|
| **0** | The registry, the `RetailerResolver` type, the miss-is-not-an-error path, `[retailer]` logging, `npm run retailer -- <url>` mirroring `npm run scrape` | With no keys configured, every existing scrape behaves exactly as it does today |
| **1** | Best Buy resolver against the free API | A Best Buy link fills in title, price and images — the link from the original bug report works |
| **2** | AvantLink signup; REI resolver | An REI link fills in |
| **3** | Referral tags switched on for the configured retailers; the disclosure line; a test that email links stay clean | A tagged link is rendered, disclosed, and untagged in email |
| **4** | Amazon PA-API *if* the Associates threshold is ever met; further merchants as they earn it | — |

## Deliberately not doing

- **TLS or HTTP/2 impersonation.** curl-impersonate, patched TLS stacks, forged
  JA3. Measured above, and it is circumvention rather than identification.
- **A headless browser farm.** Playwright would solve JS-rendered pages and some
  challenges, at ~400MB of image, seconds per scrape and real RAM, on a project
  whose whole deployment is one container and one SQLite file. Revisit only if
  a retailer with no affiliate programme becomes genuinely important.
- **Third-party unblocking APIs.** Zyte, Bright Data and friends work by
  renting residential proxies to do what we just decided not to do. Paying
  somebody else to hold the lockpick is the same decision.
- **Scraping from the guest's browser.** It would borrow a guest's IP and
  reputation to fetch a page on the owner's behalf. Fetching happens on the
  server, on the owner's behalf — see the note in `scrape.ts`.
- **Storing a retailer's full catalog.** We look up one product when somebody
  pastes one link. A nightly feed sync is a different product.

## Open questions

1. **Amazon's chicken-and-egg.** PA-API needs qualifying sales, and Amazon is
   the most-pasted domain. Does the existing `amazonSignals()` parser stay the
   primary path for Amazon indefinitely? It works when Amazon serves us the real
   page, and the new challenge detection now tells us honestly when it doesn't.
2. **Who holds the keys on a self-hosted instance.** Referral tags are
   *someone's* affiliate ID. If a self-hoster runs their own instance, whose
   commission is it? The current design has tags configured in code, which
   quietly assumes one operator. `docs/self-hosting.md` will need an answer.
3. **What a resolver does with a URL it half-recognises.** A Best Buy *category*
   page is not a product. `identify()` returning null is the honest answer, but
   it should be tested against real pasted links rather than guessed at.
4. **Whether any of this beats asking.** For a shop with no programme and no
   readable markup, the manual form is already the answer and it now says why.
   The measure of this work is how many pastes stop reaching that form.
