import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { items, lists, users } from "@/db/schema";
import { outboundHref } from "@/lib/outbound";
import { GO_PLACEMENTS, GO_SOURCES } from "@/lib/tracking-flag";
import { recordServerEvent } from "@/lib/tracking";

/**
 * Every buy button while tracking is on: /go/<itemId>, which counts the click
 * and sends the visitor on to the shop. See buyLink in src/lib/tracking-flag.ts.
 *
 * An ordinary link and an ordinary redirect, so it works with JavaScript off,
 * from a screen reader, opened in a new tab, or long-pressed and copied.
 *
 * Not an open redirect: the only place it can send anybody is the link stored
 * on that gift, tagged by outboundHref exactly as the page would have tagged
 * it. A guide's links have any pasted tag replaced with ours, a wishlist's
 * keep a friend's; see outboundHref.
 *
 * Works whether or not tracking is on, and whatever the pause switch says, so
 * a link that was copied while it was on keeps going to the shop.
 */
export async function GET(request: Request, context: RouteContext<"/go/[itemId]">) {
  const { itemId } = await context.params;
  const found = await destination(itemId);
  if (!found) return notFound();

  const params = new URL(request.url).searchParams;
  const properties: Record<string, string> = {};
  const from = params.get("from");
  const at = params.get("at");
  if (from && (GO_SOURCES as readonly string[]).includes(from)) properties.from = from;
  if (at && (GO_PLACEMENTS as readonly string[]).includes(at)) properties.at = at;

  await recordServerEvent({
    type: "outbound_click",
    list: found.list,
    item: found.item,
    properties,
  });

  return redirect(found.href);
}

/**
 * Link checkers and unfurlers ask with HEAD to see where a link goes. They are
 * told, and nothing is counted: nobody clicked anything.
 */
export async function HEAD(_request: Request, context: RouteContext<"/go/[itemId]">) {
  const { itemId } = await context.params;
  const found = await destination(itemId);
  return found ? redirect(found.href) : notFound();
}

async function destination(itemId: string) {
  const row = await db
    .select({
      item: { id: items.id, kind: items.kind, parentId: items.parentId, url: items.url },
      list: { id: lists.id, kind: lists.kind, ownerId: lists.ownerId, draftToken: lists.draftToken },
      ownerBanned: sql<boolean>`${users.bannedAt} is not null`.mapWith(Boolean),
    })
    .from(items)
    .innerJoin(lists, eq(lists.id, items.listId))
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(eq(items.id, itemId))
    .get();

  // A banned owner's lists answer 404 to everyone, and so do their links.
  if (!row || row.ownerBanned) return null;

  const href = outboundHref(row.item.url, "web", { replaceTags: row.list.kind === "guide" });
  if (!href) return null;

  return { href, list: row.list, item: row.item };
}

function redirect(href: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: href,
      // Each click is its own visit; nothing in between may remember it.
      "cache-control": "no-store",
      // The shop learns it came from a link, not which list it was on. The
      // buttons say noreferrer as well; this covers a link opened any other way.
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
