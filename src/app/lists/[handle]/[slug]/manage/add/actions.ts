"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { items, type ItemKind } from "@/db/schema";
import { parseGiftEmoji } from "@/lib/emoji";
import { requireOwnedList } from "@/lib/list-access";
import { sourceDomain } from "@/lib/outbound";
import { manageList } from "@/lib/routes";
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

export type AddGiftState = { error?: string };

export async function addGift(
  _previous: AddGiftState,
  formData: FormData,
): Promise<AddGiftState> {
  const handle = String(formData.get("handle") ?? "");
  const key = String(formData.get("key") ?? "");
  const { list, ownerHandle } = await requireOwnedList(handle, key);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "A gift needs a title." };

  // Cash is the only kind that changes the shape of the row; anything else
  // posted in is a gift like any other.
  const kind: ItemKind = formData.get("kind") === "cash" ? "cash" : "thing";

  const url = kind === "cash" ? null : String(formData.get("url") ?? "").trim() || null;

  const rawPrice = String(formData.get("price") ?? "").trim();
  const priceCents = rawPrice ? parsePriceToCents(rawPrice) : null;
  if (rawPrice && priceCents === null) {
    return { error: "That price didn't look like a number." };
  }

  // Money has no quantity.
  const quantity =
    kind === "cash"
      ? 1
      : Math.min(
          Math.max(
            Number.parseInt(String(formData.get("quantity") ?? "1"), 10) || 1,
            1,
          ),
          20,
        );

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
  const last = await db
    .select({ max: sql<number | null>`max(${items.position})` })
    .from(items)
    .where(eq(items.listId, list.id))
    .get();

  // Stands in for a photo wherever there is none.
  const emoji = parseGiftEmoji(formData.get("emoji"));

  // Cash is always open to chipping in; there is nothing else to do with it.
  const isGroupGift = kind === "cash" || formData.get("isGroupGift") === "on";
  const rawGoal = String(formData.get("goal") ?? "").trim();
  const parsedGoal = rawGoal ? parsePriceToCents(rawGoal) : null;
  if (isGroupGift && rawGoal && parsedGoal === null) {
    return { error: "That goal didn't look like a number." };
  }

  await db.insert(items).values({
    listId: list.id,
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

  redirect(manageList(list, ownerHandle));
}
