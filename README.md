# Unwrap

A gift list people actually use.

An owner creates a list for an occasion, adds gifts by pasting a product URL
(the app scrapes title, photo and price) or by writing them in by hand, then
shares one link. Guests open that link with no account and reserve a gift,
which marks it as taken for everyone else so nobody doubles up.

**The rule the product is built on: the list owner never learns who claimed
what.** On a surprise list they see a count of claimed gifts and a total
chipped in, never which items or which people. It is enforced in the data
layer, not in the UI; see [`src/lib/claims.ts`](src/lib/claims.ts) and
[`src/lib/visibility.ts`](src/lib/visibility.ts). Treat a leak as a data bug.

## The name

`Unwrap`, at `unwrapp.ing`. Still provisional. It lives in exactly one place,
[`src/config/site.ts`](src/config/site.ts), so renaming is a one-file change.
Don't hardcode it anywhere else.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in SESSION_SECRET
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file URL. Defaults to `file:./data/app.db`. |
| `SESSION_SECRET` | Signs session and guest cookies. Any long random string. |
| `SITE_URL` | The address this instance is served from, scheme and port included. Feeds canonical URLs, Open Graph tags, `robots.txt` and the sitemap, and decides whether cookies may be `Secure`. Defaults to `https://unwrapp.ing`, so set it anywhere else. See [`src/lib/origin.ts`](src/lib/origin.ts). |
| `DB_AUTO_MIGRATE` | Apply pending migrations when the server starts. On in production, off in development. `0` to manage them yourself. |

## Deploying

`docker compose up -d --build`, with a volume on `/app/data`. The image is a
standalone Next build that installs nothing at runtime and migrates the database
as it starts. Full instructions, including TrueNAS SCALE and the two mistakes
everybody makes with cookies and file permissions, are in
[docs/self-hosting.md](docs/self-hosting.md).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Both check scripts below |
| `npm run test:parse` | Product-page parsing. Pass a saved HTML file to check a real page. |
| `npm run test:handles` | Handle and short-code generation |
| `npm run check` | typecheck + lint + test; run this before committing |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |

## Stack

Next.js (App Router, server actions), React, TypeScript, Tailwind v4,
SQLite via better-sqlite3 and Drizzle. No client data-fetching library: pages
are server components and mutations are server actions.

**Next.js here is not the Next.js you may know**; see [AGENTS.md](AGENTS.md).
Read the relevant guide in `node_modules/next/dist/docs/` before writing code
against the framework.

## How it fits together

```
src/app/                    routes
  page.tsx                  landing: the pitch, the occasions, the FAQ. The
                            only page search engines may index, and the only
                            place new owners are given instructions.
  robots.ts, sitemap.ts     generated at request time, because the origin is an
  opengraph-image.tsx       environment variable. The OG image is deliberately
                            generic: a shared list must not give its gifts away
                            in a chat unfurl.
  sign-in/, sign-up/        accounts
  new/                      create a list (step 1)
  lists/page.tsx            the owner's dashboard of their lists
  lists/[handle]/[slug]/    the public list a guest sees
    manage/                 the owner's editor
      add/                  paste a URL, or write a gift in by hand
      items/[id]/edit/      edit one gift
      share/               create step 2: link, QR, invite
  reserved/                 the guest's own reservations, keyed to a cookie
  [code]/                   short link, redirects and counts the open
src/components/             UI. ui.tsx holds the shared primitives and icons.
src/lib/                    the actual logic; everything server-side is marked
                            with `server-only`
src/db/                     Drizzle schema and the connection
drizzle/                    generated migrations, never edit by hand
design_handoff_wishly/      the design spec. Prototype HTML, not production
                            code; excluded from lint and never bundled.
```

A few things worth knowing before you change them:

- **Identity.** Owners have accounts. Guests do not; they are a signed cookie
  (`guestToken`), optionally linked to a user id once they sign in, so
  reservations survive a new device. See [`src/lib/viewer.ts`](src/lib/viewer.ts).
- **Lists exist before owners do.** A list created by a signed-out visitor is a
  draft tied to a cookie, living at `/lists/drafts/<shortCode>` until they sign
  up. [`src/lib/routes.ts`](src/lib/routes.ts) builds every internal URL.
- **Outbound shop links** all go through
  [`src/lib/outbound.ts`](src/lib/outbound.ts) so referral tags can be added in
  one place later. Never render a raw `item.url`.
- **Money is integer cents** everywhere. `formatPrice` in `src/config/site.ts`
  is the only place that renders it.
- **Nothing but `/` is indexable.** Pages under `/lists` are `noindex` through
  [`src/app/lists/layout.tsx`](src/app/lists/layout.tsx), and `robots.txt`
  allows only the landing page. A list is unlisted, not secret, so a crawler
  that found one would publish somebody's birthday.
- **Landing-page copy may only promise what exists.** The FAQ answers in
  `src/app/page.tsx` are also served as schema.org `FAQPage`, where a promise
  outlives the page. Read "Not built yet" below before adding one.

## Not built yet

- **Email.** Nothing is sent: no invitations, no reminders, no magic links for
  guest identity, no verification. Several bits of UI promise it.
- **Payments.** `contributions.status` has `pending | captured | refunded` but
  nothing moves money or transitions a row. Group-gift maths and UI are real.
- **Referrals.** `REFERRAL_TAGS` in `src/lib/outbound.ts` is empty, so
  `hasReferralTags()` is false and no disclosure line renders. Planned together
  with retailer product APIs, which are the way round the shops that refuse to be
  read: [docs/referrals-and-product-data.md](docs/referrals-and-product-data.md).
- **OAuth sign-in**, the browser extension, and the Occasions/Pricing pages.

Longer-form plans live in [docs/](docs/): retailer data and referrals above,
and [tags, categories and suggestions](docs/tags-and-suggestions.md).
