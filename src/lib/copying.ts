import "server-only";

import { and, desc, eq, isNull, max, ne } from "drizzle-orm";

import { db } from "@/db";
import { items, lists, users, type Item } from "@/db/schema";
import { viewerOwns, type ResolvedList } from "@/lib/list-access";
import { getCurrentUser, readDraftToken } from "@/lib/session";

/**
 * Copying gifts from one list into another.
 *
 * THE RULE: a copy takes the gifts and nothing that happened to them. Claims,
 * "bought" ticks and chip-ins belong to the original list's guests, and the
 * whole point of a surprise list is that they never travel. Nothing here reads
 * the claims or contributions tables, which is the simplest way to be sure.
 *
 * What else stays behind depends on who is copying, and from what. The owner
 * duplicating their own list keeps their own words — why they want each thing,
 * which one they want most. Anyone else copying a wishlist gets the gifts
 * without them: "I've wanted these since college" is one person's reason, not
 * a product description. A gift guide is the opposite case: its reasons *are*
 * product descriptions, written for strangers, so they always come across.
 *
 * Cash asks never come across. A honeymoon fund is about the couple, and on
 * someone else's list it would be asking for money on their behalf.
 */

/** A list the viewer could put copied gifts on. Only what the picker draws. */
export type CopyDestination = { id: string; name: string; emoji: string };

/**
 * The viewer's own lists, newest first, or this browser's drafts if they have
 * no account. `exclude` is the list being copied from, which is never a
 * sensible place to copy it to.
 */
export async function copyDestinations(exclude: string): Promise<CopyDestination[]> {
  const user = await getCurrentUser();
  const draftToken = user ? null : await readDraftToken();
  if (!user && !draftToken) return [];

  return db
    .select({ id: lists.id, name: lists.name, emoji: lists.emoji })
    .from(lists)
    .where(
      and(
        user
          ? eq(lists.ownerId, user.id)
          : and(isNull(lists.ownerId), eq(lists.draftToken, draftToken!)),
        ne(lists.id, exclude),
      ),
    )
    .orderBy(desc(lists.createdAt))
    .all();
}

/**
 * A destination the viewer actually owns, looked up by id.
 *
 * The id arrives in a form body, so it proves nothing on its own; this is the
 * same ownership check the editor makes, reached from the other direction.
 */
export async function ownedDestination(listId: string): Promise<ResolvedList | null> {
  const row = await db
    .select({ list: lists, handle: users.handle })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(eq(lists.id, listId))
    .get();
  if (!row) return null;

  const resolved = { list: row.list, ownerHandle: row.handle };
  return (await viewerOwns(resolved)) ? resolved : null;
}

/**
 * Which of a list's rows a copy takes: the whole list when `itemId` is null,
 * otherwise that one gift — and, for an idea, the presents hung under it,
 * because "knitting" without its needles and wool is half of what was chosen.
 *
 * `rows` must be the source list's items in position order. Null means the
 * item isn't on this list; an empty array means nothing on it can be copied.
 */
export function pickRows(rows: Item[], itemId: string | null): Item[] | null {
  const copyable = rows.filter((row) => row.kind !== "cash");
  if (itemId === null) return copyable;

  const item = rows.find((row) => row.id === itemId);
  if (!item) return null;
  if (item.kind === "cash") return [];
  if (item.kind !== "idea") return [item];

  return [item, ...copyable.filter((row) => row.parentId === item.id)];
}

/**
 * Writes copies of `rows` onto the end of `destListId` and says how many.
 *
 * Ideas keep their presents: each child is pointed at its idea's new id. A
 * present copied without its idea — one gift lifted out of "knitting" — lands
 * at the top level, since the idea it belonged to isn't coming with it.
 */
export function copyGifts(
  rows: Item[],
  destListId: string,
  {
    keepReasons,
    keepMostWanted,
    intoGuide,
  }: {
    keepReasons: boolean;
    /** "Most wanted" on a wishlist, "top pick" on a guide; see copyToList. */
    keepMostWanted: boolean;
    /** Nothing on a guide has units or is chipped in on; see addGift. */
    intoGuide: boolean;
  },
): number {
  const copied = new Set(rows.map((row) => row.id));
  const newIds = new Map(rows.map((row) => [row.id, crypto.randomUUID()]));
  const isTop = (row: Item) => row.parentId === null || !copied.has(row.parentId);

  const copyOf = (row: Item, parentId: string | null, position: number) => ({
    id: newIds.get(row.id)!,
    listId: destListId,
    parentId,
    position,
    kind: row.kind,
    title: row.title,
    url: row.url,
    sourceDomain: row.sourceDomain,
    // Uploaded photos are shared by URL rather than duplicated on disk. The
    // admin screen counts a photo as in use while any row points at it, so a
    // copy keeps the original's photo from looking like an orphan.
    images: row.images,
    selectedImageIndex: row.selectedImageIndex,
    emoji: row.emoji,
    priceCents: row.priceCents,
    currency: row.currency,
    quantity: intoGuide ? 1 : row.quantity,
    reason: keepReasons ? row.reason : null,
    isMostWanted: keepMostWanted ? row.isMostWanted : false,
    isGroupGift: intoGuide ? false : row.isGroupGift,
    goalCents: intoGuide ? null : row.goalCents,
    needsAttention: row.needsAttention,
  });

  return db.transaction((tx) => {
    const last = tx
      .select({ max: max(items.position) })
      .from(items)
      .where(and(eq(items.listId, destListId), isNull(items.parentId)))
      .get();
    let next = (last?.max ?? -1) + 1;

    const top = rows.filter(isTop).map((row) => copyOf(row, null, next++));
    // Children keep their own positions: they are counted among their idea's
    // presents, and the whole idea is new, so there is nothing to collide with.
    const children = rows
      .filter((row) => !isTop(row))
      .map((row) => copyOf(row, newIds.get(row.parentId!)!, row.position));

    // Parents first, in their own statement, so every child's parent_id
    // already exists when the foreign key is checked.
    if (top.length) tx.insert(items).values(top).run();
    if (children.length) tx.insert(items).values(children).run();

    return top.length + children.length;
  });
}
