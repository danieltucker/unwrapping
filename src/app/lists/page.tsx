import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { items, lists } from "@/db/schema";
import { relativeEvent } from "@/lib/date";
import * as routes from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "My lists" };

export default async function MyListsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn);

  const rows = await db
    .select({
      list: lists,
      /**
       * The outer column is written out in full rather than interpolated.
       *
       * Drizzle leaves column names unqualified when the query selects from a
       * single table, which is true of this one — so `${lists.id}` renders as
       * bare `"id"`, and inside the subquery that resolves against `items`
       * instead. The comparison then reads `items.list_id = items.id`, which is
       * never true, and every list reported zero gifts. A join would qualify it,
       * but there is nothing here to join to.
       */
      giftCount: sql<number>`(select count(*) from ${items} where ${items.listId} = "lists"."id")`,
    })
    .from(lists)
    .where(eq(lists.ownerId, user.id))
    .orderBy(desc(lists.createdAt))
    .all();

  return (
    <main className="mx-auto w-full max-w-[52rem] px-[1.375rem] py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em]">
          My lists
        </h1>
        <Link
          href={routes.newList}
          className="rounded-pill bg-violet px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
        >
          + New list
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center text-sm text-ink-72">
          You haven&rsquo;t made a list yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map(({ list, giftCount }) => (
            <li key={list.id}>
              <Link
                href={routes.manageList(list, user.handle)}
                className="flex items-center gap-4 rounded-card border border-ink-line bg-surface px-5 py-4 transition-colors duration-150 hover:bg-ink/[.02]"
              >
                <span className="text-xl">{list.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{list.name}</span>
                  <span className="block text-xs text-ink-72">
                    {giftCount} {giftCount === 1 ? "gift" : "gifts"}
                    {list.eventDate ? ` · ${relativeEvent(list.eventDate)}` : ""}
                  </span>
                </span>
                <span className="text-xs font-semibold text-violet">Manage →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
