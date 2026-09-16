"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { items } from "@/db/schema";
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

  const url = String(formData.get("url") ?? "").trim() || null;

  const rawPrice = String(formData.get("price") ?? "").trim();
  const priceCents = rawPrice ? parsePriceToCents(rawPrice) : null;
  if (rawPrice && priceCents === null) {
    return { error: "That price didn't look like a number." };
  }

  const quantity = Math.min(
    Math.max(Number.parseInt(String(formData.get("quantity") ?? "1"), 10) || 1, 1),
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

  const isGroupGift = formData.get("isGroupGift") === "on";

  await db.insert(items).values({
    listId: list.id,
    position: (last?.max ?? -1) + 1,
    title,
    url,
    sourceDomain: sourceDomain(url),
    images,
    selectedImageIndex,
    priceCents,
    currency: String(formData.get("currency") ?? "USD").toUpperCase(),
    quantity,
    reason: String(formData.get("reason") ?? "").trim() || null,
    isMostWanted: formData.get("isMostWanted") === "on",
    isGroupGift,
    // The goal for a group gift is the item's price until a separate goal is set.
    goalCents: isGroupGift ? priceCents : null,
    // Items with no photo get flagged so the editor can nudge about it.
    needsAttention: images.length === 0 ? "no-photo" : null,
  });

  redirect(manageList(list, ownerHandle));
}
