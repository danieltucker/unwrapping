import "server-only";

import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { items, type Item } from "@/db/schema";

/**
 * Moving a present that is already on the list under one of its ideas, or back
 * out to the top level.
 *
 * The rules are the ones addGift enforces when a present is created inside an
 * idea, and they live here because a move can now arrive from two places: the
 * dropdown in the edit panel, and the picker in "Add a gift to …". Neither may
 * trust what it was posted — a parent id is a string in a form body — so both
 * come through this.
 *
 * Only a present moves. An idea is always top level, and cash has no place
 * under a shopping direction; both are refused here rather than hidden in the
 * UI alone.
 */

/**
 * Hangs `item` under `parentId`, or takes it back out to the top level when
 * that is null.
 *
 * Answers with a sentence to show rather than throwing: every caller is a
 * dialog over the editor, and the list behind it should still be there.
 * Returns null when the move went through, and also when there was nothing to
 * do — re-saving a gift without touching the dropdown is not a move.
 */
export async function moveUnderIdea(
  listId: string,
  item: Item,
  parentId: string | null,
): Promise<string | null> {
  if (parentId === item.parentId) return null;

  if (item.kind === "idea") {
    return "An idea can't go inside another idea.";
  }
  if (item.kind === "cash") {
    return "An ask for money can't go under an idea.";
  }

  if (parentId !== null) {
    const parent = await db
      .select()
      .from(items)
      .where(and(eq(items.id, parentId), eq(items.listId, listId)))
      .get();

    if (!parent) return "That idea is no longer on the list.";
    // The same one-level rule the column can't express: see items.parentId.
    if (parent.kind !== "idea" || parent.parentId !== null) {
      return "Only an idea can hold gifts of its own.";
    }
  }

  // Positions are counted among siblings, so a moved present joins the end of
  // wherever it lands rather than keeping a number that means nothing there.
  const last = await db
    .select({ max: sql<number | null>`max(${items.position})` })
    .from(items)
    .where(
      and(
        eq(items.listId, listId),
        parentId === null ? isNull(items.parentId) : eq(items.parentId, parentId),
        // Its own row would otherwise count toward the end it is moving to.
        ne(items.id, item.id),
      ),
    )
    .get();

  await db
    .update(items)
    .set({ parentId, position: (last?.max ?? -1) + 1 })
    .where(eq(items.id, item.id));

  return null;
}
