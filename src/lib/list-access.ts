import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { lists, users, type List } from "@/db/schema";
import { DRAFT_SEGMENT } from "@/lib/routes";
import { getCurrentUser, readDraftToken } from "@/lib/session";

export type ResolvedList = {
  list: List;
  /** Null while the list is an unclaimed draft. */
  ownerHandle: string | null;
};

/**
 * Finds the list behind /lists/<handle>/<key>, without any permission check.
 *
 * For an owned list the key is its slug, unique per owner. For a draft the
 * handle segment is `drafts` and the key is the short code, because draft slugs
 * are not unique; two people can both start "birthday" before signing up.
 */
export async function resolveList(
  handle: string,
  key: string,
): Promise<ResolvedList | null> {
  if (handle === DRAFT_SEGMENT) {
    const list = await db
      .select()
      .from(lists)
      .where(and(eq(lists.shortCode, key), isNull(lists.ownerId)))
      .get();

    return list ? { list, ownerHandle: null } : null;
  }

  const row = await db
    .select({ list: lists, handle: users.handle })
    .from(lists)
    .innerJoin(users, eq(users.id, lists.ownerId))
    .where(and(eq(users.handle, handle), eq(lists.slug, key)))
    .get();

  return row ? { list: row.list, ownerHandle: row.handle } : null;
}

/** True when this viewer owns the list: signed in as the owner, or holding its draft cookie. */
export async function viewerOwns(resolved: ResolvedList): Promise<boolean> {
  const { list } = resolved;

  const user = await getCurrentUser();
  if (user && list.ownerId === user.id) return true;

  if (list.ownerId === null) {
    const draftToken = await readDraftToken();
    return draftToken !== null && list.draftToken === draftToken;
  }

  return false;
}

/**
 * Owner-only access to a list's private screens.
 *
 * A viewer who doesn't own it gets a 404 rather than a 403: a wrong guess
 * shouldn't confirm that the list exists.
 *
 * For *rendering* a page. Inside a Server Action, prefer `ownedListOrNull`:
 * `notFound()` throws, and a throw from an action does not render the 404 page
 * the way it would during a render — it rejects the promise the browser is
 * waiting on, which takes out the whole screen instead of the one control the
 * person was using. See uploadPhoto.
 */
export async function requireOwnedList(
  handle: string,
  key: string,
): Promise<ResolvedList> {
  const resolved = await ownedListOrNull(handle, key);
  if (!resolved) notFound();
  return resolved;
}

/** The same check, for callers that need to answer rather than throw. */
export async function ownedListOrNull(
  handle: string,
  key: string,
): Promise<ResolvedList | null> {
  const resolved = await resolveList(handle, key);
  if (!resolved) return null;
  return (await viewerOwns(resolved)) ? resolved : null;
}
