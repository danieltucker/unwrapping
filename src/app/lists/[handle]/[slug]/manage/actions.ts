"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { items, lists } from "@/db/schema";
import { parseClaimRule } from "@/lib/claim-rules";
import { requireOwnedList } from "@/lib/list-access";
import * as routes from "@/lib/routes";

export type ReorderState = { error?: string };

/**
 * Persists the order the owner dragged the gifts into.
 *
 * The whole list is sent, not a move, so one dropped request can't leave two
 * gifts sharing a position. Ids that don't belong to this list are dropped and
 * a mismatched count is refused outright, because the list changed underneath them.
 */
export async function reorderGifts(
  handle: string,
  key: string,
  orderedIds: string[],
): Promise<ReorderState> {
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  const existing = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.listId, list.id))
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

export type ListDetailsState = { ok?: boolean; error?: string };

/**
 * Edits what a list *is*: its name, emoji, date, note, and the two rules that
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
      // An emoji can be several code points; anything longer isn't one.
      emoji: String(formData.get("emoji") ?? "").slice(0, 8) || list.emoji,
      eventDate,
      note: String(formData.get("note") ?? "").trim() || null,
      deliveryAddress,
      paymentDetails,
      claimRule: parseClaimRule(formData.get("claimRule")),
      surpriseMode: formData.get("surpriseMode") === "on",
    })
    .where(eq(lists.id, list.id));

  revalidatePath(routes.manageList(list, ownerHandle));
  revalidatePath(routes.publicList(list, ownerHandle));
  return { ok: true };
}
