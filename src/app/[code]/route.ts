import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lists, users } from "@/db/schema";
import { publicList } from "@/lib/routes";

/**
 * The short share link: /iZrPjc8 → /lists/daniel/dans-birthday.
 *
 * Redirects rather than serving the list, so there is one canonical URL for
 * link previews and so the reader can see whose list they're opening. It's a
 * temporary redirect because the target moves if the owner changes their
 * handle or the list is renamed.
 */
export async function GET(request: Request, context: RouteContext<"/[code]">) {
  const { code } = await context.params;

  const row = await db
    .select({ list: lists, handle: users.handle })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(eq(lists.shortCode, code))
    .get();

  if (!row) return new Response("Not found", { status: 404 });

  return Response.redirect(
    new URL(publicList(row.list, row.handle), request.url),
    307,
  );
}
