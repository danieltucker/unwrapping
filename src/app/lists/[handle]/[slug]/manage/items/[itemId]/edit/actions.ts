"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { items, type Item } from "@/db/schema";
import { parseGiftEmoji } from "@/lib/emoji";
import { moveUnderIdea } from "@/lib/item-moves";
import { requireOwnedList, type ResolvedList } from "@/lib/list-access";
import { sourceDomain } from "@/lib/outbound";
import { PRICE_ERROR, parsePriceInput } from "@/lib/price";
import { recordPrice } from "@/lib/price-checks";
import * as routes from "@/lib/routes";
import { scrapeProduct } from "@/lib/scrape";

/**
 * `ok` rather than a redirect: this form is a dialog over the editor, so
 * finishing means closing the panel and letting the list behind it refresh,
 * not going anywhere.
 */
export type EditItemState = { ok?: boolean; error?: string; message?: string };

/** Loads an item, proving it belongs to a list this viewer owns. */
async function ownedItem(
  handle: string,
  key: string,
  itemId: string,
): Promise<{ item: Item; owned: ResolvedList }> {
  const owned = await requireOwnedList(handle, key);
  const item = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.listId, owned.list.id)))
    .get();

  // requireOwnedList already 404s for a list you don't own; this covers an id
  // from a different list being posted in.
  if (!item) redirect(routes.manageList(owned.list, owned.ownerHandle));
  return { item, owned };
}

function refreshList(owned: ResolvedList) {
  revalidatePath(routes.manageList(owned.list, owned.ownerHandle));
  revalidatePath(routes.publicList(owned.list, owned.ownerHandle));
}

export async function updateItem(
  _previous: EditItemState,
  formData: FormData,
): Promise<EditItemState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const { item, owned } = await ownedItem(handle, key, itemId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "A gift needs a title." };

  // An idea is a direction, not a purchase; it has no price to edit. Words
  // like "from $35" are kept as typed; see parsePriceInput.
  const price =
    item.kind === "idea"
      ? { cents: null, label: null }
      : parsePriceInput(String(formData.get("price") ?? ""));
  if (price === null) {
    return { error: PRICE_ERROR };
  }
  const priceCents = price.cents;

  // On a guide nothing is bought for one person: no units, no chipping in.
  // See addGift.
  const guide = owned.list.kind === "guide";
  const quantity = guide
    ? 1
    : Math.min(
        Math.max(Number.parseInt(String(formData.get("quantity") ?? "1"), 10) || 1, 1),
        20,
      );

  const selectedImageIndex = Math.min(
    Math.max(
      Number.parseInt(String(formData.get("selectedImageIndex") ?? "0"), 10) || 0,
      0,
    ),
    Math.max(item.images.length - 1, 0),
  );

  // Stands in for a photo wherever there is none.
  const emoji = parseGiftEmoji(formData.get("emoji"));

  // A gift cannot change kind after it exists: the guests looking at it have
  // been told what it is. Cash stays a group gift; an idea has no price to
  // split and so never becomes one.
  const isGroupGift =
    item.kind === "cash" ||
    (item.kind === "thing" && !guide && formData.get("isGroupGift") === "on");
  const rawGoal = String(formData.get("goal") ?? "").trim();
  const parsedGoal = rawGoal ? (parsePriceInput(rawGoal)?.cents ?? null) : null;
  if (isGroupGift && rawGoal && parsedGoal === null) {
    return { error: "That goal didn't look like a number." };
  }

  await db
    .update(items)
    .set({
      title,
      priceCents,
      priceLabel: price.label,
      // A price that was edited is the owner's now, and the recheck leaves it
      // alone from here on. One that was left as it was keeps its source.
      priceSource:
        priceCents === item.priceCents && price.label === item.priceLabel
          ? item.priceSource
          : priceCents === null
            ? null
            : "owner",
      quantity: item.kind === "thing" ? quantity : 1,
      selectedImageIndex,
      emoji,
      reason: String(formData.get("reason") ?? "").trim() || null,
      isMostWanted: formData.get("isMostWanted") === "on",
      isGroupGift,
      goalCents: isGroupGift ? (parsedGoal ?? priceCents ?? item.goalCents) : null,
      needsAttention:
        item.kind === "thing" && item.images.length === 0 && !emoji
          ? "no-photo"
          : null,
    })
    .where(eq(items.id, itemId));

  /**
   * Which idea this present belongs under, if the panel offered the choice.
   *
   * The dropdown is only rendered where the move is possible at all, so a post
   * without the field is a form that never showed one — not a request to pull
   * the gift out of the idea it is in. An empty value *is* that request.
   */
  if (formData.has("parentId")) {
    const problem = await moveUnderIdea(
      owned.list.id,
      item,
      String(formData.get("parentId") ?? "").trim() || null,
    );
    if (problem) return { error: problem };
  }

  refreshList(owned);
  return { ok: true };
}

export async function deleteItem(
  _previous: EditItemState,
  formData: FormData,
): Promise<EditItemState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const { owned } = await ownedItem(handle, key, itemId);

  // Claims cascade with the item. A guest who reserved it keeps no dangling row.
  await db.delete(items).where(eq(items.id, itemId));

  refreshList(owned);
  return { ok: true };
}

/**
 * Re-reads the product page and fills in what the shop now gives us.
 *
 * A price typed by hand is kept, because the owner's own correction outranks a
 * scrape, but a missing title or photo is replaced gladly, and a price that
 * came from the shop in the first place follows the shop.
 */
export async function refetchItem(
  _previous: EditItemState,
  formData: FormData,
): Promise<EditItemState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const { item, owned } = await ownedItem(handle, key, itemId);

  if (!item.url) return { error: "This gift has no link to re-read." };

  const result = await scrapeProduct(item.url);
  if (result.error) return { error: result.error };

  const changes: string[] = [];
  if (result.title && result.title !== item.title) changes.push("title");
  if (result.images.length && result.images.join() !== item.images.join()) {
    changes.push(`${result.images.length} photo${result.images.length === 1 ? "" : "s"}`);
  }
  // The shop's price replaces an empty one or an earlier shop price; a price
  // the owner typed stays put.
  const takesShopPrice =
    result.priceCents !== null && item.priceSource !== "owner";
  const priceCents = takesShopPrice ? result.priceCents : item.priceCents;
  if (takesShopPrice && result.priceCents !== item.priceCents) changes.push("price");

  await db
    .update(items)
    .set({
      title: result.title ?? item.title,
      url: result.url,
      sourceDomain: sourceDomain(result.url),
      images: result.images.length ? result.images : item.images,
      selectedImageIndex: 0,
      // Never clobber a price the owner typed themselves.
      priceCents,
      priceSource: takesShopPrice ? "scrape" : item.priceSource,
      currency: takesShopPrice ? (result.currency ?? item.currency) : item.currency,
      needsAttention: result.images.length === 0 ? "no-photo" : null,
    })
    .where(eq(items.id, itemId));

  // Whatever the gift ended up with, the shop's own price is history.
  await recordPrice(result.url, result.priceCents, result.currency);

  // The form reads the gift from the editor behind it, so refreshing the list
  // is what puts a re-read title and its new photos on screen.
  refreshList(owned);

  return {
    message: changes.length
      ? `Updated the ${changes.join(", ")}.`
      : "Nothing new to bring across. It's already up to date.",
  };
}
