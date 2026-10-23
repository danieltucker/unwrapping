# Secret Santa: review and launch

Security and QA review of Secret Santa (October 2026), with the release
checklist, rollback plan, and what to watch. The feature's own rules live in
`src/lib/secret-santa.ts`; this is about shipping it.

## Security review

Scope: every page, Server Action, and route handler under `src/app/secret-santa`,
`src/lib/secret-santa.ts`, `src/lib/santa-draw.ts`, the Santa cookies in
`src/lib/session.ts`, the admin report queue, and `isSantaFor` in reservations.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Medium | **An organiser could find out matches through "keep apart" pairs.** By keeping someone apart from everyone except one person, the organiser fixed that person's match and knew it without opening anything. Unlike replacing a link, nobody else could see this happen. | **Fixed.** `runDraw` refuses any draw where someone has only one possible match (`forcedGivers`), and the error message explains why. Checked against brute force on 258 random groups. |
| 2 | Medium | **Duplicate names got past the check by using invisible characters.** "Sam" and "Sam" with a zero-width space, or "ＳＡＭ" in full-width letters, could both join. That breaks the rule that no two people share a name, so the organiser could keep the wrong person apart. Direction-override characters could also make names and messages display misleadingly. | **Fixed.** Names, notes, and messages lose control, zero-width, and direction characters (`cleanLine`, `cleanText`). Duplicate names are compared after compatibility folding (`nameKey`). |
| 3 | Low | **`keepWithAccount` could move a participant to a different account.** Anyone holding a participant's link (for example, the organiser after replacing it) could reassign that person from their own account to another one. | **Fixed.** The action refuses when the participant is already linked to a different account. |
| 4 | Low | **No limit on how many exchanges an account could create.** | **Fixed.** 10 per account per day (`NEW_EXCHANGES_PER_DAY`). |
| 5 | Low | **Joining has no rate limit.** Anyone with the invite link can script up to 100 fake joins. This is nuisance only: no assignments are exposed, and the organiser can remove people before the draw. | Open. Rate-limit `POST /secret-santa/*` per IP at the reverse proxy. The app has no trustworthy client IP to limit on. |
| 6 | Low | **Opening someone's private link replaces the Santa cookie for that exchange without warning.** A crafted link can switch a browser to the attacker's participant. The attacker learns nothing from this, but the victim might act as the attacker without realising. | Open. Could add a confirmation step when the browser already holds a different valid link for that exchange. |
| 7 | Low | **Private-link tokens appear in access logs.** Each token passes once through `GET /secret-santa/p/<token>` before it moves into a cookie. | Open. Remove `/secret-santa/p/*` paths from reverse-proxy logs. |
| 8 | Info | **Join codes can be guessed in principle.** Codes are 7 characters from a 56-character alphabet (about 1.7×10¹²; `byte % 56` adds a slight bias). A correct guess shows the group name, note, budget, and headcount, but no names. | Accepted. Brute force isn't practical. Rate-limit 404s at the proxy along with #5. |
| 9 | Info | **The organiser can replace a link and open that person's page.** | Accepted by design. Every participant's page shows whose link was replaced and when. |

**Checked and found sound:**

- **Tokens:** 192 random bits, stored only as SHA-256 hashes and compared by hash lookup. Cookies are `httpOnly`, `SameSite=Lax`, and `Secure` over https.
- **Assignment reads:** the `santa_assignments` table is read only inside `secret-santa.ts`, and only for the viewer's own pair, yes/no checks, or the admin queue. The privacy test checks every member's page data.
- **Authorization:** all 9 organiser actions require the organiser's account. All 7 participant actions identify the user from their cookie or account, never from a form field. Participant and exclusion IDs are checked against the exchange. Admin actions check the user is an admin.
- **CSRF:** Server Actions are POST-only, and Next compares Origin with Host; with `SameSite=Lax` cookies that covers it. The only GET with a side effect is #6.
- **Output escaping:** React escapes all user text. The JSON-LD block escapes `<`. `sms:` and `mailto:` links are `encodeURIComponent`-encoded.
- **Email header injection:** not applicable, because the server sends no email. The invite's `mailto:` link opens the organiser's own mail client, the subject is URL-encoded, and exchange names now lose line breaks (#2).

## Tests

`npm test` runs these suites:

- `test:santa`: the draw itself, plus `forcedGivers` checked against brute force.
- `test:santa-privacy`: no member's page data ever reveals another member's match.
- `test:santa-flow` (new): the real Server Actions and private-link route, driven as separate browsers. It covers:
  - a group of four from start to reveal, with messages
  - couples kept apart over 25 draws
  - impossible and predictable exclusion sets
  - a member trying to leave after the draw
  - re-draws before and after reveals
  - every organiser control attempted by non-organisers
  - fixes 1–4
  - the switch in all three modes

Each fix was confirmed by temporarily reverting it and watching the suite fail.

These are not browser tests: nothing runs HTTP, rendering, or client JavaScript. The proxy was checked by hand against `next start` (see the smoke test below).

## Release checklist

The switch is the `SECRET_SANTA` environment variable: `on` (default), `readonly`, or `off`. Change it and restart; no rebuild is needed. With `off`, every `/secret-santa` path returns 404 from `src/proxy.ts`, the header, menu, banner, gifts card, and sitemap entry disappear, and every action refuses.

1. Confirm `npm run check` passes and `next build` succeeds.
2. Back up `data/app.db`.
3. Deploy with `SECRET_SANTA=off`. Confirm `/secret-santa` returns 404, no Secret Santa link appears in the header or on `/gifts`, and the `santa_*` tables exist (migrations 0012–0014 run on start).
4. Set up per-IP rate limits at the reverse proxy for `POST /secret-santa/*` and for 404s under `/secret-santa/*` (findings #5 and #8). Remove `/secret-santa/p/*` from access logs (#7).
5. Restart with `SECRET_SANTA=on`, then smoke-test using three private windows:
   - create an exchange, join from the other two windows, and add a fourth person by name
   - keep two people apart, draw, and reveal in each window
   - send a message both ways, report one, and confirm it appears on `/admin/accounts`
   - delete the test exchange
6. Go live before **1 November**. The season banner turns itself on that day (`isSantaSeason`), so a decision made after then means users will already have seen the banner.

## Rollback

Use the lowest level that fixes the problem. Each level is one restart.

1. **`SECRET_SANTA=readonly`** is for problems during the season: abusive messages, a suspected bad draw, or load. Everyone can still see their match and report messages; nothing else can change.
2. **`SECRET_SANTA=off`** hides the whole feature. All data stays in the database, so switching back to `on` restores everything, including draws people have already seen.
3. **Redeploy the previous image.** Migrations 0012–0014 only add tables and nullable or defaulted columns, so older code runs against the newer database unchanged. Only restore the step-2 backup if the data itself is bad. Anything created after the backup would be lost.

Don't delete `santa_*` rows to fix a bad draw. Have the organiser reset and redraw. Everyone who had already looked is then told their match changed.

## Monitoring

- **`/admin/analytics`:** `santa_group_created`, `santa_member_joined`, `santa_draw_run`, and `santa_reveal_opened`. Draws with no reveals over the following days suggest people can't find their link.
- **`/admin/accounts` → reported messages:** check the queue daily during the season. A spike is the signal to switch to `readonly`.
- **Server logs:** watch for 5xx responses under `/secret-santa/*` and `[analytics] could not record` lines. A run of 429s from the proxy limits means someone is scripting joins.
- **Draw health:** this query lists exchanges drawn more than 3 days ago where under half of participants have looked:
  ```sql
  select e.code, e.drawn_at, count(*) as people,
         sum(p.seen_draw = e.draw_count) as looked
  from santa_exchanges e join santa_participants p on p.exchange_id = e.id
  where e.status = 'drawn' and e.drawn_at < unixepoch() - 3*86400
  group by e.id having looked * 2 < people;
  ```
- **Exchanges per account per day:** an account sitting at the cap of 10 is either a power user or a script.

## Known limitations

- **Small groups reveal more by arithmetic.** In a group of 3, anyone who knows their own match can work out the rest. In a group of 4, an organiser who also takes part can narrow down the others. Refusing predictable draws only covers what the organiser can deduce from the exclusions alone, not from exclusions combined with their own match.
- **Look-alike names in different scripts still pass.** A Cyrillic "а" in place of a Latin "a" is not folded.
- **Resetting the draw leaves earlier reservations in place.** Reservations a Santa made on their old match's list stay there, anonymously, and nobody is prompted to release them.
- **No server-side email or notifications.** People who lose their link depend on the organiser replacing it, and that replacement is visible to the whole group.
- **No client-side or browser tests.** Rendering and focus behaviour are untested.
