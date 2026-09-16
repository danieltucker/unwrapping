import "server-only";

import { eq, or, type AnyColumn, type SQL } from "drizzle-orm";

import { getCurrentUser, readGuestToken } from "@/lib/session";

/**
 * Restricts a query to the rows belonging to whoever is asking.
 *
 * Someone with no account is known by a cookie. Once they sign up or sign in,
 * their rows are stamped with a userId as well, so what they've done follows
 * the person rather than the browser.
 *
 * Returns null when this visitor has neither identity. A caller must read that
 * as "they have nothing" and skip the query — never as "no filter".
 */
export async function viewerScope(
  guestTokenColumn: AnyColumn,
  userIdColumn: AnyColumn,
): Promise<SQL | null> {
  const [guestToken, user] = await Promise.all([readGuestToken(), getCurrentUser()]);

  const conditions: SQL[] = [];
  if (guestToken) conditions.push(eq(guestTokenColumn, guestToken));
  if (user) conditions.push(eq(userIdColumn, user.id));

  if (conditions.length === 0) return null;
  return conditions.length === 1 ? conditions[0] : or(...conditions)!;
}
