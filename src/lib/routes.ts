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

/**
 * Gift guides: lists for nobody in particular, browsed by category. A guide
 * itself still lives at /lists/<handle>/<slug> like any list; these are the
 * shelves it sits on.
 */
export const giftGuides = "/gifts";
export const newGiftGuide = "/gifts/new";
export function giftCategory(slug: string): string {
  return `/gifts/${slug}`;
}

/**
 * Secret Santa. An exchange is addressed by its code, and the bare
 * /secret-santa/<code> is the invite link the organiser shares.
 */
export const secretSanta = "/secret-santa";
export const newSecretSanta = "/secret-santa/new";
export function santaInvite(code: string): string {
  return `/secret-santa/${code}`;
}
export function santaManage(code: string): string {
  return `/secret-santa/${code}/manage`;
}
/** A participant's own page, once their browser knows who they are. */
export function santaMine(code: string): string {
  return `/secret-santa/${code}/me`;
}
/** The private link: sets the cookie, then lands on santaMine. */
export function santaPrivateLink(token: string): string {
  return `/secret-santa/p/${token}`;
}

export const signIn = "/sign-in";
export const signUp = "/sign-up";
export const newList = "/new";
export const myLists = "/lists";
export const reserved = "/reserved";
export const profile = "/profile";

/**
 * The operator's screen: every account, list and photo on this instance.
 * Reachable only by administrators; see `src/lib/admin.ts`.
 */
export const admin = "/admin";
/** Its tabs. `/admin` itself sends you to the first. */
export const adminAnalytics = "/admin/analytics";
export const adminAccounts = "/admin/accounts";
export const adminLists = "/admin/lists";
