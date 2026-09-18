"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { items, lists, users } from "@/db/schema";
import { adminOrNull } from "@/lib/admin";
import * as routes from "@/lib/routes";
import { deleteUpload } from "@/lib/uploads";

/**
 * The three things the operator's screen can remove: an account, a list, and a
 * photo on disk.
 *
 * Every one of them re-checks who is asking. A Server Action is reachable by a
 * POST from anywhere, not only from the page that renders the button, so the
 * gate on the page protects nothing on its own.
 *
 * They answer with a sentence rather than throwing, like the rest of the
 * product's actions: the usual way to fail the check here is an ordinary
 * expired sign-in on a screen that has been open a while, and an error page is
 * a poor way to say "sign in again".
 */

export type AdminState = { ok?: boolean; error?: string; message?: string };

const NOT_ADMIN =
  "We couldn't confirm you're an administrator — your sign-in may have run out. Reload the page and try again.";

/**
 * Deleting is the point of this screen, so the confirmation is the only guard
 * there is. Anything irreversible says so on the button.
 */
export async function deleteAccount(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "No account was named." };

  /**
   * An administrator deleting themselves would take their own session with it
   * and leave the screen they are standing on, so this is refused rather than
   * confirmed twice. Removing an operator's own account is a thing to do from
   * outside the app, deliberately.
   */
  if (userId === admin.id) {
    return { error: "You can't delete the account you're signed in as." };
  }

  const user = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) return { error: "That account is already gone." };

  /**
   * Their lists, gifts, claims on those gifts and sessions all go with the row:
   * every one of those foreign keys cascades, and `foreign_keys` is on — see
   * src/db/index.ts. What they reserved on *other* people's lists does not; a
   * claim's userId is `set null`, so the reservation survives as the guest
   * cookie's, and the list's owner still can't see who made it.
   *
   * Photos they uploaded stay on disk. Nothing in the product has ever deleted
   * an upload, and they now show up in the Photos section below as belonging to
   * nothing, which is where they can be swept up deliberately.
   */
  await db.delete(users).where(eq(users.id, userId));

  revalidatePath(routes.admin);
  // Their lists went with them, and any page that linked to one.
  revalidatePath("/", "layout");
  return { ok: true, message: `Deleted ${user.name}'s account.` };
}

export async function deleteList(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const listId = String(formData.get("listId") ?? "");
  if (!listId) return { error: "No list was named." };

  const row = await db
    .select({ list: lists, ownerHandle: users.handle })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(eq(lists.id, listId))
    .get();

  if (!row) return { error: "That list is already gone." };

  // Gifts, and the claims and contributions on them, cascade from the list.
  await db.delete(lists).where(eq(lists.id, listId));

  revalidatePath(routes.admin);
  // The URLs that just stopped existing, so a cached copy doesn't outlive them.
  revalidatePath(routes.publicList(row.list, row.ownerHandle));
  revalidatePath(routes.manageList(row.list, row.ownerHandle));
  return { ok: true, message: `Deleted “${row.list.name}”.` };
}

/**
 * Removes a photo from disk, and from anything that was drawing it.
 *
 * The file is the last thing to go. A gift still pointing at a deleted file
 * renders a broken image on a page shared with strangers, so the references are
 * cleared first — and if the unlink then fails, the worst case is a spare file
 * nothing uses, which this screen will offer again.
 */
export async function deleteImage(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const name = String(formData.get("name") ?? "");
  if (!name) return { error: "No photo was named." };

  const url = `/uploads/${name}`;

  /**
   * Read and rewritten in TypeScript rather than in SQL: `images` is a JSON
   * array in a text column, and removing one element of it means knowing which
   * index it was — the selected photo is stored as a position into this array,
   * so dropping an earlier one has to move it.
   */
  const affected = await db
    .select({
      id: items.id,
      images: items.images,
      selectedImageIndex: items.selectedImageIndex,
      emoji: items.emoji,
      kind: items.kind,
    })
    .from(items)
    .all();

  for (const item of affected) {
    const index = item.images.indexOf(url);
    if (index === -1) continue;

    const images = item.images.filter((candidate) => candidate !== url);
    // Keep pointing at the same photo where it survived; step back where the
    // deleted one was in front of it, and clamp when it was the last one.
    const selected =
      index < item.selectedImageIndex
        ? item.selectedImageIndex - 1
        : Math.min(item.selectedImageIndex, Math.max(images.length - 1, 0));

    await db
      .update(items)
      .set({
        images,
        selectedImageIndex: selected,
        // The amber row in the owner's editor, set the same way updateItem
        // sets it: a present with no photo and no emoji needs their attention.
        needsAttention:
          item.kind === "thing" && images.length === 0 && !item.emoji
            ? "no-photo"
            : null,
      })
      .where(eq(items.id, item.id));
  }

  // Somebody's avatar, which is drawn in the header of every page they load.
  await db.update(users).set({ avatarUrl: null }).where(eq(users.avatarUrl, url));

  if (!(await deleteUpload(name))) {
    return { error: "We couldn't delete that file. Check the server log." };
  }

  revalidatePath(routes.admin);
  // A photo can appear on any list and in any header.
  revalidatePath("/", "layout");
  return { ok: true, message: "Deleted that photo." };
}

