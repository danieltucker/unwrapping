import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lists, type ClaimRule, type ListKind } from "@/db/schema";
import { uniqueShortCode } from "@/lib/handle";
import { ensureDraftToken, getCurrentUser } from "@/lib/session";
import { uniqueSlug } from "@/lib/slug";

export type NewList = {
  name: string;
  emoji: string;
  eventDate: Date | null;
  note: string | null;
  claimRule: ClaimRule;
  surpriseMode: boolean;
  /** Set only when a whole list is copied; see lists.copiedFromListId. */
  copiedFromListId?: string | null;
  /** "guide" only from createGiftGuide, which has already required an account. */
  kind?: ListKind;
  categoryId?: string | null;
};

/**
 * Creates a list for whoever is asking: their account if they are signed in,
 * otherwise an anonymous draft tied to this browser. Server Actions only; a
 * draft sets a cookie.
 *
 * Every way a list is born comes through here — /new, /gifts/new, the
 * homepage's first gift, and copying someone else's — so they all get a slug
 * and a short code the same way.
 */
export async function insertList(values: NewList) {
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
