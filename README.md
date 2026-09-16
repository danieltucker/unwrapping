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
  page.tsx                  landing
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

## Not built yet

- **Email.** Nothing is sent: no invitations, no reminders, no magic links for
  guest identity, no verification. Several bits of UI promise it.
- **Payments.** `contributions.status` has `pending | captured | refunded` but
  nothing moves money or transitions a row. Group-gift maths and UI are real.
- **OAuth sign-in**, the browser extension, and the Occasions/Pricing pages.
