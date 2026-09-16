"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { items } from "@/db/schema";
import { claimItem, releaseItem } from "@/lib/claims";
import { resolveList } from "@/lib/list-access";
import { publicList } from "@/lib/routes";
import { ensureGuestToken, readGuestToken } from "@/lib/session";

export type ReserveState = { ok?: boolean; error?: string };

const MESSAGES = {
  gone: "Someone just claimed this one. Nothing was reserved for you.",
  missing: "That gift is no longer on the list.",
  "already-yours": "You've already reserved this one.",
} as const;

export async function reserveGift(
  _previous: ReserveState,
  formData: FormData,
): Promise<ReserveState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  const resolved = await resolveList(handle, key);
  if (!resolved) return { error: MESSAGES.missing };

  // Verify the item really belongs to this list before writing anything.
  const item = await db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item || item.listId !== resolved.list.id) return { error: MESSAGES.missing };

  const firstName =
    resolved.list.claimRule === "firstName"
      ? String(formData.get("firstName") ?? "").trim()
      : null;

  if (resolved.list.claimRule === "firstName" && !firstName) {
    return { error: "This list asks for a first name so guests can coordinate." };
  }

  // The guest gets a durable identity here, so their reservations survive a
  // new session without an account.
  const guestToken = await ensureGuestToken();
  const outcome = await claimItem(itemId, guestToken, firstName);

  if (outcome !== "claimed") return { error: MESSAGES[outcome] };

  revalidatePath(publicList(resolved.list, resolved.ownerHandle));
  return { ok: true };
}

export async function releaseGift(
  _previous: ReserveState,
  formData: FormData,
): Promise<ReserveState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  const resolved = await resolveList(handle, key);
  if (!resolved) return { error: MESSAGES.missing };

  const guestToken = await readGuestToken();
  if (!guestToken) return { error: "We couldn't find your reservation." };

  await releaseItem(itemId, guestToken);

  revalidatePath(publicList(resolved.list, resolved.ownerHandle));
  return { ok: true };
}
