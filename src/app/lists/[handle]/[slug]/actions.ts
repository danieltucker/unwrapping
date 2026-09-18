"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { items } from "@/db/schema";
import { formatPrice } from "@/config/site";
import { claimItem, releaseItem } from "@/lib/claims";
import {
  contributeToItem,
  MIN_CONTRIBUTION_CENTS,
  type ContributionOutcome,
} from "@/lib/contributions";
import { resolveList, viewerOwns } from "@/lib/list-access";
import { publicList } from "@/lib/routes";
import { setItemBought } from "@/lib/reservations";
import { parsePriceToCents } from "@/lib/scrape-parse";
import {
  ensureGuestToken,
  getCurrentUser,
  readGuestToken,
} from "@/lib/session";

export type ReserveState = { ok?: boolean; error?: string };

const MESSAGES = {
  gone: "Someone just claimed this one. Nothing was reserved for you.",
  missing: "That gift is no longer on the list.",
  "already-yours": "You've already reserved this one.",
} as const;

/** The same three answers, for something that was never exclusive to begin with. */
const IDEA_MESSAGES = {
  // An idea has no capacity, so claimItem cannot report it gone.
  gone: MESSAGES.gone,
  missing: "That idea is no longer on the list.",
  "already-yours": "You're already down for this one.",
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

  // The card never offers this on a group gift or a cash ask, but the action
  // is a public endpoint and should not take its word for it.
  if (item.isGroupGift) {
    return { error: "This one is chipped in on rather than reserved." };
  }

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

  if (outcome !== "claimed") {
    return { error: (item.kind === "idea" ? IDEA_MESSAGES : MESSAGES)[outcome] };
  }

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

export type ChipInState = {
  ok?: boolean;
  error?: string;
  amountCents?: number;
  /**
   * How to actually send the money, for a cash gift. Handed back only in the
   * answer to a chip-in, so it reaches the person who just gave and nobody
   * else; it is never part of the public list.
   */
  paymentDetails?: string | null;
};

const CHIP_IN_MESSAGES: Record<Exclude<ContributionOutcome, "recorded">, string> = {
  missing: MESSAGES.missing,
  "not-group": "This gift isn't a group gift. Reserve it instead.",
  funded: "This one is fully funded already. Nothing more is needed.",
  "too-small": `The smallest chip-in is ${formatPrice(MIN_CONTRIBUTION_CENTS)}.`,
  "too-large": `That's larger than we can take in one go.`,
};

/**
 * Records a chip-in toward a group gift.
 *
 * Nothing is charged: the design authorises on contribution and captures only
 * when the goal is met, and no payments exist yet. What is real is the amount,
 * the running total, and that the owner is never told who gave it.
 */
export async function chipIn(
  _previous: ChipInState,
  formData: FormData,
): Promise<ChipInState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  const resolved = await resolveList(handle, key);
  if (!resolved) return { error: MESSAGES.missing };

  // An owner chipping in to their own list would only confuse their own totals.
  if (await viewerOwns(resolved)) {
    return { error: "This is your own list. Guests chip in from here." };
  }

  const item = await db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item || item.listId !== resolved.list.id) return { error: MESSAGES.missing };

  const amountCents = parsePriceToCents(String(formData.get("amount") ?? "").trim());
  if (amountCents === null) {
    return { error: "Type an amount, numbers only." };
  }

  const [guestToken, user] = await Promise.all([ensureGuestToken(), getCurrentUser()]);
  const outcome = await contributeToItem(
    itemId,
    guestToken,
    user?.id ?? null,
    amountCents,
  );

  if (outcome !== "recorded") return { error: CHIP_IN_MESSAGES[outcome] };

  revalidatePath(publicList(resolved.list, resolved.ownerHandle));
  return {
    ok: true,
    amountCents,
    paymentDetails: item.kind === "cash" ? resolved.list.paymentDetails : null,
  };
}

export type BoughtState = { ok?: boolean; error?: string };

/**
 * Ticks off a gift the viewer has reserved, from the list page.
 *
 * It says nothing to the owner of a surprise list: the flag lives on the
 * guest's own claim row, which such an owner is never handed.
 */
export async function markGiftBought(
  _previous: BoughtState,
  formData: FormData,
): Promise<BoughtState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const bought = formData.get("bought") === "true";

  const resolved = await resolveList(handle, key);
  if (!resolved) return { error: MESSAGES.missing };

  const ok = await setItemBought(itemId, bought);
  if (!ok) return { error: "We couldn't find your reservation for this one." };

  revalidatePath(publicList(resolved.list, resolved.ownerHandle));
  return { ok: true };
}
