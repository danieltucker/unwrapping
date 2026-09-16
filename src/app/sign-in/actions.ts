"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { lists, users } from "@/db/schema";
import { manageList } from "@/lib/routes";
import { verifyPassword } from "@/lib/password";
import { linkGuestClaimsToUser } from "@/lib/reservations";
import {
  createSession,
  destroySession,
  readDraftToken,
  readGuestToken,
} from "@/lib/session";

export type SignInState = { error?: string };

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.select().from(users).where(eq(users.email, email)).get();

  // Same message either way: a different one would confirm which emails have
  // accounts. The hash comparison still runs so timing doesn't leak it either.
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "scrypt$32768$8$1$AAAA$AAAA");

  if (!user || !valid) return { error: "That email and password don't match." };

  // Anything reserved in this browser joins the account as well.
  const guestToken = await readGuestToken();
  if (guestToken) await linkGuestClaimsToUser(guestToken, user.id);

  const draftToken = await readDraftToken();
  if (draftToken) {
    // Anything started anonymously in this browser joins the account.
    await db
      .update(lists)
      .set({ ownerId: user.id, draftToken: null })
      .where(eq(lists.draftToken, draftToken));
  }

  await createSession(user.id);

  const firstList = await db
    .select({ slug: lists.slug, shortCode: lists.shortCode })
    .from(lists)
    .where(eq(lists.ownerId, user.id))
    .get();

  redirect(firstList ? manageList(firstList, user.handle) : "/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}
