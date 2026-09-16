import "server-only";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { claims, items, lists, users } from "@/db/schema";
import { outboundHref } from "@/lib/outbound";
import { listSegments, publicList } from "@/lib/routes";
import { viewerScope } from "@/lib/viewer";

export type Reservation = {
  claimId: string;
  itemId: string;
  title: string;
  priceCents: number | null;
  image: string | null;
  href: string | null;
  sourceDomain: string | null;
  claimedAt: Date;
  markedBought: boolean;
  listName: string;
  listEmoji: string;
  eventDate: Date | null;
  listPath: string;
  /** False when the owners of that list can see what has been taken. */
  listIsSurprise: boolean;
  /** Identifies the list to the release action. */
  handle: string;
  listKey: string;
};

export type InvitedList = {
  name: string;
  emoji: string;
  path: string;
  freeCount: number;
};

/** Which claims belong to whoever is asking — see viewerScope. */
async function mine(): Promise<SQL | null> {
  return viewerScope(claims.guestToken, claims.userId);
}

/** Live reservation count, for the header. Cheap on purpose: it runs on every page. */
export async function countGuestReservations(): Promise<number> {
  const scope = await mine();
  if (!scope) return 0;

  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(claims)
    .where(and(scope, isNull(claims.releasedAt)))
    .get();

  return row?.count ?? 0;
}

/** Everything this person has reserved, with the lists they came from. */
export async function getGuestReservations(): Promise<{
  reservations: Reservation[];
  invitedLists: InvitedList[];
}> {
  const scope = await mine();
  if (!scope) return { reservations: [], invitedLists: [] };

  const rows = await db
    .select({ claim: claims, item: items, list: lists, handle: users.handle })
    .from(claims)
    .innerJoin(items, eq(items.id, claims.itemId))
    .innerJoin(lists, eq(lists.id, items.listId))
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(and(scope, isNull(claims.releasedAt)))
    .all();

  const reservations: Reservation[] = rows.map(({ claim, item, list, handle }) => {
    const [segmentHandle, segmentKey] = listSegments(list, handle);

    return {
      claimId: claim.id,
      itemId: item.id,
      title: item.title,
      priceCents: item.priceCents,
      image: item.images[item.selectedImageIndex] ?? item.images[0] ?? null,
      href: outboundHref(item.url),
      sourceDomain: item.sourceDomain,
      claimedAt: claim.claimedAt,
      markedBought: claim.markedBought,
      listName: list.name,
      listEmoji: list.emoji,
      eventDate: list.eventDate,
      listPath: publicList(list, handle),
      listIsSurprise: list.surpriseMode,
      handle: segmentHandle,
      listKey: segmentKey,
    };
  });

  // The lists this person has touched, with how much is still unclaimed.
  const seen = new Map<string, { name: string; emoji: string; path: string }>();
  for (const { list, handle } of rows) {
    if (!seen.has(list.id)) {
      seen.set(list.id, {
        name: list.name,
        emoji: list.emoji,
        path: publicList(list, handle),
      });
    }
  }

  const invitedLists: InvitedList[] = [];
  for (const [listId, meta] of seen) {
    const counts = await db
      .select({
        units: sql<number>`coalesce(sum(${items.quantity}), 0)`,
        taken: sql<number>`(
          select count(*) from ${claims}
          join ${items} as i on i.id = ${claims.itemId}
          where i.list_id = ${listId} and ${claims.releasedAt} is null
        )`,
      })
      .from(items)
      .where(eq(items.listId, listId))
      .get();

    invitedLists.push({
      ...meta,
      freeCount: Math.max((counts?.units ?? 0) - (counts?.taken ?? 0), 0),
    });
  }

  return { reservations, invitedLists };
}

/** Flips the "I've bought this" flag, proving the claim belongs to the caller. */
export async function setMarkedBought(
  claimId: string,
  bought: boolean,
): Promise<boolean> {
  const scope = await mine();
  if (!scope) return false;

  const result = await db
    .update(claims)
    .set({ markedBought: bought })
    .where(and(eq(claims.id, claimId), scope));

  return result.changes > 0;
}

/**
 * Ties this browser's reservations to an account, at sign-up or sign-in.
 * Only unclaimed rows are stamped, so one person can never take over another's.
 */
export async function linkGuestClaimsToUser(
  guestToken: string,
  userId: string,
): Promise<number> {
  const result = await db
    .update(claims)
    .set({ userId })
    .where(and(eq(claims.guestToken, guestToken), isNull(claims.userId)));

  return result.changes;
}

/**
 * Ticks a gift off as bought from the list page itself, rather than from the
 * reservations page. Addressed by item, because that is what a gift card knows
 * — the caller's own live claim on it is what gets updated, and nobody else's.
 */
export async function setItemBought(
  itemId: string,
  bought: boolean,
): Promise<boolean> {
  const scope = await mine();
  if (!scope) return false;

  const result = await db
    .update(claims)
    .set({ markedBought: bought })
    .where(and(eq(claims.itemId, itemId), isNull(claims.releasedAt), scope));

  return result.changes > 0;
}
