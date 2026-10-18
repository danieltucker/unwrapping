"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categories, items, lists, type List } from "@/db/schema";
import { parseClaimRule } from "@/lib/claim-rules";
import { moveUnderIdea } from "@/lib/item-moves";
import { requireOwnedList } from "@/lib/list-access";
import * as routes from "@/lib/routes";

export type ReorderState = { error?: string };

/**
 * Persists the order the owner dragged the gifts into.
 *
 * The whole group is sent, not a move, so one dropped request can't leave two
 * gifts sharing a position. Ids that don't belong to it are dropped and a
 * mismatched count is refused outright, because the list changed underneath them.
 *
 * "The group" is one run of siblings: the top level of the list, or the
 * presents inside a single idea. Positions are counted per group, so sorting
 * them together would have two gifts in different groups fighting over the same
 * number — and dragging a present out of its idea by accident is not a gesture
 * anyone means to make.
 */
export async function reorderGifts(
  handle: string,
  key: string,
  orderedIds: string[],
  /** The idea whose presents are being sorted, or null for the top level. */
  parentId: string | null = null,
): Promise<ReorderState> {
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  const existing = await db
    .select({ id: items.id })
    .from(items)
    .where(
      and(
        eq(items.listId, list.id),
        parentId === null ? isNull(items.parentId) : eq(items.parentId, parentId),
      ),
    )
    .all();

  const owned = new Set(existing.map((item) => item.id));
  const next = orderedIds.filter((id) => owned.has(id));

  if (next.length !== existing.length) {
    return { error: "This list changed while you were dragging. Reload and try again." };
  }

  // One transaction, so the list is never half-reordered.
  db.transaction((tx) => {
    next.forEach((id, index) => {
      tx.update(items).set({ position: index }).where(eq(items.id, id)).run();
    });
  });

  revalidatePath(routes.manageList(list, ownerHandle));
  revalidatePath(routes.publicList(list, ownerHandle));
  return {};
}

export type MoveGiftState = { ok?: boolean; error?: string };

/**
 * Puts a present that is already on the list under an idea.
 *
 * The other way in is the dropdown in the edit panel, which rides along with
 * the rest of that form; this one exists for the picker inside "Add a gift to
 * …", where moving one across *is* the whole action. Both land in
 * moveUnderIdea, which is where the move is checked rather than trusted.
 */
export async function moveGiftToIdea(
  handle: string,
  key: string,
  itemId: string,
  /** The idea it is going under, or null to take it back to the top level. */
  parentId: string | null,
): Promise<MoveGiftState> {
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  const item = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.listId, list.id)))
    .get();

  if (!item) return { error: "That gift is no longer on the list." };

  const problem = await moveUnderIdea(list.id, item, parentId);
  if (problem) return { error: problem };

  revalidatePath(routes.manageList(list, ownerHandle));
  revalidatePath(routes.publicList(list, ownerHandle));
  return { ok: true };
}

export type ListDetailsState = { ok?: boolean; error?: string };

/**
 * Edits what a list *is*: its name, emoji, date, note, and the rules that
 * govern it.
 *
 * The slug is deliberately left alone. A renamed list keeps the URL that has
 * already been pasted into messages; only what people read changes.
 */
export async function updateListDetails(
  _previous: ListDetailsState,
  formData: FormData,
): Promise<ListDetailsState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give your list a name." };
  if (name.length > 80) return { error: "That name is a little long." };

  // An emoji can be several code points; anything longer isn't one.
  const emoji = String(formData.get("emoji") ?? "").slice(0, 8) || list.emoji;
  const note = String(formData.get("note") ?? "").trim() || null;

  // A guide has none of the rules below — no date, no address, no claims —
  // and one setting of its own instead: which shelf of /gifts it sits on.
  if (list.kind === "guide") {
    const categoryId = await postedCategory(formData);
    if (categoryId === undefined) return { error: "That category is no longer there." };
    if (list.publishedAt && categoryId === null) {
      return {
        error: "A published gift list needs a category. Unpublish it first to take it off the shelf.",
      };
    }

    await db
      .update(lists)
      .set({ name, emoji, note, categoryId })
      .where(eq(lists.id, list.id));

    refreshGuide(list, ownerHandle);
    return { ok: true };
  }

  const rawDate = String(formData.get("eventDate") ?? "").trim();
  const eventDate = rawDate ? new Date(`${rawDate}T00:00:00`) : null;
  if (eventDate && Number.isNaN(eventDate.getTime())) {
    return { error: "That date didn't look right." };
  }

  // Enforced here as well as in the field: a browser is free to lie about maxLength.
  const deliveryAddress =
    String(formData.get("deliveryAddress") ?? "").trim() || null;
  if (deliveryAddress && deliveryAddress.length > 400) {
    return { error: "That address is longer than we can store." };
  }

  const paymentDetails = String(formData.get("paymentDetails") ?? "").trim() || null;
  if (paymentDetails && paymentDetails.length > 400) {
    return { error: "Those payment details are longer than we can store." };
  }

  await db
    .update(lists)
    .set({
      name,
      emoji,
      eventDate,
      note,
      deliveryAddress,
      paymentDetails,
      claimRule: parseClaimRule(formData.get("claimRule")),
      surpriseMode: formData.get("surpriseMode") === "on",
      allowCopying: formData.get("allowCopying") === "on",
    })
    .where(eq(lists.id, list.id));

  revalidatePath(routes.manageList(list, ownerHandle));
  revalidatePath(routes.publicList(list, ownerHandle));
  return { ok: true };
}

/**
 * The category posted with a guide's details: its id, null for "none yet", or
 * undefined when the id names nothing — checked rather than trusted, since it
 * is a string in a form body.
 */
async function postedCategory(formData: FormData): Promise<string | null | undefined> {
  const posted = String(formData.get("categoryId") ?? "");
  if (!posted) return null;
  const row = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, posted))
    .get();
  return row?.id;
}

/** A guide shows up on more pages than its own, and all of them go stale together. */
function refreshGuide(list: List, ownerHandle: string | null) {
  revalidatePath(routes.manageList(list, ownerHandle));
  revalidatePath(routes.publicList(list, ownerHandle));
  revalidatePath(routes.giftGuides, "layout");
  revalidatePath("/");
}

export type PublishState = { ok?: boolean; error?: string };

/**
 * Puts a gift guide on /gifts, or takes it off.
 *
 * There is no review step; a guide goes live the moment its owner says so.
 * What publishing asks for is only what a browse page needs to show it
 * sensibly: a shelf to sit on, and at least one gift, because an empty tile is
 * a dead end for whoever clicks it.
 *
 * Unpublishing does not hide the list from people who already have its link —
 * nothing does, for any list — it takes it off /gifts, the homepage and the
 * sitemap, and asks search engines to forget it.
 */
export async function setGuidePublished(
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const publish = formData.get("publish") === "true";
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  if (list.kind !== "guide") {
    return { error: "Only a gift list for anyone can be published." };
  }
  // Guides are only ever made with an account, but the public page puts a
  // name on it, so this is checked rather than assumed.
  if (!list.ownerId) return { error: "Save your account first, so the list has a name on it." };

  if (publish) {
    if (!list.categoryId) {
      return { error: "Pick a category first, with the pencil next to the title." };
    }
    const gifts = await db
      .select({ count: count() })
      .from(items)
      .where(eq(items.listId, list.id))
      .get();
    if (!gifts?.count) return { error: "Add at least one gift before publishing." };
  }

  await db
    .update(lists)
    // Publishing one that is already live keeps its date, so a double click
    // doesn't jump it to the front of "newest".
    .set({ publishedAt: publish ? (list.publishedAt ?? new Date()) : null })
    .where(eq(lists.id, list.id));

  refreshGuide(list, ownerHandle);
  return { ok: true };
}
