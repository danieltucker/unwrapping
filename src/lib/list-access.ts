import "server-only";

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { lists, type List } from "@/db/schema";
import { getCurrentUser, readDraftToken } from "@/lib/session";

/**
 * Owner-only access to a list's private screens (editor, share step).
 *
 * A list is reachable either by its signed-in owner or, while it is still an
 * anonymous draft, by the browser holding the draft cookie. Anything else gets
 * a 404 rather than a 403 — a wrong guess shouldn't confirm the list exists.
 */
export async function requireOwnedList(slug: string): Promise<List> {
  const list = await db.select().from(lists).where(eq(lists.slug, slug)).get();
  if (!list) notFound();

  const user = await getCurrentUser();
  if (user && list.ownerId === user.id) return list;

  const draftToken = await readDraftToken();
  if (draftToken && list.draftToken === draftToken) return list;

  notFound();
}
