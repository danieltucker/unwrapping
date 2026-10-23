import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { items, lists, users, type List } from "@/db/schema";

export type AdminListRow = {
  list: List;
  ownerHandle: string | null;
  ownerName: string | null;
  ownerBanned: boolean;
  giftCount: number;
};

/**
 * Every list with its owner and gift count, newest first. The Lists tab draws
 * it, and the Accounts tab counts what each account stands to lose from it, so
 * the two tabs can't end up disagreeing about the same list. (A correlated
 * subquery per account would also be wrong — see the note in
 * `src/app/lists/page.tsx` on how Drizzle renders one.)
 *
 * Left-joined rather than inner: a list with no owner is an unclaimed draft,
 * and those are most of what accumulates on an instance people try out and
 * walk away from.
 */
export async function allListRows(): Promise<AdminListRow[]> {
  return db
    .select({
      list: lists,
      ownerHandle: users.handle,
      ownerName: users.name,
      ownerBanned: sql<boolean>`${users.bannedAt} is not null`.mapWith(Boolean),
      giftCount: sql<number>`(select count(*) from ${items} where ${items.listId} = ${lists.id})`,
    })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.ownerId))
    .orderBy(desc(lists.createdAt))
    .all();
}
