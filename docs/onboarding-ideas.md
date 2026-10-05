# Onboarding ideas

Ways to get a first-time visitor to a list with something on it, and then to an
account, faster. Collected after the homepage's paste-a-link start shipped
(`startFromLink` in `src/app/new/actions.ts`, `DraftBanner` in the editor).

Rough order is by how much each is likely to move the numbers.

## To fix before leaning on paste-a-link

These aren't onboarding ideas, but the homepage form makes them matter more:
it turns an anonymous visitor into a server-side fetch and a new list in one
request.

- [ ] **Refuse private addresses in the scraper.** `src/lib/scrape-fetch.ts`
      will fetch `localhost`, LAN addresses and cloud metadata IPs. Resolve the
      host and reject loopback, private, link-local and unique-local ranges
      before fetching, and again after each redirect.
- [ ] **Rate-limit `startFromLink` per IP.** Each submission creates a list, so
      a bot can fill the database. A small in-memory limiter is enough for one
      Node process; `/admin` can clean up what gets through.
- [ ] **Sweep abandoned drafts.** Drafts with no gifts and no visits after N
      days are clutter. The admin screen already counts unclaimed drafts.

## Ideas

- [ ] **Share to Unwrap from a phone.** Add a `share_target` to
      `src/app/manifest.ts` so an installed Unwrap shows up in the phone's share
      sheet. Sharing a product from a shop's app lands it on the list without
      copying a URL. Most gift browsing happens on phones, so this is probably
      the biggest win.
- [ ] **Ask them to save when they share.** Opening the share dialog on a draft
      is the moment there's something to lose: guests are about to get a link to
      a list that lives in one browser. Put the save prompt in the share dialog,
      not just at the top of the editor.
- [ ] **Paste several links at once.** People arrive with a pile of tabs. Accept
      a block of URLs (one per line, or anything the URL extractor finds) and add
      each as a gift, scraping them in parallel.
- [ ] **An example list.** The design paired the hero's button with "See an
      example", and the homepage still notes there is no demo list to point at.
      A read-only seeded list shows a guest's view better than any copy can.
- [ ] **Paste-a-link in the closing call-to-action.** The bottom of the homepage
      still sends people to `/new`. Reuse `StartFromLinkForm`, restyled for the
      ink section.
- [ ] **Start an occasion with something on it.** The occasion links prefill a
      name. They could also add two or three common ideas ("Coffee things",
      "Books") so the list never opens empty. Ties in with
      [tags-and-suggestions.md](tags-and-suggestions.md).
- [ ] **Suggest a name from the first gift.** A list started from a link is
      called "My wishlist". The banner already points at the pencil; a
      one-tap suggestion based on the date or the gift would get more of them
      renamed.
