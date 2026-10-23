# Event tracking

What people do on lists — which lists are viewed, which gifts are seen, which
get clicked through to a shop — recorded without recording who did it.
Switched on by default.

## Turning it off

Set `EVENT_TRACKING=off` and restart. No rebuild. Unset means on; any value
other than `on`, `1`, `true` or `off` also counts as off, so a typo fails
closed. With it off, buy buttons link straight to the shop as they always
have, no tracking cookie is set and the browser sends nothing.

To stop recording without a restart, use **Pause recording** at the top of
`/admin/analytics`. Links keep going through `/go` while paused; only the
writing stops, within about five seconds.

## What is recorded

One row in `item_events` per event:

| Event | Sent by | When |
|---|---|---|
| `list_view` | browser | a list or gift guide page opens |
| `item_impression` | browser | at least half of a gift or idea card is on screen; once per gift per page view |
| `filter_used` | browser | a guest changes the grid's filter, or uses the price filter (a chip, Apply or Clear filters; opening a filtered link doesn't count). Only on a list page, not on a /gifts shelf |
| `sort_used` | browser | a guest changes the sort in the filter bar, recording which of `owner`, `top`, `low`, `high`, `newest` or `az` they chose (opening a sorted link doesn't count). Only on a list page, not on a /gifts shelf. While `GIFT_SORT` is off, the grid's own sort sends `owner`, `low` or `high` |
| `suggestion_impression`, `suggestion_click` | browser | a gift guide tile on the home page or /gifts is seen or opened |
| `outbound_click` | server | a buy button is followed, through `/go/<itemId>` |
| `item_claim` | server | a gift is reserved |
| `idea_expand` | — | allowed, but nothing sends it yet: ideas have no expand control |

Each row holds the event type, time, list / item / idea ids, a few fixed
properties (which filter, where on the card the click was), whether the
request looked like a bot, and two random ids from first-party cookies:

- `unwrap_vid`, the visitor: set once, expires 13 months later, never extended.
- `unwrap_sid`, the session: 30 minutes, renewed by each event, so it is
  replaced after 30 idle minutes.

Never stored: account, name, email, IP address, user-agent text, referrer.

## What is not

Nothing is recorded when the browser sends Do Not Track or Global Privacy
Control, when the person looking owns the list, or while paused. These are
counted per day, as are events refused for being malformed, too large, rate
limited or naming ids that don't exist; the counts are on `/admin/analytics`.

## Looking at it

`/admin/analytics` shows per-day counts, the top gifts by clicks out, the
busiest visitors and a live feed. A filter bar narrows all of it except the
"not stored" counts, which hold nothing to filter on:

- **Window**: today, 7, 30 or 90 days.
- **Bots**: everyone, hide bots, or bots only (the `is_bot` flag).
- **Types**: any combination of event types.
- **One visitor, session or list**: click its id in the feed or the busiest
  visitors table. A visitor's view sums them up and turns the feed into their
  timeline, newest first.
- **Hide a visitor**: from the busiest visitors table or a visitor's view;
  for the crawler the user-agent check missed, or your own phone.

A visitor is the `unwrap_vid` cookie, not an account, so this never answers
"what did this person do". The whole filter is in the URL, so a view can be
bookmarked or pasted to another admin.

## Retention

Raw events older than 13 months are deleted once a day by an in-process timer
(`src/lib/event-retention.ts`), whether or not tracking is currently on.
Deleting a list or gift deletes its events.

## Where things are

- `src/lib/track.ts`, `src/components/tracking.tsx` — the browser side.
- `src/app/api/events/route.ts`, `src/lib/event-validation.ts` — what the server accepts.
- `src/lib/tracking.ts` — ids, Do Not Track, owner and pause checks, writing rows.
- `src/app/go/[itemId]/route.ts` — the buy-button redirect; tags links with `outboundHref` exactly as the pages do.
- `src/lib/bot.ts` — the bot check.
- `src/lib/tracking-filter.ts`, `src/lib/tracking-stats.ts` — the admin view's filters and the queries behind them.
- `scripts/test-events.mts` — `npm run test:events`.
