# Handoff: Wishly — gift list web app

## Overview

Wishly is a gift-list web app. An owner creates a list for an occasion (birthday, wedding, baby shower, Christmas), adds gifts by pasting a product URL (the app scrapes title/photo/price) or by writing them in by hand, then shares one public link. Guests open the link with no account and **claim** a gift, which marks it as taken for everyone else so nobody doubles up.

The product's defining rule: **the list owner never learns who claimed what.** They see a count of claimed gifts and a total chipped in, never which items or which people. This is not a user setting — it is a fixed guarantee, and a lot of the UI copy exists to make that legible.

Nine screens are designed: landing, sign-up, create-a-list (2 steps), owner's editor, add-a-gift (3 states), public list, reserve dialog + guest's own page, mobile public list + reserve sheet, and the invitation email.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy directly.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Svelte, native, etc.) using its established component patterns, styling approach and libraries. If no codebase exists yet, choose an appropriate framework and implement there.

Two specific notes on the source files:

- They are authored in a streaming component format (`.dc.html`). Everything is inline styles on plain HTML elements. Read them for values and structure; do not port the file format.
- `<image-slot>` is a design-tool placeholder for a draggable image. Wherever you see it, implement a normal `<img>` with `object-fit: cover` plus an empty state.

## Fidelity

**High fidelity.** Colours, typography, spacing, radii and copy are final. Recreate the UI to match, using the codebase's own primitives where they exist (buttons, inputs, dialogs) rather than hand-rolling.

The only deliberately unfinished parts:

- **Photography.** All gift images are placeholders. Layout expects a **4:5 portrait** crop.
- **Icons.** Drawn inline as simple stroke SVGs (link, eye-off, check, plus, pencil, image, gift-box, card). Substitute the codebase's icon set — match weight (1.6–2.0px stroke, round caps) and size (11–19px).
- **Logo.** A 22–26px rounded square with a "W". Replace with the real mark.

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `ink` | `#17112B` | Primary text, dark rail/sidebar background, secondary buttons |
| `ink-72` | `rgba(23,17,43,.72)` | Secondary text on paper (meta, descriptions at 12–13px) |
| `ink-76` | `rgba(23,17,43,.76)` | Body copy on paper |
| `ink-62` | `rgba(23,17,43,.62)` | Caps labels, tertiary meta (5.0:1 — do not go lighter for text) |
| `ink-line` | `rgba(23,17,43,.10)` | Hairline borders on cards and rows |
| `ink-line-strong` | `rgba(23,17,43,.18)` | Input borders, outline-button borders |
| `paper` | `#FAF8F5` | Page and card background |
| `surface` | `#FFFFFF` | Cards and inputs sitting on paper |
| `canvas` | `#EDEAE4` | The design-doc backdrop only; not part of the app |
| `violet` | `#5738E8` | The only action colour: primary buttons, links, focus, selected state |
| `violet-hover` | `#4527C7` | Hover/pressed for violet |
| `violet-wash` | `rgba(87,56,232,.07–.10)` | Selected-state fills, informational panels |
| `rose` | `#B4145A` | Group-gift / chip-in status only |
| `rose-dark` | `#8E0F47` | Rose text on rose wash |
| `pine` | `#0E6E58` | Claimed / success status only |
| `pine-dark` | `#0A5745` | Pine text on pine wash |
| `amber` | `#8A5510` | Warning rows (dead link, missing photo) |
| `amber-dark` | `#7A4A0E` | Amber text |
| `champagne` | `#F2D48B` | Accent on the dark ink surfaces only — never on paper |

On the dark ink surface use `#FAF8F5` at 100% for primary text, `rgba(250,248,245,.88)` for body, `rgba(250,248,245,.72)` minimum for meta. Fills on ink: `rgba(250,248,245,.09–.14)`.

**Status colour is semantic and exclusive.** Violet means "you can act", rose means "group gift", pine means "already claimed", amber means "this item needs attention". Nothing decorative uses them.

### Typography

Two families, no others.

- **Gabarito** — all interface text. Weights 400 / 500 / 600 / 700 / 800.
- **Instrument Serif** — display only, at 22px and above (page headlines, prices on gift cards, stat figures). Regular weight only.

```
font-variant-numeric: tabular-nums   /* set globally — prices must align in columns */
```

| Role | Spec |
|---|---|
| Landing hero | Instrument Serif 62px / 1.02, `letter-spacing:-2px` |
| Page headline | Instrument Serif 40–46px / 1.02–1.05, `-1.2px` to `-1.4px` |
| Dialog / section headline | Instrument Serif 27–36px / 1.1, `-.7px` to `-1px` |
| Stat figure | Instrument Serif 30px |
| Gift card price | Instrument Serif 22px |
| Card title | Gabarito 600 16.5px / 1.25, `-.2px` |
| Row title | Gabarito 600 14.5–15.5px |
| Body | Gabarito 400 13–15.5px / 1.65–1.8 |
| Meta / caption | Gabarito 400–500 12–12.5px |
| Caps label | Gabarito 600 10.5–11px, `letter-spacing:.9–1.6px`, uppercase |
| Button | Gabarito 600 13.5–15px |
| Badge / pill | Gabarito 600 10.5–12.5px |
| Monospace (URLs) | `ui-monospace, Menlo, monospace` 500 13.5px |

### Spacing, radius, elevation

- Spacing follows a loose 8px rhythm. Common values: 7, 9, 10, 12, 14, 16, 18, 22, 26, 28, 32, 40.
- Page gutters: 28–40px desktop, 22px mobile.
- **Radius is fixed at three values:** `10px` controls (inputs, small tiles, secondary buttons), `14px` cards, `999px` pills and all primary buttons. Phone bezel is the one exception at 34px outer / 26px inner.
- **One shadow token**, used on cards and nothing else:
  `box-shadow: 0 1px 2px rgba(23,17,43,.04), 0 10px 30px -18px rgba(23,17,43,.3)`
  Sheets and floating panels get a heavier version: `0 -10px 40px rgba(23,17,43,.3)` (bottom sheet), `0 30px 60px -20px rgba(0,0,0,.5)` (dark-surface inset preview).
- Focus ring: `border: 1.5px solid #5738E8` + `box-shadow: 0 0 0 3px rgba(87,56,232,.14)`.
- No coloured glows, no gradient backgrounds, no borders heavier than 1.5px.

## Screens

Source file: `Wishly - Full Site.dc.html`. Each screen is a `<div class="scr" id="sN" data-screen-label="…">` — the numbers below match those ids.

---

### 01 — Landing (`#s1`)

**Purpose:** convert a first-time visitor into a list.

**Layout:** 1280px shell. Header bar (18px / 40px padding, bottom hairline). Hero in a 2-column grid, `1.06fr 1fr`, full-bleed panels — left is paper, right is `ink`. Below, a 3-column "how it works" band, 44px / 40px padding, 30px gap, separated by a hairline.

**Header:** logo + wordmark left. Right: "How it works", "Occasions", "Pricing" (Gabarito 500 13.5px, `ink-76`), "Sign in" (600, `ink`), then a violet pill "Start a list".

**Left hero:** an availability chip (999px, 1px `ink-line-strong` border, 6px pine dot, "Free for lists of any size"). Headline "A gift list people actually use." in Instrument Serif 62px, max-width 520px. Sub-paragraph 15.5px / 1.75, max-width 450px. Two buttons side by side — violet pill primary "Start a list — it's free", outline pill "See an example" — then "No card needed. Takes about two minutes." at 13px `ink-66`. A 3-up stat row sits under a hairline 46px below: `2 min` / `Any shop` / `Zero`, each Instrument Serif 30px over a 12px label.

**Right hero (ink panel):** two large hairline circles bleeding off the corners (`1px solid rgba(250,248,245,.10–.12)`, 300–420px) as the only ornament. Centred: a floating list preview card — paper, 14px radius, heavy shadow — with a header row (🎂 emoji, "Maya turns 30", right-aligned `wishly.co/maya-30`) and two gift thumbnails in a 2-col grid, one normal with a violet status band, one greyed with a pine band and "✓ Claimed". Below it, a reassurance panel on `rgba(250,248,245,.10)` with the eye-off icon in champagne: "**The surprise stays intact.** Guests see what's already taken. You only ever see a count."

**How it works:** three numbered blocks. Number in Instrument Serif 24px at `rgba(23,17,43,.3)`, then a 600 16px title, then 13.5px / 1.7 body. Copy: "Paste links as you shop" / "Send one link" / "Nobody doubles up".

---

### 02 — Create an account (`#s2`)

**Purpose:** save a list the user has already started. Account creation is deliberately deferred until there is something to lose.

**Layout:** two cards side by side — 560px form, 400px dark summary (min-height 520px).

**Form:** logo, then "Save your list" (Instrument Serif 36px) and "You've added four gifts already. An account keeps them, and lets you edit the list after you've shared it." Two OAuth buttons (full-width, 10px radius, 1px border, 13px padding, 16px square icon placeholder). An "or use your email" divider (hairline / 11.5px label / hairline). Name and email fields — **email shown in focus state** (violet 1.5px border + 3px violet-14% ring + a 1.5px caret). An unchecked 18px / 5px-radius checkbox: "Email me when someone chips in toward a group gift. Never anything that spoils a surprise." Violet pill "Save my list". Centred "Already have an account? Sign in".

**Summary card (ink):** caps champagne label "Your list so far", then the list identity (emoji + name + "4 gifts · not shared yet") above a hairline. Four gift rows — 44×52px `rgba(250,248,245,.1)` thumb, title 13px, price 12px at 70%. Footer, pinned bottom: "Leave now and these are gone. We don't email you unless you ask us to."

---

### 03 — Create a list (`#s3`)

Two cards: step 1 (620px) and step 2 (460px).

**Step 1 header (ink):** caps champagne "Step 1 of 2", "Name your list" in Instrument Serif 30px, and a 2-segment progress indicator (26×3px pills, champagne then `rgba(250,248,245,.28)`).

**Step 1 body — the emoji picker is the important part.** There is *no occasion-type selector.* Instead the list name field is a single 10px-radius bordered box split into two parts: a fixed-width emoji button (violet-wash background, right hairline, 19px emoji + a small violet chevron) and the text input. Below the field, a suggestion row: "Suggested from \"turns 30\":" followed by five 34px emoji chips — the first selected (violet-wash fill + 1.5px violet border), the rest white with a hairline — then a "Browse all" pill in violet.

> **Behaviour to implement:** suggestions are derived from the list name as the user types. "turns 30" → 🎂 🥳 🍾 🎁 ✨. Debounce ~300ms, keyword-match against an emoji vocabulary, keep the user's explicit pick sticky once they choose. The chosen emoji becomes the list's identity everywhere: sidebar, public header, guest page, email subject.

Date field beside the name (`1.7fr 1fr` grid). "Note to guests — optional" textarea, min-height 50px, pre-filled.

**Claim rules:** a bordered card with a header row and three radio rows, each a title plus one line of consequence copy. Options: *Anyone with the link, anonymously* (selected — radio is a 16px circle with a 5px violet ring); *Ask for a first name*; *Require a Wishly account*. Under it, a violet-wash panel with the eye-off icon: "**You'll never see who claimed what** — not before the party, not after. That isn't a setting."

Footer: "All of this is editable later" left; outline "Save draft" and violet "Add some gifts" right.

**Step 2:** the share step. Link field with the slug bolded violet and a dark "Copy" pill, plus "Tap the name to change it while it's still private." A 2-up grid: a QR card (52px checkerboard placeholder) and an "Invite by email" card. A pine-wash panel: "Eight weeks to go — good timing / Lists shared a month or more ahead get about twice as many gifts claimed." Violet pill "Go to my list".

---

### 04 — Owner's editor (`#s4`)

**Purpose:** the owner's home for one list. Also the lists dashboard, via the rail.

**Layout:** 1280px, grid `248px 1fr`, min-height 840px. Left rail is `ink` full-bleed; right is paper with 28/32px padding.

**Rail:** logo; caps "My lists" label; three list rows (emoji + name, 13.5px) with the active one filled `rgba(250,248,245,.13)` at 9px radius; a champagne "＋ New list" row; a hairline, then "Gifts I've reserved" and "Settings"; pinned to the bottom, a 30px violet circular avatar with "Maya Ferrand / Free plan".

**Header:** caps `ink-62` "Saturday 14 November · 8 weeks away"; "Maya turns 30" in Instrument Serif 40px; a meta line "12 gifts · £15 – £420 · ● Live since 28 Sept" (the dot and text pine). Right: outline pill "Preview as guest", violet pill "＋ Add gift".

**Stats:** 3-col grid of white cards, 12px radius. `148` people opened your link / `3` gifts claimed — which ones is hidden (pine figure) / `£244` chipped in toward Lisbon (rose figure). Figures are Instrument Serif 30px.

**Share bar:** white card, link icon, `wishly.co/**maya-30**` in mono with the slug violet, then dark "Copy link" pill and outline "QR code" / "Invite by email" pills.

**Surprise banner:** violet-wash, eye-off icon, "**Three gifts are claimed and we won't tell you which.** Guests see live status; you see a count." with a violet "Why we do this" link.

**Filters:** pill row — "All 12" (ink filled), "Most wanted 3", "Needs a photo 1", "Group gifts 1"; right-aligned "Drag to reorder".

**Item rows** (8px gap, 12px radius, white, hairline; 12/15px padding). Left to right: a `⠿` drag handle at 28% ink; a 44×52px thumbnail (7px radius); title + badge + meta; price at 600 16px; then two 30px icon buttons (edit, more). Variants:

- *Most wanted* — violet-wash badge "Most wanted".
- *Group gift* — rose-wash badge "Group gift · 6 in" and a 6px rose progress bar (58%) in place of the meta line, max-width 280px.
- *Needs attention* — amber-wash background `rgba(138,85,16,.05)`, amber border, dashed thumbnail with an image icon, amber meta "Link sold out, no photo found — items with a photo get claimed three times as often", and a dark "Fix it" pill instead of the icon buttons.
- *Quantity* — neutral badge "Qty 2", meta "two guests can each claim one".
- *No photo* — flat `rgba(23,17,43,.05)` tile reading "No photo".

Footer: a dashed 12px-radius drop zone, "Paste a link, or drag a photo here to add a gift".

---

### 05 — Add a gift (`#s5`)

Three cards showing the sequence: **paste** (430px), **fetching** (400px), **confirm** (400px, violet-tinted border to mark it active).

**Paste:** "Add a gift" + "Paste a link from any shop and we'll fetch the rest." A focused input (violet border + ring + caret) containing a truncated URL, then "Amazon, Etsy, John Lewis, Zara and most independents fill in automatically." An "or" divider, then three alternative routes as bordered rows with icons: *Write it in myself* (title, photo, price, note — no link needed) / *Cash or an experience* (guests chip in toward a goal) / *Get the browser button* (add gifts while you're already shopping).

**Fetching:** a 15px spinner (2.5px ring, violet top) + "Reading kinto-europe.com". A 96×118px shimmer block (`linear-gradient(100deg, …)`) beside three skeleton lines, then three body skeleton lines. A progressive checklist — "Found the title" ✓ pine, "Found 4 photos" ✓ pine, "Looking for a price" ◦ at `ink-62`. Escape hatch at the bottom on a grey wash: "Taking too long? **Fill it in by hand** — we'll keep the link."

**Confirm — every field editable.** A pine-wash success strip "✓ Filled in — check we picked the right photo". Then the chosen photo at 96×118px with a 4-thumb chooser below it (20×24px; first selected with a violet border; last is an upload affordance "↑"). Fields: Title; Price and Qty side by side (Qty 68px with a chevron). Then "Why you want it" textarea, pre-filled with the owner's reason — this copy is what makes the public list feel personal, so keep the field prominent. Two toggle rows: *Mark as most wanted* (on — violet 36×21px track) and *Let guests chip in together* (off, with sub-copy "Splits the price across several people"). Footer: violet "Add to list" + outline "Add & another".

---

### 06 — Public list (`#s6`)

**Purpose:** the screen that matters most. What a guest sees from the shared link.

**Layout:** 1280px. A slim guest header (logo; "1 gift reserved by you"; outline "Make your own list"). Below, grid `344px 1fr`: sticky `ink` context rail, paper content column.

**Context rail** (36/30px padding, 22px gap, min-height 900px):
1. Emoji + caps champagne date, then "Maya turns 30" in Instrument Serif 46px.
2. The owner's note, 14.5px / 1.8 at 88% paper.
3. A 3-row stat block — 1px-gapped rows on `rgba(250,248,245,.09)`, 12px radius on the group: "Still free 9 of 12", "Price range £15 – £420", "Maya can see **Nothing**" (champagne value).
4. A champagne-wash quote panel: "**Maya says:** the coffee things are the ones she'd use every single day."
5. A legend — "The coloured band means" plus three 18×4px swatches: violet *Most wanted*, pink *Chip in together*, teal *Already taken care of*. (On ink, use the lighter variants `#8A72FF`, `#E85A93`, `#3FBFA1` for visibility.)
6. Pinned bottom above a hairline: eye-off icon + "Reserving costs you nothing. It only stops two people buying the same coffee pot.", then a paper pill "Share this list".

**Filter bar:** "All 12" (ink filled) / "Still free 9" / "Under £50" / "Most wanted 3", right-aligned "Maya's order ▾".

**Gift grid:** 3 columns, 18px gap, 24/28px padding. Each card is white, 14px radius, hairline, `display:flex; flex-direction:column` so buttons align along the bottom row.

Card anatomy, top to bottom:
1. **Photo, 250px tall, 4:5-ish portrait**, full-bleed to the card edges.
2. **A 4px status band** directly under the photo — this is the semantic signal. Violet = most wanted, rose = group gift, pine = claimed, `rgba(23,17,43,.12)` = ordinary.
3. Optional status pill (999px, 10.5px 600, wash background matching the band).
4. Title (600 16.5px) and price (Instrument Serif 22px) on a shared baseline, `align-items:baseline`, price `white-space:nowrap`.
5. The owner's reason, 13px / 1.65 `ink-76`, `flex:1` so it absorbs height differences.
6. Source domain "kinto-europe.com ↗" in violet 12px, or "Added by hand · no link" in `ink-66`.
7. Action: **one** filled violet pill per screen (the most-wanted item), every other available item gets an outline violet pill. Same label throughout: "I'll get this one".

Card variants:
- **Group gift** — rose band and pill "Chip in · 6 people so far", a 6px rose progress bar at 58%, "£244 raised. Any amount helps and nothing is wasted.", rose filled button "Chip in".
- **Claimed** — pine band, pine pill "✓ Taken care of", photo covered by a `rgba(250,248,245,.5)` scrim, title and price dimmed, **no button at all** (the state is the affordance), body copy "Claimed on 2 October. Maya doesn't know — don't spoil it."
- **No photo** — the photo area becomes a `rgba(23,17,43,.035)` panel with a 26px image icon and "Maya didn't add a photo".
- **Quantity** — neutral pill "1 of 2 still free".

**Footer:** a white card, "Showing 6 of 12 — four more under £50" + outline pill "Show all 12".

---

### 07 — Reserve dialog and the guest's own page (`#s7`)

**Reserve dialog (470px):** the gift as a 72×88px thumb + title + "£68 · kinto-europe.com". "Reserve this gift?" in Instrument Serif 28px. Body: "It'll show as taken to other guests. Maya sees nothing. Nothing is charged, and you can release it any time." A "First name — so guests can coordinate" field (**shown only when the list's claim rule requires a name**). A checked 19px violet checkbox "Email me a reminder three days before the party". Violet pill "Yes, reserve it", then a plain-text "Never mind".

**Guest page (730px):** "Gifts you've reserved" (Instrument Serif 30px) + "Only you can see this page. We'll email a reminder three days before each event." — this page is keyed to a cookie/magic link, not an account.

Two reservation rows, white cards with a 66×80px thumb:
- *Claimed item* — caps event line (emoji + "Maya turns 30 · 14 Nov"), "Stovetop espresso pot · £52", "Reserved by you on 2 October · kinto-europe.com ↗", then three pills: dark "Mark as bought", outline "Add to calendar", outline "Release it".
- *Group contribution* — "Weekend in Lisbon — you chipped in £40", "£244 of £420 raised · charged only when the goal is met", plus a rose progress bar. **Payments are only captured when the goal is met.**

Then a violet-wash panel with a box icon: "**Sending it directly?** Maya shared a delivery address for this list." + "Show address". Finally, under a hairline, "Lists you've been invited to" — two small cards with emoji, name and "9 gifts still free".

---

### 08 — Mobile (`#s8`)

Two 392px frames (34px outer radius, 9px ink bezel, 26px inner radius).

**Public list:** the rail's content becomes the header — the whole ink block scrolls away. 42px status bar, emoji + caps champagne date, "Maya turns 30" at Instrument Serif 38px, the note, then three inline chips ("9 of 12 free", "£15 – £420", and the champagne eye-off chip "Maya sees nothing"). A horizontally scrolling filter row. Then the same gift cards at full width — photo 290px tall, 15px padding, a **15px-tall primary button** (≥44px tap target). The claimed card is compressed: 140px photo, no body copy. A sticky bottom bar: "1 gift reserved by you" + dark "Review" pill, then the home indicator.

**Reserve sheet:** the same content as the desktop dialog in a bottom sheet — background blurred 2px at 42% opacity behind a `rgba(23,17,43,.42)` scrim, sheet corners 22px top, 26px bottom to meet the bezel, `0 -10px 40px` shadow, 44×4px grab handle centred above the content.

---

### 09 — Invitation email (`#s9`)

600px, plain enough to look forwardable. A grey preheader strip "**Maya Ferrand** shared a gift list with you". Body: emoji + caps date, "Maya turns 30" in Instrument Serif 34px, the owner's note at 14.5px / 1.8, then a 4-up strip of gift thumbnails with prices (the fourth is a "+9 more" tile). A violet pill "See the list", then closing reassurance: "Claiming a gift takes one tap and no account. Maya won't be told who claimed what."

> Build this as table-based HTML email with inline styles. Instrument Serif will not render in most clients — fall back to a serif stack (`Georgia, 'Times New Roman', serif`) and accept the substitution.

## Interactions and behaviour

**URL paste → autofill.** Server-side fetch and scrape (OpenGraph / schema.org / JSON-LD, then site-specific fallbacks). Return title, price + currency, and an array of candidate images. Render the *fetching* state immediately and stream results into the checklist as each field resolves. Always land on the *confirm* state with everything editable — never save silently. Provide a visible manual fallback from the first second. Handle: no price found (leave blank, don't guess), no image found (offer upload, and flag the item in the editor), scrape blocked or timed out (keep the URL, fall back to manual), and a URL that is already in this list (warn rather than block).

**Claiming.** One tap from the public list opens the dialog. Ask for a first name only if the list's rule requires it. On confirm: optimistic update to "Taken care of", and the guest gets a durable identity (signed cookie plus an emailed magic link) so their reservations page survives a new session. Releasing returns the item to available. For `quantity > 1`, track claims per unit and show "N of M still free"; the item only greys out at N = M. Concurrency: last-write-loses is not acceptable here — claim atomically and show "someone just claimed this" if it fails.

**Group gifts.** Any contribution amount. Show progress as a percentage bar plus raised/goal in text. Authorise payment on contribution, **capture only when the goal is met**; refund or release if the event passes unmet. The owner sees the total raised, never the contributor list.

**The surprise guarantee.** Enforce server-side, not just in the UI: the owner's session must never receive claim identities or per-item claim state for a list in surprise mode — only aggregate counts. This is the one rule the product is built on; treat leaking it as a data bug, not a UI bug.

**Emoji suggestions.** Debounced keyword match on the list name (see screen 03). An explicit user pick wins and stops updating.

**Editor.** Drag to reorder (persist an explicit `position`). Inline edit of any field. Filters are client-side over the loaded list.

**States to build for every list view:** empty (new list, no gifts), loading, error, and the "needs attention" row treatment for dead links and missing photos.

**Motion.** Restrained. 150–200ms ease-out for hovers and pill fills; 250–300ms for the bottom sheet (translateY + scrim fade); the fetch spinner is a plain 1s linear rotation. No entrance animations on list items.

**Responsive.** Gift grid 3-up desktop → 2-up tablet → 1-up mobile. The context rail is a left column above ~1100px and becomes the page header below it. The editor rail collapses to a drawer. Filter rows scroll horizontally on mobile. Touch targets ≥44px.

**Accessibility.** Status is never colour-only — every band pairs with a text pill. Body text is ≥4.5:1 against its background (the `ink-62` ramp is the floor at 5.0:1; lighter values in the files are decorative dividers and disabled states only). Visible focus ring on every control (spec above). The reserve dialog is a focus-trapped modal with a labelled heading and Escape to dismiss. Progress bars need `role="progressbar"` with the raised/goal values.

## State

Per list: `id, slug, name, emoji, eventDate, note, claimRule ('anonymous' | 'firstName' | 'account'), surpriseMode (always true in this design), deliveryAddress?, items[], position ordering`.

Per item: `id, title, url?, sourceDomain?, images[], selectedImageIndex, price, currency, quantity, claimedCount, reason?, isMostWanted, isGroupGift, goalAmount?, raisedAmount?, needsAttention?`.

Per guest (no account): `guestToken, firstName?, claims[] (itemId, claimedAt, markedBought), contributions[] (itemId, amount, status)`.

Owner-visible aggregates only: `claimedCount`, `totalRaised`, `linkOpens`.

## Assets

- **Fonts:** Gabarito and Instrument Serif, both Google Fonts (SIL Open Font License). Self-host for production.
- **Icons:** hand-drawn inline SVGs in the prototype — replace with the codebase's icon set.
- **Images:** none real. All gift photos are placeholders; expect 4:5 portrait.
- **Logo:** placeholder "W" mark.
- **Emoji:** rendered as system emoji glyphs. Consider a consistent set (e.g. Noto Emoji) so the list identity looks the same across platforms.

## Files

| File | Contents |
|---|---|
| `Wishly - Full Site.dc.html` | **The design to build.** All nine screens, final system. |
| `Gift Lists.dc.html` | Earlier exploration — four turns of alternative visual directions and layouts, kept for context. Not the target. |
| `image-slot.js` | Design-tool dependency for the draggable image placeholders. Not for production. |
| `support.js` | Runtime for the prototype file format. Not for production. |

Open either HTML file directly in a browser to see the designs.
