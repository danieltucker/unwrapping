"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { items, type ItemKind } from "@/db/schema";
import { parseGiftEmoji } from "@/lib/emoji";
import { requireOwnedList } from "@/lib/list-access";
import { sourceDomain } from "@/lib/outbound";
import * as routes from "@/lib/routes";
import { parsePriceToCents, scrapeProduct, type ScrapeResult } from "@/lib/scrape";

export type PreviewState = { result?: ScrapeResult; error?: string };

/** Step one: read the pasted link. Always lands on an editable result. */
export async function previewGift(
  _previous: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");

  // Scraping runs on the owner's behalf, so verify ownership before fetching.
  await requireOwnedList(handle, key);

  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Paste a link first." };

  return { result: await scrapeProduct(url) };
}

/**
 * `ok` rather than a redirect: the form is a dialog over the editor, so
 * finishing means closing the panel and letting the list behind it refresh,
 * not going anywhere.
 */
export type AddGiftState = { ok?: boolean; error?: string };

export async function addGift(
  _previous: AddGiftState,
  formData: FormData,
): Promise<AddGiftState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "A gift needs a title." };

  /**
   * The idea this present is being added to, if any.
   *
   * Checked here rather than trusted, because a parent id is just a string in
   * a form post: it has to belong to this list, and it has to be an idea. The
   * "no grandparent" rule is what keeps the nesting one level deep, which is
   * the depth the public card and the editor are both drawn for.
   */
  const postedParent = String(formData.get("parentId") ?? "").trim();
  let parentId: string | null = null;
  if (postedParent) {
    const parent = await db
      .select()
      .from(items)
      .where(and(eq(items.id, postedParent), eq(items.listId, list.id)))
      .get();

    if (!parent) return { error: "That idea is no longer on the list." };
    if (parent.kind !== "idea" || parent.parentId !== null) {
      return { error: "Only an idea can hold gifts of its own." };
    }
    parentId = parent.id;
  }

  // Only "cash" and "idea" change the shape of the row; anything else posted
  // in is a gift like any other.
  //
  // Inside an idea there is nothing else to be: an idea within an idea is the
  // nesting we do not do, and cash has no place under a shopping direction.
  const posted = parentId ? "thing" : formData.get("kind");
  const kind: ItemKind =
    posted === "cash" ? "cash" : posted === "idea" ? "idea" : "thing";

  // Neither money nor an idea points at a product page.
  const url =
    kind === "thing" ? String(formData.get("url") ?? "").trim() || null : null;

  const rawPrice = String(formData.get("price") ?? "").trim();
  // An idea is a direction, not a purchase, so it carries no price even if one
  // were posted in.
  const priceCents = kind === "idea" || !rawPrice ? null : parsePriceToCents(rawPrice);
  if (kind !== "idea" && rawPrice && priceCents === null) {
    return { error: "That price didn't look like a number." };
  }

  // Money has no quantity, and an idea has no units to run out of.
  const quantity =
    kind === "thing"
      ? Math.min(
          Math.max(
            Number.parseInt(String(formData.get("quantity") ?? "1"), 10) || 1,
            1,
          ),
          20,
        )
      : 1;

  let images: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(formData.get("images") ?? "[]"));
    if (Array.isArray(parsed)) {
      images = parsed.filter((i): i is string => typeof i === "string");
    }
  } catch {
    images = [];
  }

  const selectedImageIndex = Math.min(
    Math.max(
      Number.parseInt(String(formData.get("selectedImageIndex") ?? "0"), 10) || 0,
      0,
    ),
    Math.max(images.length - 1, 0),
  );

  // Keep an explicit ordering so drag-to-reorder has something to persist.
  // Counted among siblings: a present added to an idea goes after that idea's
  // other presents, not after everything on the list.
  const last = await db
    .select({ max: sql<number | null>`max(${items.position})` })
    .from(items)
    .where(
      and(
        eq(items.listId, list.id),
        parentId === null ? isNull(items.parentId) : eq(items.parentId, parentId),
      ),
    )
    .get();

  // Stands in for a photo wherever there is none.
  const emoji = parseGiftEmoji(formData.get("emoji"));

  // Cash is always open to chipping in; there is nothing else to do with it.
  // An idea has no price to split, so it is never one.
  const isGroupGift =
    kind === "cash" || (kind === "thing" && formData.get("isGroupGift") === "on");
  const rawGoal = String(formData.get("goal") ?? "").trim();
  const parsedGoal = rawGoal ? parsePriceToCents(rawGoal) : null;
  if (isGroupGift && rawGoal && parsedGoal === null) {
    return { error: "That goal didn't look like a number." };
  }

  await db.insert(items).values({
    listId: list.id,
    parentId,
    position: (last?.max ?? -1) + 1,
    kind,
    title,
    url,
    sourceDomain: sourceDomain(url),
    images,
    selectedImageIndex,
    emoji,
    priceCents,
    currency: String(formData.get("currency") ?? "USD").toUpperCase(),
    quantity,
    reason: String(formData.get("reason") ?? "").trim() || null,
    isMostWanted: formData.get("isMostWanted") === "on",
    isGroupGift,
    // A group gift aims at its own price unless the owner set a goal of their own.
    goalCents: isGroupGift ? (parsedGoal ?? priceCents) : null,
    // Items with nothing to look at get flagged so the editor can nudge about
    // it. An emoji counts: it is a deliberate choice, not a gap. Cash is never
    // expected to have a photo, so it is never nagged about one.
    needsAttention:
      kind === "thing" && images.length === 0 && !emoji ? "no-photo" : null,
  });

  revalidatePath(routes.manageList(list, ownerHandle));
  revalidatePath(routes.publicList(list, ownerHandle));
  return { ok: true };
}
