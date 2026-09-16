import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { claims, contributions, items, type List } from "@/db/schema";
import { resolveList, viewerOwns } from "@/lib/list-access";
import { readGuestToken } from "@/lib/session";
import { outboundHref } from "@/lib/outbound";

export type PublicItem = {
  id: string;
  title: string;
  href: string | null;
  sourceDomain: string | null;
  image: string | null;
  priceCents: number | null;
  quantity: number;
  reason: string | null;
  isMostWanted: boolean;
  isGroupGift: boolean;
  goalCents: number | null;
  raisedCents: number;
  /** Live claims. Always 0 for the owner — see the note on getPublicList. */
  claimedCount: number;
  claimedByViewer: boolean;
  unitsFree: number;
};

export type PublicListView = {
  list: List;
  items: PublicItem[];
  /** Null while the list is an unclaimed draft. */
  ownerHandle: string | null;
  /** True when the owner is looking at their own public list. */
  viewerIsOwner: boolean;
  stats: { total: number; free: number; minCents: number | null; maxCents: number | null };
};

/**
 * The public list as a specific viewer may see it.
 *
 * THE RULE: the owner never learns which gifts are claimed. That is enforced
 * here, in the data layer, not in the template — an owner's session is given
 * zeroed claim counts, so no component can leak what it was never handed.
 * Treat any change to this function as a data-security change.
 */
export async function getPublicList(
  handle: string,
  key: string,
): Promise<PublicListView | null> {
  const resolved = await resolveList(handle, key);
  if (!resolved) return null;

  const { list, ownerHandle } = resolved;
  const viewerIsOwner = await viewerOwns(resolved);

  const rows = await db
    .select()
    .from(items)
    .where(eq(items.listId, list.id))
    .orderBy(asc(items.position))
    .all();

  // Only read the viewer's own guest identity; never anyone else's.
  const guestToken = viewerIsOwner ? null : await readGuestToken();

  const liveClaims = viewerIsOwner
    ? []
    : await db
        .select({ itemId: claims.itemId, guestToken: claims.guestToken })
        .from(claims)
        .where(isNull(claims.releasedAt))
        .all();

  const raised = await db
    .select({
      itemId: contributions.itemId,
      total: sql<number>`coalesce(sum(${contributions.amountCents}), 0)`,
    })
    .from(contributions)
    .groupBy(contributions.itemId)
    .all();

  const publicItems: PublicItem[] = rows.map((item) => {
    const itemClaims = liveClaims.filter((claim) => claim.itemId === item.id);
    const claimedCount = itemClaims.length;

    return {
      id: item.id,
      title: item.title,
      href: outboundHref(item.url),
      sourceDomain: item.sourceDomain,
      image: item.images[item.selectedImageIndex] ?? item.images[0] ?? null,
      priceCents: item.priceCents,
      quantity: item.quantity,
      reason: item.reason,
      isMostWanted: item.isMostWanted,
      isGroupGift: item.isGroupGift,
      goalCents: item.goalCents,
      raisedCents: raised.find((r) => r.itemId === item.id)?.total ?? 0,
      // Owners are handed a list where nothing is claimed.
      claimedCount: viewerIsOwner ? 0 : claimedCount,
      claimedByViewer:
        guestToken !== null && itemClaims.some((c) => c.guestToken === guestToken),
      unitsFree: viewerIsOwner ? item.quantity : Math.max(item.quantity - claimedCount, 0),
    };
  });

  const prices = rows.map((item) => item.priceCents).filter((p): p is number => p !== null);

  return {
    list,
    items: publicItems,
    ownerHandle,
    viewerIsOwner,
    stats: {
      total: publicItems.length,
      free: publicItems.filter((item) => item.unitsFree > 0).length,
      minCents: prices.length ? Math.min(...prices) : null,
      maxCents: prices.length ? Math.max(...prices) : null,
    },
  };
}

export type ClaimOutcome = "claimed" | "gone" | "already-yours" | "missing";

/**
 * Claims one unit of an item.
 *
 * Two guests tapping the same last gift at the same moment must not both win,
 * so the insert carries its own condition: the row is written only if the live
 * claim count is still below the quantity. SQLite applies that as a single
 * statement, so there is no window between the check and the write.
 */
export async function claimItem(
  itemId: string,
  guestToken: string,
  firstName: string | null,
): Promise<ClaimOutcome> {
  const item = await db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item) return "missing";

  try {
    const result = db.run(sql`
      insert into ${claims} (id, item_id, guest_token, first_name, marked_bought, created_at)
      select ${crypto.randomUUID()}, ${itemId}, ${guestToken}, ${firstName}, 0, unixepoch()
      where (
        select count(*) from ${claims}
        where item_id = ${itemId} and released_at is null
      ) < ${item.quantity}
    `);

    return result.changes > 0 ? "claimed" : "gone";
  } catch (error) {
    // The partial unique index stops one guest holding the same item twice.
    if (String(error).includes("UNIQUE")) return "already-yours";
    throw error;
  }
}

/** Releasing returns the unit to the pool; the row is kept for the guest's history. */
export async function releaseItem(itemId: string, guestToken: string): Promise<void> {
  await db
    .update(claims)
    .set({ releasedAt: new Date() })
    .where(
      and(
        eq(claims.itemId, itemId),
        eq(claims.guestToken, guestToken),
        isNull(claims.releasedAt),
      ),
    );
}
