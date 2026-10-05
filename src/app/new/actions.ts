"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { site } from "@/config/site";
import { db } from "@/db";
import { items, lists, type ClaimRule } from "@/db/schema";
import { parseClaimRule } from "@/lib/claim-rules";
import { uniqueShortCode } from "@/lib/handle";
import { manageList, shareList } from "@/lib/routes";
import { normalizeUrl, scrapeProduct } from "@/lib/scrape";
import { ensureDraftToken } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";
import { uniqueSlug } from "@/lib/slug";

export type CreateListState = { error?: string };

type NewList = {
  name: string;
  emoji: string;
  eventDate: Date | null;
  note: string | null;
  claimRule: ClaimRule;
  surpriseMode: boolean;
};

/**
 * Creates a list for whoever is asking: their account if they are signed in,
 * otherwise an anonymous draft tied to this browser. Server Actions only; a
 * draft sets a cookie.
 */
async function insertList(values: NewList) {
  const slug = await uniqueSlug(values.name, async (candidate) => {
    const row = await db
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.slug, candidate))
      .get();
    return Boolean(row);
  });

  // The list can exist before the owner does; sign-up is deferred until there
  // is something to lose. An anonymous draft is tied to a cookie until then.
  const user = await getCurrentUser();
  const draftToken = user ? null : await ensureDraftToken();

  // Every list gets a short share code at birth, so there is always something
  // to paste into a message, including drafts with no owner in their URL yet.
  const shortCode = await uniqueShortCode(async (candidate) => {
    const row = await db
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.shortCode, candidate))
      .get();
    return Boolean(row);
  });

  const created = await db
    .insert(lists)
    .values({
      ownerId: user?.id ?? null,
      draftToken,
      slug,
      shortCode,
      ...values,
    })
    .returning({ id: lists.id, slug: lists.slug, shortCode: lists.shortCode })
    .get();

  // A draft has no handle yet, so its URLs use the short code instead.
  return { list: created, ownerHandle: user?.handle ?? null };
}

export async function createList(
  _previous: CreateListState,
  formData: FormData,
): Promise<CreateListState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give your list a name." };
  if (name.length > 80) return { error: "That name is a little long." };

  const rawDate = String(formData.get("eventDate") ?? "").trim();
  const eventDate = rawDate ? new Date(`${rawDate}T00:00:00`) : null;
  if (eventDate && Number.isNaN(eventDate.getTime())) {
    return { error: "That date didn't look right." };
  }

  const { list, ownerHandle } = await insertList({
    name,
    emoji: String(formData.get("emoji") ?? "🎁"),
    eventDate,
    note: String(formData.get("note") ?? "").trim() || null,
    claimRule: parseClaimRule(formData.get("claimRule")),
    // Offered at creation and editable later; a wedding registry usually
    // wants the couple to see what has been taken.
    surpriseMode: formData.get("surpriseMode") === "on",
  });

  // redirect() throws a control-flow exception, so it must sit outside try/catch.
  redirect(shareList(list, ownerHandle));
}

/** The name a list started from a link gets until its owner gives it a real one. */
const STARTER_NAME = "My wishlist";

/** `value` is handed back so a rejected entry stays in the box to be fixed. */
export type StartFromGiftState = { error?: string; value?: string };

/** Longer than any real gift name; anything past it is a paste gone wrong. */
const MAX_GIFT_NAME = 200;

/**
 * The landing page's shortcut: the first thing you want becomes a list with
 * that gift already on it, so the first thing a visitor sees in the editor is
 * their own present rather than an empty form.
 *
 * The box takes either a link or the name of a thing. Anything normalizeUrl
 * accepts is read from the shop; everything else is written in by hand, the
 * same as a gift added without a link. A name is not a failed link: "good olive
 * oil" is a perfectly good first gift.
 *
 * Everything /new asks for up front (name, date, who can claim) has a sensible
 * default and is editable from the list's settings, so none of it is asked
 * here. The editor says as much when it opens; see DraftBanner.
 */
export async function startFromGift(
  _previous: StartFromGiftState,
  formData: FormData,
): Promise<StartFromGiftState> {
  const entered = String(formData.get("gift") ?? "").trim();
  if (!entered) {
    return { error: "Paste a link, or type the name of something you'd like." };
  }

  const isLink = normalizeUrl(entered) !== null;
  if (!isLink && entered.length > MAX_GIFT_NAME) {
    return { error: "That's a little long for a gift name.", value: entered };
  }

  // Before the list exists, so a slow shop doesn't leave an empty list behind
  // if the visitor gives up and closes the tab.
  const result = isLink ? await scrapeProduct(entered) : null;

  const { list, ownerHandle } = await insertList({
    name: STARTER_NAME,
    emoji: "🎁",
    eventDate: null,
    note: null,
    claimRule: "anonymous",
    // Same default as the column: a wishlist is a surprise unless told otherwise.
    surpriseMode: true,
  });

  if (result) {
    // A shop that blocked us still leaves a link worth keeping; the title is
    // the one field a gift can't go without, so it falls back to where it's from.
    const title =
      result.title ??
      (result.sourceDomain ? `Something from ${result.sourceDomain}` : "My first gift");

    await db.insert(items).values({
      listId: list.id,
      position: 0,
      kind: "thing",
      title,
      url: result.url || null,
      sourceDomain: result.sourceDomain,
      images: result.images,
      selectedImageIndex: 0,
      priceCents: result.priceCents,
      currency: (result.currency ?? site.currency).toUpperCase(),
      needsAttention: result.images.length === 0 ? "no-photo" : null,
    });
  } else {
    // A hand-written gift stands in with an emoji, which counts as a choice
    // rather than a missing photo, so it isn't flagged in the editor.
    await db.insert(items).values({
      listId: list.id,
      position: 0,
      kind: "thing",
      title: entered,
      images: [],
      selectedImageIndex: 0,
      emoji: "🎁",
      currency: site.currency.toUpperCase(),
    });
  }

  // `partial` when the page only half answered, so the editor can say which
  // bits to check rather than leaving a guessed title looking finished.
  const started = !result
    ? "name"
    : result.error !== null || result.title === null
      ? "partial"
      : "link";
  redirect(`${manageList(list, ownerHandle)}?started=${started}`);
}
