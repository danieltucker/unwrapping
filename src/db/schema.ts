import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/** List owners. Guests never get a row here; they are identified by a cookie token. */
export const users = sqliteTable("users", {
  id: id(),
  // Appears in every public list URL: /lists/<handle>/<slug>
  handle: text("handle").notNull().unique(),
  email: text("email").notNull().unique(),
  // Nothing is emailed yet; the column exists so verification can be added
  // later without a migration.
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
  name: text("name").notNull(),
  /**
   * A photo of themselves, stored the same way a gift photo is: written to
   * data/uploads and served by /uploads/<name>. Null is the ordinary state,
   * and the one every avatar has to keep drawing for — see AccountMenu, which
   * falls back to initials.
   */
  avatarUrl: text("avatar_url"),
  /**
   * Their own birthday, at local midnight like a list's event date, so it
   * reads back as the day they typed rather than the day before.
   *
   * The year is part of it because a date input gives us one; nothing displays
   * it, and nothing should start without asking them. Nothing is scheduled off
   * this yet.
   */
  birthday: integer("birthday", { mode: "timestamp" }),
  passwordHash: text("password_hash").notNull(),
  /**
   * Granted from /admin by another administrator. The people named in
   * ADMIN_EMAILS are administrators whatever this says, and are the only ones
   * the screen can't take it away from — see src/lib/admin.ts.
   */
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  /**
   * Set by an administrator; null for everybody in good standing. A banned
   * account can't sign in, its sessions are gone, and its lists answer 404 to
   * everyone — but nothing is deleted, so lifting the ban puts it all back.
   */
  bannedAt: integer("banned_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

/** Server-side sessions, so sign-out and revocation actually invalidate. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The cookie holds the raw token; only its hash is stored.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const CLAIM_RULES = ["anonymous", "firstName", "account"] as const;
export type ClaimRule = (typeof CLAIM_RULES)[number];

/**
 * What a gift list is for.
 *
 * "personal" is the product as it started: one person's wishlist, shared with
 * the people buying for them, with claims, surprise and an address.
 *
 * "guide" is a list for nobody in particular — gift ideas for PC gamers, for
 * someone who camps — written to be browsed and copied from. Nothing on it is
 * claimed, because a thousand people can all buy the same headlamp. It is
 * public in a way a personal list never is: once published it is listed on
 * /gifts, in the sitemap, and open to search engines.
 *
 * Chosen when the list is made and never changed. A personal list that has
 * had claims made on it must never turn into a public page, and the way to
 * publish one is to copy it into a new guide.
 */
export const LIST_KINDS = ["personal", "guide"] as const;
export type ListKind = (typeof LIST_KINDS)[number];

/**
 * The shelves on /gifts: "Outdoors", "Gaming". Curated by the operator from
 * /admin and nobody else, so the browse page reads like a shop rather than a
 * tag cloud. Listed alphabetically.
 */
export const categories = sqliteTable("categories", {
  id: id(),
  /** /gifts/<slug>. Kept when the name changes, so links to it still work. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("🎁"),
  createdAt: createdAt(),
});

export const lists = sqliteTable(
  "lists",
  {
    id: id(),
    // Null while the list is an anonymous draft, before the owner signs up.
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    // Identifies the draft's creator by cookie until they have an account.
    draftToken: text("draft_token"),
    /**
     * Unique per owner, not globally; two people may both have a "birthday"
     * list. Null owners (anonymous drafts) are exempt: SQLite treats NULLs as
     * distinct, and a draft is reachable by short code until it's claimed.
     */
    slug: text("slug").notNull(),
    /** The short share link: /<shortCode> redirects to the canonical URL. */
    shortCode: text("short_code").unique(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🎁"),
    eventDate: integer("event_date", { mode: "timestamp" }),
    note: text("note"),
    claimRule: text("claim_rule", { enum: CLAIM_RULES })
      .notNull()
      .default("anonymous"),
    // Fixed guarantee rather than a setting; the column exists so the server
    // has something explicit to check.
    surpriseMode: integer("surprise_mode", { mode: "boolean" })
      .notNull()
      .default(true),
    deliveryAddress: text("delivery_address"),
    /**
     * How to send money for a cash gift: a payment link, a handle, or bank
     * details. Held to the same rule as the address above; it reaches only
     * someone who has already chipped in.
     */
    paymentDetails: text("payment_details"),
    /**
     * Whether someone other than the owner may copy this list's gifts into a
     * list of their own. On by default: a well-chosen list is useful to more
     * people than the one it was made for. The owner can always copy their
     * own list, whatever this says.
     *
     * A copy takes the gifts and nothing about them — no claims, no money, no
     * address. See copyGifts, which is the only place one is made.
     */
    allowCopying: integer("allow_copying", { mode: "boolean" })
      .notNull()
      .default(true),
    /**
     * The list this one was copied from as a whole, kept so the original can
     * say "copied 12 times". A count is all it is ever used for: the owner of
     * the original never learns whose copy is whose.
     */
    copiedFromListId: text("copied_from_list_id").references(
      (): AnySQLiteColumn => lists.id,
      { onDelete: "set null" },
    ),
    /** See LIST_KINDS. Fixed at creation. */
    kind: text("kind", { enum: LIST_KINDS }).notNull().default("personal"),
    /** A guide's shelf on /gifts. Always null on a personal list. */
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    /**
     * When a guide's owner put it on /gifts. Null means it is reachable by its
     * link like any list, and nowhere else: not browsable, not in the sitemap,
     * and not indexed. Always null on a personal list.
     */
    publishedAt: integer("published_at", { mode: "timestamp" }),
    // Owner-visible aggregate. Never broken down per item or per guest.
    linkOpens: integer("link_opens").notNull().default(0),
    sharedAt: integer("shared_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("lists_owner_idx").on(t.ownerId),
    index("lists_draft_idx").on(t.draftToken),
    uniqueIndex("lists_owner_slug_idx").on(t.ownerId, t.slug),
    index("lists_copied_from_idx").on(t.copiedFromListId),
    index("lists_published_idx").on(t.kind, t.publishedAt),
  ],
);

/**
 * "cash" is an ask for money rather than an object: no link, no photo and no
 * quantity. It is stored as a group gift in every other respect, so the
 * funding code needs no second path through it.
 *
 * "idea" is a direction rather than a present: "knitting", "Xbox games". It
 * has no link, no price and no quantity, and — unlike either of the others —
 * it is never used up. Yarn and needles are both knitting, so several guests
 * can each take one on and it stays on the list for the next person. That is
 * the one rule to keep in mind wherever claims are counted: see claimItem,
 * which does not cap an idea, and isStillOpen, which never closes one.
 *
 * An idea can also hold presents of its own — needles and wool under
 * "knitting" — through items.parentId. Those children are ordinary gifts and
 * behave like any other; the idea above them stays a direction, and is still
 * claimable in its own right by someone who would rather choose for themselves.
 *
 * The enum is enforced in TypeScript only; the column is plain text, so adding
 * a kind needs no migration.
 */
export const ITEM_KINDS = ["thing", "cash", "idea"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const PRICE_SOURCES = ["scrape", "owner"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

export const items = sqliteTable(
  "items",
  {
    id: id(),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    /**
     * The idea this gift belongs to, or null when it stands on its own.
     *
     * One level only, and only an idea may be a parent: "knitting" holds
     * needles and wool, but needles hold nothing. That is enforced in the
     * actions rather than the column, because SQLite cannot express "my parent
     * has kind = idea" as a constraint; see addGift, which is the only place a
     * parent is ever set.
     *
     * A child is a present like any other — it has a link, a price and a
     * quantity, and one guest buying it uses it up. Only where it is *shown*
     * differs: inside its idea rather than in the grid.
     */
    parentId: text("parent_id").references((): AnySQLiteColumn => items.id, {
      onDelete: "cascade",
    }),
    // Explicit ordering, persisted so drag-to-reorder survives a reload.
    // Counted among siblings: top-level items share one run of positions and
    // each idea’s children share their own.
    position: integer("position").notNull().default(0),
    kind: text("kind", { enum: ITEM_KINDS }).notNull().default("thing"),
    title: text("title").notNull(),
    url: text("url"),
    sourceDomain: text("source_domain"),
    /** JSON array of candidate image URLs returned by the scraper. */
    images: text("images", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    selectedImageIndex: integer("selected_image_index").notNull().default(0),
    /**
     * Stands in for a photo wherever there isn't one. Gifts written in by hand
     * rarely have a picture, and an emoji reads better than "No photo".
     */
    emoji: text("emoji"),
    /**
     * Integer cents. Null when the scrape found no price, never guessed. When
     * the owner typed a range, the low end. Everything that sorts or filters
     * by price reads this; see src/lib/price.ts.
     */
    priceCents: integer("price_cents"),
    /**
     * The owner's own words for the price, shown as typed: "from $35",
     * "$20 to $30". Null when they typed a plain number, or the price came
     * from the shop, and the page says "about $X" instead.
     */
    priceLabel: text("price_label"),
    /**
     * Where the price came from. "scrape" is the shop's own figure, which the
     * monthly recheck keeps up to date; "owner" was typed by hand, and nothing
     * automatic ever overwrites it. Null when there is no price. See
     * src/lib/price-checks.ts.
     */
    priceSource: text("price_source", { enum: PRICE_SOURCES }),
    currency: text("currency").notNull().default("USD"),
    quantity: integer("quantity").notNull().default(1),
    /** The owner's "why you want it" copy; what makes the public list personal. */
    reason: text("reason"),
    isMostWanted: integer("is_most_wanted", { mode: "boolean" })
      .notNull()
      .default(false),
    isGroupGift: integer("is_group_gift", { mode: "boolean" })
      .notNull()
      .default(false),
    goalCents: integer("goal_cents"),
    /** Dead link or missing photo; drives the amber row in the editor. */
    needsAttention: text("needs_attention"),
    createdAt: createdAt(),
  },
  (t) => [
    index("items_list_idx").on(t.listId, t.position),
    index("items_parent_idx").on(t.parentId, t.position),
  ],
);

/**
 * One row per claimed unit. A quantity-2 item can hold two live claims.
 * Releasing sets releasedAt rather than deleting, so "1 of 2 still free"
 * can be counted consistently and a release is auditable.
 */
export const claims = sqliteTable(
  "claims",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    /** Signed cookie value identifying a guest with no account. */
    guestToken: text("guest_token").notNull(),
    /**
     * Set once a guest creates or signs into an account in that browser, so
     * their reservations survive a cleared cookie or a different device.
     * Never exposed to a list's owner.
     */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: text("first_name"),
    markedBought: integer("marked_bought", { mode: "boolean" })
      .notNull()
      .default(false),
    releasedAt: integer("released_at", { mode: "timestamp" }),
    claimedAt: createdAt(),
  },
  (t) => [
    index("claims_item_idx").on(t.itemId),
    index("claims_guest_idx").on(t.guestToken),
    index("claims_user_idx").on(t.userId),
    // A guest cannot hold the same item twice at once. Partial, so a released
    // claim doesn't block re-claiming later.
    uniqueIndex("claims_item_guest_live_idx")
      .on(t.itemId, t.guestToken)
      .where(sql`released_at is null`),
  ],
);

export const CONTRIBUTION_STATUSES = [
  "pending",
  "captured",
  "refunded",
] as const;

/** Group gifts. No money moves in the POC; the shape is here so the UI is real. */
export const contributions = sqliteTable(
  "contributions",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    guestToken: text("guest_token").notNull(),
    /**
     * Set once a contributor signs in, so a chip-in follows the person rather
     * than the browser. Never exposed to the list's owner.
     */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    status: text("status", { enum: CONTRIBUTION_STATUSES })
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("contributions_item_idx").on(t.itemId),
    index("contributions_user_idx").on(t.userId),
  ],
);

/**
 * What the last recheck of a product link found. See src/lib/price-checks.ts.
 *
 * "gone" is a 404 or 410: the shop says the page no longer exists.
 * "unreadable" is everything else that stopped us reading it — bot protection,
 * a timeout, a challenge page — and says nothing about whether the product is
 * still for sale. Big retailers block us every time, so treating that as a
 * dead link would flag half of every list.
 */
export const LINK_STATUSES = ["ok", "gone", "unreadable"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/**
 * One row per product link we have rechecked, keyed by the URL as items store
 * it.
 *
 * Keyed by link rather than by gift, because copying makes the same headlamp
 * appear on hundreds of lists, and it should be fetched once a month, not once
 * per list.
 */
export const productChecks = sqliteTable("product_checks", {
  url: text("url").primaryKey(),
  checkedAt: integer("checked_at", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: LINK_STATUSES }).notNull(),
  /** 404s and 410s in a row. Two is when a link is called dead. */
  goneStreak: integer("gone_streak").notNull().default(0),
  /** Checks in a row that couldn't read the page at all. */
  failStreak: integer("fail_streak").notNull().default(0),
  /** The scraper's own word for the last outcome, for the admin screen. */
  detail: text("detail"),
});

/**
 * Every price a product link has been seen at, oldest first.
 *
 * A row is written when a link is first priced and then only when the price
 * changes, so a link that has cost the same for a year is still one row. Read
 * against a gift's createdAt it answers "has this gone up or down since it was
 * added?" — see priceTrends.
 */
export const priceHistory = sqliteTable(
  "price_history",
  {
    id: id(),
    url: text("url").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull(),
    observedAt: integer("observed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("price_history_url_idx").on(t.url, t.observedAt)],
);

/**
 * Who put each file in data/uploads there, so the admin screen can say whose a
 * photo is even once nothing shows it any more.
 *
 * The directory is still the index of what exists — see listUploads — and this
 * only annotates it. Files uploaded before this table existed have no row, and
 * the admin screen falls back to the earliest gift showing them.
 */
export const uploads = sqliteTable("uploads", {
  /** The stored file name, as in /uploads/<name>. */
  name: text("name").primaryKey(),
  /**
   * The account that uploaded it. Null for an anonymous draft's owner, who has
   * no account yet; the list below says whose it became.
   */
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  /** The list it was uploaded to. Null for a profile photo. */
  listId: text("list_id").references(() => lists.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/* Secret Santa                                                               */
/* -------------------------------------------------------------------------- */

/**
 * "open" while people are joining; "drawn" once everyone has a name. Resetting
 * the draw puts an exchange back to "open" and deletes its assignments, so the
 * two states are all there is.
 */
export const SANTA_STATUSES = ["open", "drawn"] as const;
export type SantaStatus = (typeof SANTA_STATUSES)[number];

/**
 * A Secret Santa: a group who each draw one other member to buy for.
 *
 * Nothing is emailed or texted. The organiser shares /secret-santa/<code> in
 * whatever group chat the family already has, and each person who joins gets
 * a private link of their own; see santaParticipants.tokenHash.
 */
export const santaExchanges = sqliteTable(
  "santa_exchanges",
  {
    id: id(),
    /** Always an account: the dashboard has to survive a cleared cookie. */
    organizerId: text("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * /secret-santa/<code> is the invite link, and the pages hanging off it are
     * the dashboard and each participant's own. Knowing it lets you join while
     * the exchange is open and nothing else: who drew whom is behind a
     * participant's private link, and the dashboard behind the organiser's
     * account.
     */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🎅"),
    /** Integer cents in the site's currency, like every price. Null is "no limit set". */
    budgetCents: integer("budget_cents"),
    /** Local midnight, like a list's event date. */
    exchangeDate: integer("exchange_date", { mode: "timestamp" }),
    note: text("note"),
    status: text("status", { enum: SANTA_STATUSES }).notNull().default("open"),
    /** When the current draw was made. */
    drawnAt: integer("drawn_at", { mode: "timestamp" }),
    /**
     * How many times names have been drawn. A participant's seenDraw is
     * compared with this, not their viewedAt with drawnAt: timestamps here are
     * whole seconds, and a reveal and a redraw in the same second would read
     * as the new draw having been seen.
     */
    drawCount: integer("draw_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("santa_exchanges_organizer_idx").on(t.organizerId)],
);

/**
 * One person in an exchange. Most have no account; they are known by a private
 * link, /secret-santa/p/<token>, which this row stores only the hash of — the
 * same rule as a session, so a leaked database can't be used to open anybody's
 * draw. The link sets a cookie for this exchange, and from then on that browser
 * is them.
 */
export const santaParticipants = sqliteTable(
  "santa_participants",
  {
    id: id(),
    exchangeId: text("exchange_id")
      .notNull()
      .references(() => santaExchanges.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    /**
     * Set when they join while signed in, or ask for it from their page, so
     * their draw follows them to any browser they sign into. Never set behind
     * their back: a browser holding somebody else's link must not quietly
     * attach that person to whoever is signed in there.
     */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Their own Unwrap wishlist, for whoever draws them. */
    wishlistId: text("wishlist_id").references(() => lists.id, {
      onDelete: "set null",
    }),
    /**
     * When they last pressed "show me who I've got". Earlier than the
     * exchange's drawnAt means the names were drawn again since they looked.
     * The organiser sees whether someone has looked, never what they saw.
     */
    viewedAt: integer("viewed_at", { mode: "timestamp" }),
    /** The exchange's drawCount when they last looked. Behind it means a redraw since. */
    seenDraw: integer("seen_draw"),
    /**
     * When the organiser last replaced their private link. Whoever replaces a
     * link can open it, so every reset is shown to the whole exchange; it is
     * the only defence a link-only design has against an organiser peeking.
     */
    linkResetAt: integer("link_reset_at", { mode: "timestamp" }),
    joinedAt: createdAt(),
  },
  (t) => [
    index("santa_participants_exchange_idx").on(t.exchangeId),
    // SQLite treats NULLs as distinct, so this only binds people with accounts.
    uniqueIndex("santa_participants_exchange_user_idx").on(t.exchangeId, t.userId),
  ],
);

/**
 * Two people who must not draw each other, usually a couple. Symmetric, and
 * stored once with the ids in sorted order so the same pair can't be added
 * twice the other way round.
 */
export const santaExclusions = sqliteTable(
  "santa_exclusions",
  {
    id: id(),
    exchangeId: text("exchange_id")
      .notNull()
      .references(() => santaExchanges.id, { onDelete: "cascade" }),
    firstId: text("first_id")
      .notNull()
      .references(() => santaParticipants.id, { onDelete: "cascade" }),
    secondId: text("second_id")
      .notNull()
      .references(() => santaParticipants.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("santa_exclusions_pair_idx").on(t.exchangeId, t.firstId, t.secondId)],
);

/**
 * Who buys for whom. A table of its own, rather than a column on the
 * participant, so that nothing which reads participants for the organiser's
 * dashboard can carry an assignment along by accident. The one place this is
 * read is assignmentFor in src/lib/secret-santa.ts.
 */
export const santaAssignments = sqliteTable(
  "santa_assignments",
  {
    id: id(),
    exchangeId: text("exchange_id")
      .notNull()
      .references(() => santaExchanges.id, { onDelete: "cascade" }),
    giverId: text("giver_id")
      .notNull()
      .unique()
      .references(() => santaParticipants.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => santaParticipants.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("santa_assignments_receiver_idx").on(t.exchangeId, t.receiverId)],
);

/**
 * The anonymous thread between a Santa and the person they drew. Hung off the
 * assignment, so resetting the draw takes every thread with it: a new draw is
 * a new pair, and the old conversation would be addressed to the wrong person.
 *
 * `senderId` is kept for rate limits and for the admin screen when a message
 * is reported. It must never reach the receiver: their side of the thread is
 * read by santaThread in src/lib/secret-santa.ts, which selects the body and
 * `fromGiver` and nothing else.
 */
export const santaMessages = sqliteTable(
  "santa_messages",
  {
    id: id(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => santaAssignments.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => santaParticipants.id, { onDelete: "cascade" }),
    /** True when the Santa wrote it; false when the person they drew did. */
    fromGiver: integer("from_giver", { mode: "boolean" }).notNull(),
    body: text("body").notNull(),
    /** Set from /admin. A removed message stays a row so its report still makes sense. */
    removedAt: integer("removed_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("santa_messages_assignment_idx").on(t.assignmentId, t.createdAt),
    index("santa_messages_sender_idx").on(t.senderId, t.createdAt),
  ],
);

/** A message someone in its thread flagged. Read on /admin, and nowhere else. */
export const santaReports = sqliteTable(
  "santa_reports",
  {
    id: id(),
    messageId: text("message_id")
      .notNull()
      .references(() => santaMessages.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => santaParticipants.id, { onDelete: "cascade" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("santa_reports_message_reporter_idx").on(t.messageId, t.reporterId)],
);

/**
 * Product analytics, as counts. A row is an event name and a time, and
 * nothing else: no account, no exchange, no address, no cookie. That is the
 * whole privacy story, so keep it true — anything added here has to be
 * something that can't identify a person or a group. See src/lib/analytics.ts.
 *
 * Text rather than an enum in the column, like items.kind, so a new event needs
 * no migration.
 */
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: id(),
    event: text("event").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_events_event_idx").on(t.event, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Event tracking                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Every kind of row item_events can hold. Text in the column, like items.kind,
 * so adding one needs no migration. Which of them a browser may send, and with
 * what, is decided in src/lib/event-validation.ts; outbound_click and
 * item_claim are only ever written by the server.
 */
export const ITEM_EVENT_TYPES = [
  "list_view",
  "idea_expand",
  "item_impression",
  "outbound_click",
  "filter_used",
  "sort_used",
  "suggestion_impression",
  "suggestion_click",
  "item_claim",
] as const;
export type ItemEventType = (typeof ITEM_EVENT_TYPES)[number];

/**
 * What happens on lists, for the operator: views, impressions, clicks out to
 * shops. See src/lib/tracking.ts, which is the only thing that writes here.
 *
 * Nothing in a row says who anybody is. The visitor and session ids are random
 * values from first-party cookies (13 months and 30 idle minutes at most) and
 * are joined to nothing; there is no account, email, IP address or user agent,
 * only whether the user agent looked like a bot. Keep it that way: anything
 * added here must not be able to identify a person.
 *
 * Deleting a list or a gift deletes its events with it. Rows older than 13
 * months are deleted daily; see src/lib/event-retention.ts.
 */
export const itemEvents = sqliteTable(
  "item_events",
  {
    // An integer rather than a UUID: the live feed reads the newest rows, and
    // rowid order is insertion order for free.
    id: integer("id").primaryKey({ autoIncrement: true }),
    occurredAt: integer("occurred_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    eventType: text("event_type", { enum: ITEM_EVENT_TYPES }).notNull(),
    visitorId: text("visitor_id"),
    sessionId: text("session_id"),
    listId: text("list_id").references(() => lists.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    /** The idea the event is about: the idea itself, or the one a gift sits under. */
    ideaId: text("idea_id").references(() => items.id, { onDelete: "cascade" }),
    properties: text("properties", { mode: "json" })
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default(sql`'{}'`),
    isBot: integer("is_bot", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("item_events_type_idx").on(t.eventType, t.occurredAt),
    index("item_events_item_idx").on(t.itemId, t.occurredAt),
    index("item_events_list_idx").on(t.listId, t.occurredAt),
  ],
);

/**
 * Events that were sent and not stored, counted per day and reason: refused
 * (malformed, too large, rate limited) or deliberately skipped (Do Not Track,
 * the list's owner, tracking paused). Counts only, for the admin screen, so
 * "is it working" can be answered without storing what was turned away.
 */
export const itemEventDrops = sqliteTable(
  "item_event_drops",
  {
    /** YYYY-MM-DD, UTC. */
    day: text("day").notNull(),
    reason: text("reason").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.reason] })],
);

/**
 * Switches the operator flips from /admin without a deploy. One row per key;
 * a missing row means the default. Today only `tracking_paused`.
 */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type SantaExchange = typeof santaExchanges.$inferSelect;
export type SantaParticipant = typeof santaParticipants.$inferSelect;
