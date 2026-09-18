"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { users } from "@/db/schema";
import * as routes from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";
import { saveUpload } from "@/lib/uploads";

/**
 * The owner's own details, as opposed to a list's.
 *
 * Both actions answer with a sentence rather than throwing. The page is the
 * one place someone lands after their session has quietly run out, and
 * replacing it with an error screen for what is really "sign in again" helps
 * nobody; see uploadPhoto, which refuses the same way for the same reason.
 *
 * The avatar is revalidated everywhere rather than on this page alone: it is
 * drawn in the header of every page there is.
 */

export type ProfileState = { ok?: boolean; error?: string };

/** Signed out, or signed in long enough ago that the session is gone. */
const SIGNED_OUT =
  "We couldn't confirm who you are — your sign-in may have run out. Reload the page and try again.";

export async function updateProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Tell us your name." };
  if (name.length > 80) return { error: "That name is a little long." };

  /**
   * Stored at local midnight, like a list's event date, so it reads back as
   * the day that was typed rather than the one before it west of Greenwich.
   * See toDateInput, which is the other half of that arrangement.
   */
  const rawBirthday = String(formData.get("birthday") ?? "").trim();
  const birthday = rawBirthday ? new Date(`${rawBirthday}T00:00:00`) : null;
  if (birthday && Number.isNaN(birthday.getTime())) {
    return { error: "That date didn't look right." };
  }
  // A date input can be typed into as well as picked from, and a birthday in
  // the future is a typo every time.
  if (birthday && birthday.getTime() > Date.now()) {
    return { error: "That birthday is in the future." };
  }

  await db.update(users).set({ name, birthday }).where(eq(users.id, user.id));

  revalidatePath(routes.profile);
  // The name is in the account menu, which is on every page.
  revalidatePath("/", "layout");
  return { ok: true };
}

export type AvatarState = { ok?: boolean; error?: string };

/**
 * A photo of the owner, stored the way a gift photo is: written to
 * data/uploads and served by /uploads/<name>.
 *
 * The old file is deliberately left on disk. Nothing else in the product
 * deletes an upload either, and a half-finished delete that takes out a photo
 * a page is still rendering is a worse failure than a spare file.
 */
export async function updateAvatar(
  _previous: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  // Removing the photo comes through the same action: the control that offers
  // it is next to the one that replaces it.
  if (formData.get("remove") === "on") {
    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.id));
    revalidatePath(routes.profile);
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { error: "Choose an image first." };

  const result = await saveUpload(file);
  if ("error" in result) return result;

  await db
    .update(users)
    .set({ avatarUrl: result.url })
    .where(eq(users.id, user.id));

  revalidatePath(routes.profile);
  revalidatePath("/", "layout");
  return { ok: true };
}
