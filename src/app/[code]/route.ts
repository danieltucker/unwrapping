import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { lists, users } from "@/db/schema";
import { viewerOwns } from "@/lib/list-access";
import { origin } from "@/lib/origin";
import { publicList } from "@/lib/routes";

/**
 * The short share link: /iZrPjc8 → /lists/daniel/dans-birthday.
 *
 * Redirects rather than serving the list, so there is one canonical URL for
 * link previews and so the reader can see whose list they're opening. It's a
 * temporary redirect because the target moves if the owner changes their
 * handle or the list is renamed.
 */
export async function GET(_request: Request, context: RouteContext<"/[code]">) {
  const { code } = await context.params;

  const row = await db
    .select({ list: lists, handle: users.handle })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(eq(lists.shortCode, code))
    .get();

  if (!row) return new Response("Not found", { status: 404 });

  // The one number the owner gets about their guests, and the only place it is
  // counted: an open of the link they actually shared. Their own visits don't
  // count, or the figure would mostly be them. It is a total and nothing else:
  // never who opened it, never when, never which gift they went on to claim.
  if (!(await viewerOwns({ list: row.list, ownerHandle: row.handle }))) {
    await db
      .update(lists)
      .set({
        linkOpens: sql`${lists.linkOpens} + 1`,
        // First time anyone but the owner opened it is when the list went live.
        sharedAt: row.list.sharedAt ?? new Date(),
      })
      .where(eq(lists.id, row.list.id));
  }

  return Response.redirect(
    new URL(publicList(row.list, row.handle), origin),
    307,
  );
}
