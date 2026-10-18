"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { items } from "@/db/schema";
import { formatPrice } from "@/config/site";
import { claimItem, releaseItem } from "@/lib/claims";
import {
  contributeToItem,
  MIN_CONTRIBUTION_CENTS,
  type ContributionOutcome,
} from "@/lib/contributions";
import { copyGifts, ownedDestination, pickRows } from "@/lib/copying";
import { insertList } from "@/lib/create-list";
import { resolveList, viewerOwns } from "@/lib/list-access";
import { manageList, publicList } from "@/lib/routes";
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

/**
 * A gift guide is for anyone, so nothing on it is reserved: a thousand people
 * can buy the same headlamp. The page never offers it; the actions refuse it.
 */
const GUIDE_MESSAGE =
  "This is a gift list for anyone, so there's nothing to reserve. Buy it straight from the shop, or add it to a list of your own.";

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
  if (resolved.list.kind === "guide") return { error: GUIDE_MESSAGE };

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
  if (resolved.list.kind === "guide") return { error: GUIDE_MESSAGE };

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

export type CopyState = {
  error?: string;
  /** Set when gifts went onto a list that already existed. */
  added?: { count: number; listName: string; href: string };
};

/** What a new list made by copying a single gift is called until it's renamed. */
const COPY_STARTER_NAME = "My wishlist";

/**
 * Copies a whole list, or one gift from it, onto a list the viewer owns.
 *
 * `destination` is either a list id or "new". A new list is created for
 * whoever is asking, exactly as /new would — an anonymous visitor gets a draft
 * held in this browser — and they are taken straight to its editor. Gifts
 * added to a list they already had are confirmed in the dialog instead, so
 * they can carry on browsing the list they found them on.
 *
 * What a copy takes, and what it leaves behind, is decided in copyGifts.
 */
export async function copyToList(
  _previous: CopyState,
  formData: FormData,
): Promise<CopyState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  // Empty for the whole list.
  const itemId = String(formData.get("itemId") ?? "") || null;
  const destination = String(formData.get("destination") ?? "new");

  const source = await resolveList(handle, key);
  if (!source) return { error: "That list is no longer here." };

  // The owner may always copy their own list; the switch is about everyone else.
  const isOwner = await viewerOwns(source);
  if (!isOwner && !source.list.allowCopying) {
    return { error: "The owner of this list has turned copying off." };
  }

  const rows = await db
    .select()
    .from(items)
    .where(eq(items.listId, source.list.id))
    .orderBy(asc(items.position))
    .all();

  const picked = pickRows(rows, itemId);
  if (picked === null) return { error: MESSAGES.missing };
  if (picked.length === 0) {
    return {
      error: itemId
        ? "An ask for money stays with the list it was made for."
        : "There's nothing on this list that can be copied yet.",
    };
  }

  // A guide's reasons are recommendations written for strangers, so they
  // always travel; a wishlist's are personal, so only its owner keeps them.
  // "Most wanted" and "top pick" are different claims, so the flag only
  // survives a copy between lists of the same kind, and only for the owner
  // or from a guide.
  const fromGuide = source.list.kind === "guide";
  const options = (intoGuide: boolean) => ({
    keepReasons: isOwner || fromGuide,
    keepMostWanted: (isOwner || fromGuide) && intoGuide === fromGuide,
    intoGuide,
  });

  if (destination === "new") {
    const fallback = itemId ? COPY_STARTER_NAME : source.list.name;
    const name = String(formData.get("name") ?? "").trim() || fallback;
    if (name.length > 80) return { error: "That name is a little long." };

    const { list, ownerHandle } = await insertList({
      name,
      emoji: itemId ? "🎁" : source.list.emoji,
      // A new occasion: the date is always theirs to set.
      eventDate: null,
      // The note and the rules are the original owner's say-so, so only the
      // owner's own duplicate keeps them.
      note: isOwner && !itemId && !fromGuide ? source.list.note : null,
      claimRule: isOwner && !fromGuide ? source.list.claimRule : "anonymous",
      surpriseMode: isOwner && !fromGuide ? source.list.surpriseMode : true,
      // Only a stranger's copy of the whole list counts toward "copied N
      // times"; an owner duplicating their own is not an endorsement.
      copiedFromListId: !isOwner && !itemId ? source.list.id : null,
    });

    // Always a wishlist: a new gift guide starts from /gifts/new.
    copyGifts(picked, list.id, options(false));

    // redirect() throws a control-flow exception, so it must sit outside try/catch.
    redirect(`${manageList(list, ownerHandle)}?started=copy`);
  }

  const dest = await ownedDestination(destination);
  if (!dest) {
    return {
      error:
        "We couldn't confirm that list is yours — your sign-in may have run out. Reload the page and try again.",
    };
  }
  if (dest.list.id === source.list.id) {
    return { error: "These gifts are already on that list." };
  }

  const count = copyGifts(picked, dest.list.id, options(dest.list.kind === "guide"));

  revalidatePath(manageList(dest.list, dest.ownerHandle));
  revalidatePath(publicList(dest.list, dest.ownerHandle));

  return {
    added: {
      count,
      listName: dest.list.name,
      href: manageList(dest.list, dest.ownerHandle),
    },
  };
}
