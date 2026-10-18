import { sql } from "drizzle-orm";
import {
  index,
  integer,
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
    /** Integer cents. Null when the scrape found no price, never guessed. */
    priceCents: integer("price_cents"),
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

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
