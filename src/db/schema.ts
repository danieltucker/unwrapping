import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
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
    // Owner-visible aggregate. Never broken down per item or per guest.
    linkOpens: integer("link_opens").notNull().default(0),
    sharedAt: integer("shared_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("lists_owner_idx").on(t.ownerId),
    index("lists_draft_idx").on(t.draftToken),
    uniqueIndex("lists_owner_slug_idx").on(t.ownerId, t.slug),
  ],
);

/**
 * "cash" is an ask for money rather than an object: no link, no photo and no
 * quantity. It is stored as a group gift in every other respect, so the
 * funding code needs no second path through it.
 */
export const ITEM_KINDS = ["thing", "cash"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const items = sqliteTable(
  "items",
  {
    id: id(),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    // Explicit ordering, persisted so drag-to-reorder survives a reload.
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
  (t) => [index("items_list_idx").on(t.listId, t.position)],
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
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
