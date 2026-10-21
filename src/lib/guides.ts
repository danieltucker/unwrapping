import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";

import { site } from "@/config/site";
import { db } from "@/db";
import { categories, items, lists, users, type Category } from "@/db/schema";
import { isPriceFilterActive, matchesPriceFilter, type PriceFilter } from "@/lib/price";
import { publicList } from "@/lib/routes";

/**
 * Reading gift guides for the pages that browse them: /gifts, a category's
 * shelf, the homepage and the sitemap.
 *
 * Only *published* guides are ever returned. An unpublished one is reachable
 * by its link, like any list, and from nowhere else — that is the whole of
 * what publishing means. See lists.publishedAt.
 *
 * Every query here starts with connection(). better-sqlite3 is synchronous, so
 * without it a page that reads guides and nothing else — /gifts, the homepage —
 * is prerendered at build time against the build's empty database, and either
 * fails the build or bakes in a page with no guides on it forever.
 */

/** One guide as a tile draws it. Nothing here is private to its owner. */
export type GuideSummary = {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  href: string;
  ownerName: string;
  ownerHandle: string;
  giftCount: number;
  copyCount: number;
  /** Up to three photos from the top of the list, for the tile's mosaic. */
  previews: { image: string | null; emoji: string | null }[];
  category: { slug: string; name: string } | null;
  publishedAt: Date;
  /**
   * How many of its presents are in the price range a shelf was filtered by,
   * so a tile can say "3 in your range". Null when nothing was filtered.
   */
  priceMatches: number | null;
};

export type CategoryWithCount = Category & { guideCount: number };

/** Every category, alphabetically, with how many published guides it holds. */
export async function allCategories(): Promise<CategoryWithCount[]> {
  await connection();
  // Written out rather than interpolated: see the note in src/app/lists/page.tsx
  // on how Drizzle renders a correlated subquery against a single table.
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      emoji: categories.emoji,
      createdAt: categories.createdAt,
      guideCount: sql<number>`(select count(*) from ${lists} where ${lists.categoryId} = "categories"."id" and ${lists.kind} = 'guide' and ${lists.publishedAt} is not null and not exists (select 1 from "users" where "users"."id" = "lists"."owner_id" and "users"."banned_at" is not null))`,
    })
    .from(categories)
    .orderBy(asc(categories.name))
    .all();
}

export async function categoryBySlug(slug: string): Promise<Category | null> {
  await connection();
  return (
    (await db.select().from(categories).where(eq(categories.slug, slug)).get()) ?? null
  );
}

/**
 * Published guides, most useful first.
 *
 * "Popular" is how many people copied the whole list, which is the one signal
 * that someone found it worth keeping; ties, and a new instance where nothing
 * has been copied yet, fall back to the newest. Guides with nothing on them are
 * left out: an empty tile on a browse page is a dead end.
 */
export async function publishedGuides({
  categoryId,
  order = "popular",
  limit = 24,
  price,
}: {
  /** Undefined for every category; a string for one shelf. */
  categoryId?: string;
  order?: "popular" | "newest";
  limit?: number;
  /**
   * Only guides with at least one present in this range, as a shelf's price
   * filter asks. Checked in the query rather than after it, so `limit`
   * counts guides that match and a shelf never comes up short.
   */
  price?: PriceFilter;
} = {}): Promise<GuideSummary[]> {
  await connection();
  const giftCount = sql<number>`(select count(*) from ${items} where ${items.listId} = "lists"."id")`;
  const copyCount = sql<number>`(select count(*) from ${lists} as copies where copies.copied_from_list_id = "lists"."id")`;
  const range = price && isPriceFilterActive(price) ? price : null;

  const rows = await db
    .select({
      list: lists,
      ownerName: users.name,
      ownerHandle: users.handle,
      categorySlug: categories.slug,
      categoryName: categories.name,
      giftCount,
      copyCount,
    })
    .from(lists)
    .innerJoin(users, eq(users.id, lists.ownerId))
    .leftJoin(categories, eq(categories.id, lists.categoryId))
    .where(
      and(
        eq(lists.kind, "guide"),
        isNotNull(lists.publishedAt),
        isNull(users.bannedAt),
        categoryId ? eq(lists.categoryId, categoryId) : undefined,
        sql`${giftCount} > 0`,
        range ? priceMatchExists(range) : undefined,
      ),
    )
    .orderBy(
      ...(order === "popular" ? [desc(copyCount)] : []),
      desc(lists.publishedAt),
    )
    .limit(limit)
    .all();

  if (rows.length === 0) return [];

  // The mosaic's pictures, read in one query for every tile on the page rather
  // than one per guide.
  const pictures = await db
    .select({
      listId: items.listId,
      kind: items.kind,
      images: items.images,
      selectedImageIndex: items.selectedImageIndex,
      emoji: items.emoji,
      priceCents: items.priceCents,
      currency: items.currency,
    })
    .from(items)
    .where(inArray(items.listId, rows.map((row) => row.list.id)))
    .orderBy(asc(items.parentId), asc(items.position))
    .all();

  return rows.map((row) => ({
    id: row.list.id,
    name: row.list.name,
    emoji: row.list.emoji,
    description: row.list.note,
    href: publicList(row.list, row.ownerHandle),
    ownerName: row.ownerName,
    ownerHandle: row.ownerHandle,
    giftCount: row.giftCount,
    copyCount: row.copyCount,
    previews: pictures
      .filter((picture) => picture.listId === row.list.id)
      .map((picture) => ({
        image: picture.images[picture.selectedImageIndex] ?? picture.images[0] ?? null,
        emoji: picture.emoji,
      }))
      // Something to look at beats a blank square, so photos and emoji go
      // first and only the first three are kept.
      .filter((preview) => preview.image || preview.emoji)
      .slice(0, 3),
    category:
      row.categorySlug && row.categoryName
        ? { slug: row.categorySlug, name: row.categoryName }
        : null,
    publishedAt: row.list.publishedAt!,
    priceMatches: range
      ? pictures.filter(
          (item) =>
            item.listId === row.list.id &&
            item.kind !== "idea" &&
            matchesPriceFilter(item, range),
        ).length
      : null,
  }));
}

/**
 * "This guide has a present in the range", in SQL: the same rule as
 * matchesPriceFilter, which counts them for the tile afterwards. Ideas have no
 * price and never count; a price in another currency counts as no price.
 *
 * `"lists"."id"` is written out for the reason given in allCategories.
 */
function priceMatchExists(price: PriceFilter) {
  const inRange = and(
    sql`${items.priceCents} is not null`,
    sql`upper(${items.currency}) = ${site.currency}`,
    price.minCents !== null ? sql`${items.priceCents} >= ${price.minCents}` : undefined,
    price.maxCents !== null ? sql`${items.priceCents} < ${price.maxCents}` : undefined,
  );
  const unpriced = sql`(${items.priceCents} is null or upper(${items.currency}) <> ${site.currency})`;

  return sql`exists (select 1 from ${items} where ${items.listId} = "lists"."id" and ${items.kind} <> 'idea' and (${inRange}${price.includeUnpriced ? sql` or ${unpriced}` : sql``}))`;
}

/** What a guide's own page shows beyond its gifts: whose it is, its shelf, how often it was copied. */
export async function guideDetails(list: {
  id: string;
  ownerId: string | null;
  categoryId: string | null;
}) {
  const [owner, category, copies] = await Promise.all([
    list.ownerId
      ? db
          .select({ name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, list.ownerId))
          .get()
      : undefined,
    list.categoryId
      ? db
          .select({ slug: categories.slug, name: categories.name, emoji: categories.emoji })
          .from(categories)
          .where(eq(categories.id, list.categoryId))
          .get()
      : undefined,
    db
      .select({ count: sql<number>`count(*)` })
      .from(lists)
      .where(eq(lists.copiedFromListId, list.id))
      .get(),
  ]);

  return {
    owner: owner ?? null,
    category: category ?? null,
    copyCount: copies?.count ?? 0,
  };
}
