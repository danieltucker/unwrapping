"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { CLAIM_RULES, lists, type ClaimRule } from "@/db/schema";
import { uniqueShortCode } from "@/lib/handle";
import { shareList } from "@/lib/routes";
import { ensureDraftToken } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";
import { uniqueSlug } from "@/lib/slug";

export type CreateListState = { error?: string };

function parseClaimRule(value: FormDataEntryValue | null): ClaimRule {
  const candidate = String(value ?? "");
  return (CLAIM_RULES as readonly string[]).includes(candidate)
    ? (candidate as ClaimRule)
    : "anonymous";
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

  const slug = await uniqueSlug(name, async (candidate) => {
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
  // to paste into a message — including drafts with no owner in their URL yet.
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
    name,
    emoji: String(formData.get("emoji") ?? "🎁"),
    eventDate,
    note: String(formData.get("note") ?? "").trim() || null,
      claimRule: parseClaimRule(formData.get("claimRule")),
    })
    .returning({ slug: lists.slug, shortCode: lists.shortCode })
    .get();

  // redirect() throws a control-flow exception, so it must sit outside try/catch.
  // A draft has no handle yet, so this lands on its short-code URL.
  redirect(shareList(created, user?.handle ?? null));
}
