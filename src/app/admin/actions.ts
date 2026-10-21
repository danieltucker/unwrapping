"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  categories,
  items,
  lists,
  santaMessages,
  santaReports,
  sessions,
  users,
} from "@/db/schema";
import { adminOrNull, isAdmin, isAdminEmail } from "@/lib/admin";
import { priceCheckState, runPriceChecks } from "@/lib/price-checks";
import * as routes from "@/lib/routes";
import { slugify } from "@/lib/slug";
import { deleteUpload } from "@/lib/uploads";

/**
 * The three things the operator's screen can remove — an account, a list, and a
 * photo on disk — the one thing it curates, the categories on /gifts, and who
 * among the accounts is an administrator or banned.
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


/**
 * Makes an account an administrator, or stops it being one.
 *
 * The people in ADMIN_EMAILS can't be changed from here — they are the
 * operator's own say-so, and the screen leaving them alone is what guarantees
 * somebody can always get back in. Nor can you demote yourself: one mis-click
 * would put you on the 404 with nobody to ask.
 */
export async function setAdmin(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const userId = String(formData.get("userId") ?? "");
  const grant = formData.get("grant") === "on";

  const user = userId
    ? await db
        .select({ name: users.name, email: users.email, bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, userId))
        .get()
    : null;
  if (!user) return { error: "That account is already gone." };

  if (isAdminEmail(user.email)) {
    return { error: "They're named in ADMIN_EMAILS. Change that on the server instead." };
  }
  if (!grant && userId === admin.id) {
    return { error: "You can't remove your own admin access." };
  }
  if (grant && user.bannedAt) {
    return { error: "Lift their ban first." };
  }

  await db.update(users).set({ isAdmin: grant }).where(eq(users.id, userId));

  revalidatePath(routes.admin);
  // The Admin link in their header.
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: grant ? `${user.name} is now an admin.` : `${user.name} is no longer an admin.`,
  };
}

/**
 * Bans an account, or lifts the ban.
 *
 * Nothing is deleted, which is the difference from deleting the account: they
 * are signed out everywhere and can't sign back in, and their lists answer 404
 * and leave /gifts, but all of it returns when the ban is lifted. Reservations
 * they made on other people's lists are left alone; those belong to the list's
 * owner as much as to them.
 *
 * Admins can't be banned — remove their admin access first — so nobody can ban
 * the person who is about to unban them.
 */
export async function setBanned(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const userId = String(formData.get("userId") ?? "");
  const ban = formData.get("ban") === "on";

  const user = userId
    ? await db
        .select({ name: users.name, email: users.email, isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .get()
    : null;
  if (!user) return { error: "That account is already gone." };

  if (ban) {
    if (userId === admin.id) return { error: "You can't ban yourself." };
    if (isAdmin(user)) {
      return {
        error: isAdminEmail(user.email)
          ? "They're named in ADMIN_EMAILS, so they can't be banned from here."
          : "Remove their admin access before banning them.",
      };
    }

    await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
  } else {
    await db.update(users).set({ bannedAt: null }).where(eq(users.id, userId));
  }

  revalidatePath(routes.admin);
  // Every list of theirs either just vanished or just came back.
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: ban ? `Banned ${user.name}.` : `Lifted ${user.name}'s ban.`,
  };
}

/** Sub-paths of /gifts that a category slug must not shadow. */
const RESERVED_CATEGORY_SLUGS = new Set(["new"]);

/**
 * Creates a category on /gifts, or edits one when an id is posted.
 *
 * The slug is the category's URL, so it is kept when the name changes unless
 * the operator types a new one; links to /gifts/outdoors in the wild should
 * not break because "Outdoors" became "The great outdoors".
 */
export async function saveCategory(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "A category needs a name." };
  if (name.length > 40) return { error: "That name is a little long for a shelf." };

  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 300) return { error: "Keep the description under 300 characters." };

  // An emoji can be several code points; anything longer isn't one.
  const emoji = String(formData.get("emoji") ?? "").trim().slice(0, 8) || "🎁";

  const typedSlug = String(formData.get("slug") ?? "").trim();
  const existing = id
    ? await db.select().from(categories).where(eq(categories.id, id)).get()
    : null;
  if (id && !existing) return { error: "That category is already gone." };

  const slug = typedSlug ? slugify(typedSlug) : (existing?.slug ?? slugify(name));
  if (RESERVED_CATEGORY_SLUGS.has(slug)) {
    return { error: `/gifts/${slug} is taken by the site itself. Pick another slug.` };
  }

  const clash = await db
    .select({ name: categories.name })
    .from(categories)
    .where(id ? and(eq(categories.slug, slug), ne(categories.id, id)) : eq(categories.slug, slug))
    .get();
  if (clash) return { error: `“${clash.name}” already uses /gifts/${slug}.` };

  if (existing) {
    await db
      .update(categories)
      .set({ name, slug, description, emoji })
      .where(eq(categories.id, existing.id));
  } else {
    await db.insert(categories).values({ name, slug, description, emoji });
  }

  revalidatePath(routes.admin);
  revalidatePath(routes.giftGuides, "layout");
  revalidatePath("/");
  return { ok: true, message: existing ? `Saved “${name}”.` : `Added “${name}”.` };
}

/**
 * Removes a category. The guides on it are kept — they belong to the people
 * who wrote them — and drop to "More gift lists" on /gifts until their owners
 * pick another shelf.
 */
export async function deleteCategory(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const id = String(formData.get("categoryId") ?? "");
  const category = id
    ? await db.select().from(categories).where(eq(categories.id, id)).get()
    : null;
  if (!category) return { error: "That category is already gone." };

  // lists.categoryId is `set null`, so the guides on it simply lose their shelf.
  await db.delete(categories).where(eq(categories.id, id));

  revalidatePath(routes.admin);
  revalidatePath(routes.giftGuides, "layout");
  revalidatePath("/");
  return { ok: true, message: `Deleted “${category.name}”.` };
}

/**
 * Starts a batch of price and link checks now rather than waiting for the
 * hourly one. Answers straight away: the batch pauses between shops, so it
 * runs on in the background and the screen reports it on the next load.
 */
export async function checkLinksNow(): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  if (priceCheckState().running) {
    return { error: "A check is already running. Reload in a minute to see what it found." };
  }

  runPriceChecks(10).catch((error) => console.error("[price-checks] manual batch failed:", error));
  return {
    ok: true,
    message: "Checking up to 10 due links in the background. Reload in a minute to see what it found.",
  };
}

/** A reported Secret Santa message that turned out to be fine. */
export async function dismissReport(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  await db
    .update(santaReports)
    .set({ resolvedAt: new Date() })
    .where(eq(santaReports.id, String(formData.get("reportId") ?? "")));

  revalidatePath(routes.admin);
  return { ok: true, message: "Dismissed." };
}

/**
 * Takes a reported message out of its thread. The row stays, marked removed,
 * so both sides see that something was taken down rather than a gap; every
 * report on it is closed with it.
 */
export async function removeReportedMessage(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await adminOrNull();
  if (!admin) return { error: NOT_ADMIN };

  const messageId = String(formData.get("messageId") ?? "");
  const now = new Date();
  db.transaction((tx) => {
    tx.update(santaMessages).set({ removedAt: now }).where(eq(santaMessages.id, messageId)).run();
    tx.update(santaReports)
      .set({ resolvedAt: now })
      .where(and(eq(santaReports.messageId, messageId), isNull(santaReports.resolvedAt)))
      .run();
  });

  revalidatePath(routes.admin);
  return { ok: true, message: "Removed from the thread." };
}
