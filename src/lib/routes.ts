/**
 * Every internal URL is built here.
 *
 * A list lives at /lists/<handle>/<slug>. An unclaimed draft has no owner and
 * therefore no handle, so it uses the reserved `drafts` segment keyed by its
 * short code, which is globally unique, unlike a draft's slug.
 */

export type ListRef = { slug: string; shortCode: string | null };

/** Reserved so no account can ever claim it as a handle. */
export const DRAFT_SEGMENT = "drafts";

/** The two path segments identifying a list: [handle, key]. */
export function listSegments(
  list: ListRef,
  ownerHandle: string | null,
): [string, string] {
  if (ownerHandle) return [ownerHandle, list.slug];
  return [DRAFT_SEGMENT, list.shortCode ?? list.slug];
}

/** Where a guest sees the list. */
export function publicList(list: ListRef, ownerHandle: string | null): string {
  const [handle, key] = listSegments(list, ownerHandle);
  return `/lists/${handle}/${key}`;
}

/** The short link meant for pasting into a message; redirects to the canonical URL. */
export function shortLink(list: ListRef): string | null {
  return list.shortCode ? `/${list.shortCode}` : null;
}

/** The owner's editor, and the screens hanging off it. */
export function manageList(list: ListRef, ownerHandle: string | null): string {
  return `${publicList(list, ownerHandle)}/manage`;
}

/*
 * Adding and editing a gift have no URLs of their own: both are dialogs over
 * the editor, so the page they act on is the page you are already on. Their
 * server actions still live under manage/add and manage/items/[id]/edit, which
 * is where you would expect to find them; those folders just have no page.
 */

export function shareList(list: ListRef, ownerHandle: string | null): string {
  return `${manageList(list, ownerHandle)}/share`;
}

export const signIn = "/sign-in";
export const signUp = "/sign-up";
export const newList = "/new";
export const myLists = "/lists";
export const reserved = "/reserved";
export const profile = "/profile";
