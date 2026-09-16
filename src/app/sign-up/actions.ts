"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { lists, users } from "@/db/schema";
import { uniqueHandle } from "@/lib/handle";
import { hashPassword } from "@/lib/password";
import { manageList } from "@/lib/routes";
import { linkGuestClaimsToUser } from "@/lib/reservations";
import { createSession, readDraftToken, readGuestToken } from "@/lib/session";

export type SignUpState = { error?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export async function signUp(
  _previous: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "Tell us your name." };
  if (!EMAIL.test(email)) return { error: "That email doesn't look right." };
  if (password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters for your password.` };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (existing) {
    return { error: "There's already an account with that email. Sign in instead." };
  }

  const handle = await uniqueHandle(name, async (candidate) => {
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, candidate))
      .get();
    return Boolean(row);
  });

  const user = await db
    .insert(users)
    .values({ handle, name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id })
    .get();

  // The whole point of deferring sign-up: whatever they built anonymously
  // becomes theirs the moment the account exists.
  // Reservations made in this browser become theirs too, so the sign-up
  // prompt on /reserved tells the truth.
  const guestToken = await readGuestToken();
  if (guestToken) await linkGuestClaimsToUser(guestToken, user.id);

  const draftToken = await readDraftToken();
  let firstClaimed: { slug: string; shortCode: string | null } | null = null;

  if (draftToken) {
    const drafts = await db
      .select()
      .from(lists)
      .where(eq(lists.draftToken, draftToken))
      .all();

    for (const draft of drafts) {
      await db
        .update(lists)
        .set({ ownerId: user.id, draftToken: null })
        .where(eq(lists.id, draft.id));
      firstClaimed ??= { slug: draft.slug, shortCode: draft.shortCode };
    }
  }

  await createSession(user.id);

  // The list now lives under the new handle: /lists/<handle>/<slug>/manage
  redirect(firstClaimed ? manageList(firstClaimed, handle) : "/");
}
