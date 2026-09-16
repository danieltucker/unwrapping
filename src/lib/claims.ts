import "server-only";

import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { claims, contributions, items, type List } from "@/db/schema";
import { fundingForList, raisedForList } from "@/lib/contributions";
import { isStillOpen } from "@/lib/funding";
import { resolveList, viewerOwns } from "@/lib/list-access";
import { readGuestToken } from "@/lib/session";
import { viewerScope } from "@/lib/viewer";
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
  /** How many people have chipped in. A count, never a list of names. */
  contributorCount: number;
  /** What the viewer themselves has put in, so the card can say so. */
  yourContributionCents: number;
  /** Live claims. Always 0 for the owner of a surprise list — see getPublicList. */
  claimedCount: number;
  /** How many of those claims have been marked bought. Same blindfold applies. */
  boughtCount: number;
  claimedByViewer: boolean;
  /** Whether the viewer has ticked their own claim off as bought. */
  boughtByViewer: boolean;
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
 * THE RULE: on a surprise list the owner never learns which gifts are claimed.
 * That is enforced here, in the data layer, not in the template — such an
 * owner's session is given zeroed claim counts, so no component can leak what
 * it was never handed. Treat any change to this function as a data change, not
 * a UI one.
 *
 * Surprise is per list (lists.surpriseMode): a birthday keeps the blindfold, a
 * wedding registry usually wants the couple to see what's been taken so they
 * can add more. Guests are told which kind of list they're on, because the
 * promise made at the moment of reserving has to be the true one.
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

  // The blindfold: an owner of a surprise list is handed no claim rows at all.
  const hideClaims = viewerIsOwner && list.surpriseMode;

  const liveClaims = hideClaims
    ? []
    : await db
        .select({
          itemId: claims.itemId,
          guestToken: claims.guestToken,
          markedBought: claims.markedBought,
        })
        .from(claims)
        .innerJoin(items, eq(items.id, claims.itemId))
        .where(and(eq(items.listId, list.id), isNull(claims.releasedAt)))
        .all();

  // Money is aggregated per item for everyone, owner included: a total raised
  // is theirs to see, who paid it is not.
  const funding = await fundingForList(list.id);

  // The viewer's own chip-ins, so a card can show what they already gave.
  const mineScope = viewerIsOwner
    ? null
    : await viewerScope(contributions.guestToken, contributions.userId);

  const yours = mineScope
    ? await db
        .select({
          itemId: contributions.itemId,
          total: sql<number>`coalesce(sum(${contributions.amountCents}), 0)`,
        })
        .from(contributions)
        .innerJoin(items, eq(items.id, contributions.itemId))
        .where(
          and(
            eq(items.listId, list.id),
            ne(contributions.status, "refunded"),
            mineScope,
          ),
        )
        .groupBy(contributions.itemId)
        .all()
    : [];

  const publicItems: PublicItem[] = rows.map((item) => {
    const itemClaims = liveClaims.filter((claim) => claim.itemId === item.id);
    const claimedCount = itemClaims.length;
    const viewerClaim =
      guestToken === null
        ? undefined
        : itemClaims.find((claim) => claim.guestToken === guestToken);

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
      raisedCents: funding.find((f) => f.itemId === item.id)?.raisedCents ?? 0,
      contributorCount:
        funding.find((f) => f.itemId === item.id)?.contributorCount ?? 0,
      yourContributionCents: yours.find((r) => r.itemId === item.id)?.total ?? 0,
      // A surprise list's owner is handed a list where nothing is claimed.
      claimedCount,
      boughtCount: itemClaims.filter((claim) => claim.markedBought).length,
      claimedByViewer: viewerClaim !== undefined,
      boughtByViewer: viewerClaim?.markedBought ?? false,
      unitsFree: Math.max(item.quantity - claimedCount, 0),
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
      free: publicItems.filter(isStillOpen).length,
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

export type OwnerStats = {
  /** Opens of the short link, counted in /[code]. Guests only. */
  linkOpens: number;
  /** How many gifts are spoken for. Which ones is a separate question. */
  claimedCount: number;
  /** How many of those a guest has ticked off as bought. */
  boughtCount: number;
  /** Total chipped in across the list's group gifts. */
  raisedCents: number;
};

/**
 * The numbers an owner gets about their own list, whichever mode it's in.
 *
 * Counts and totals only: nothing returned here can be traced to a person, so
 * even a surprise list can show activity without giving the game away.
 */
export async function getOwnerStats(list: List): Promise<OwnerStats> {
  const claimed = await db
    .select({
      count: sql<number>`count(*)`,
      bought: sql<number>`sum(case when ${claims.markedBought} then 1 else 0 end)`,
    })
    .from(claims)
    .innerJoin(items, eq(items.id, claims.itemId))
    .where(and(eq(items.listId, list.id), isNull(claims.releasedAt)))
    .get();

  return {
    linkOpens: list.linkOpens,
    claimedCount: claimed?.count ?? 0,
    boughtCount: claimed?.bought ?? 0,
    raisedCents: await raisedForList(list.id),
  };
}

export type ItemStatus = { claimedCount: number; boughtCount: number };

/**
 * Per-item claim status for the owner's editor — or null, which means "this
 * owner may not know".
 *
 * Returning null rather than an empty map is the point: a caller can't mistake
 * a surprise list for a list where nothing has been claimed yet.
 */
export async function getOwnerItemStatus(
  list: List,
): Promise<Map<string, ItemStatus> | null> {
  if (list.surpriseMode) return null;

  const rows = await db
    .select({
      itemId: claims.itemId,
      claimedCount: sql<number>`count(*)`,
      boughtCount: sql<number>`sum(case when ${claims.markedBought} then 1 else 0 end)`,
    })
    .from(claims)
    .innerJoin(items, eq(items.id, claims.itemId))
    .where(and(eq(items.listId, list.id), isNull(claims.releasedAt)))
    .groupBy(claims.itemId)
    .all();

  return new Map(
    rows.map((row) => [
      row.itemId,
      { claimedCount: row.claimedCount, boughtCount: row.boughtCount },
    ]),
  );
}
