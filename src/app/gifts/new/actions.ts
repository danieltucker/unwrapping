"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { insertList } from "@/lib/create-list";
import { manageList, signIn } from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";

export type CreateGuideState = { error?: string };

/**
 * Starts a gift guide: a list for nobody in particular, to be published on
 * /gifts. See LIST_KINDS.
 *
 * Unlike a wishlist this needs an account first. A guide is going on a public
 * page with somebody's name on it, and a draft held by one browser's cookie
 * has no name to put there and nobody to answer for it.
 *
 * It starts unpublished, so it can be filled in before anyone browsing sees
 * it; the editor is where it goes live.
 */
export async function createGiftGuide(
  _previous: CreateGuideState,
  formData: FormData,
): Promise<CreateGuideState> {
  const user = await getCurrentUser();
  if (!user) redirect(signIn);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give your gift list a name." };
  if (name.length > 80) return { error: "That name is a little long." };

  // Checked rather than trusted: a category id is a string in a form body.
  const postedCategory = String(formData.get("categoryId") ?? "");
  const category = postedCategory
    ? await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, postedCategory))
        .get()
    : null;

  const { list, ownerHandle } = await insertList({
    name,
    emoji: String(formData.get("emoji") ?? "🎁").slice(0, 8) || "🎁",
    eventDate: null,
    note: String(formData.get("note") ?? "").trim() || null,
    // Nothing on a guide is ever claimed, so these are never read; they are
    // the columns' own defaults, written out so the row says so.
    claimRule: "anonymous",
    surpriseMode: true,
    kind: "guide",
    categoryId: category?.id ?? null,
  });

  // redirect() throws a control-flow exception, so it must sit outside try/catch.
  redirect(manageList(list, ownerHandle));
}
