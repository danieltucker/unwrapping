import "server-only";

import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { claims, items, lists, users } from "@/db/schema";
import { outboundHref } from "@/lib/outbound";
import { listSegments, publicList } from "@/lib/routes";
import { getCurrentUser, readGuestToken } from "@/lib/session";

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

/**
 * Which claims belong to whoever is asking.
 *
 * A guest is known by a cookie. Once they create an account, their claims are
 * stamped with a userId as well, so the reservations follow the person rather
 * than the browser — which is the promise the sign-up prompt makes.
 */
async function mine(): Promise<SQL | null> {
  const [guestToken, user] = await Promise.all([readGuestToken(), getCurrentUser()]);

  const conditions: SQL[] = [];
  if (guestToken) conditions.push(eq(claims.guestToken, guestToken));
  if (user) conditions.push(eq(claims.userId, user.id));

  if (conditions.length === 0) return null;
  return conditions.length === 1 ? conditions[0] : or(...conditions)!;
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
