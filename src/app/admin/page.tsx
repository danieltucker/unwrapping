import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { deleteAccount, deleteImage, deleteList } from "@/app/admin/actions";
import { AdminDelete } from "@/components/admin-delete";
import { Avatar, CapsLabel } from "@/components/ui";
import { db } from "@/db";
import { items, lists, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { displayHost } from "@/lib/origin";
import * as routes from "@/lib/routes";
import { listUploads } from "@/lib/uploads";

export const metadata: Metadata = {
  title: "Admin",
  // Every account on the instance, on one page. Nothing here belongs anywhere
  // near a search index.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Everything on this instance, and the three ways to remove some of it:
 * accounts, lists, and the photos on disk.
 *
 * Reachable only by whoever the operator named in ADMIN_EMAILS — see
 * `src/lib/admin.ts` for why that is an environment variable rather than a
 * column. Nobody else gets a 403; they get the 404 they would get for a list
 * that isn't theirs, because a signed-in stranger shouldn't learn this screen
 * exists.
 *
 * Deliberately one page rather than three. An operator comes here to answer
 * "what is in here, and what is taking up room", and a photo that belongs to
 * nothing is only recognisable next to the lists it isn't on.
 */
export default async function AdminPage() {
  await requireAdmin();

  const [accounts, allLists, uploads, photoOwners, avatarOwners] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).all(),

    // Left-joined rather than inner: a list with no owner is an unclaimed
    // draft, and those are most of what accumulates on an instance people try
    // out and walk away from.
    db
      .select({
        list: lists,
        ownerHandle: users.handle,
        ownerName: users.name,
        giftCount: sql<number>`(select count(*) from ${items} where ${items.listId} = ${lists.id})`,
      })
      .from(lists)
      .leftJoin(users, eq(users.id, lists.ownerId))
      .orderBy(desc(lists.createdAt))
      .all(),

    listUploads(),

    // What each file on disk is actually drawing, so "is this safe to delete"
    // is answered on the page rather than guessed at.
    db
      .select({ title: items.title, images: items.images, listName: lists.name })
      .from(items)
      .innerJoin(lists, eq(lists.id, items.listId))
      .all(),

    db.select({ name: users.name, avatarUrl: users.avatarUrl }).from(users).all(),
  ]);

  /**
   * What each account stands to lose, counted from the lists already in hand
   * rather than by a second query.
   *
   * Two reasons, and the second is the one that matters: the Accounts section
   * and the Lists section below it can't end up disagreeing about the same
   * list. The first is that a correlated subquery here would be wrong — see the
   * note in `src/app/lists/page.tsx` on how Drizzle renders one.
   */
  const owned = new Map<string, { lists: number; gifts: number }>();
  for (const { list, giftCount } of allLists) {
    if (!list.ownerId) continue;
    const tally = owned.get(list.ownerId) ?? { lists: 0, gifts: 0 };
    tally.lists += 1;
    tally.gifts += giftCount;
    owned.set(list.ownerId, tally);
  }

  /** Upload URL → every place it appears, in the words the operator would use. */
  const usedBy = new Map<string, string[]>();
  const note = (url: string, where: string) => {
    const existing = usedBy.get(url);
    if (existing) existing.push(where);
    else usedBy.set(url, [where]);
  };

  for (const { title, images, listName } of photoOwners) {
    // Every candidate counts, not only the selected one: the others are still
    // on disk and the owner can still switch to them.
    for (const url of images) note(url, `${title} — ${listName}`);
  }
  for (const { name, avatarUrl } of avatarOwners) {
    if (avatarUrl) note(avatarUrl, `${name}’s profile photo`);
  }

  const orphans = uploads.filter((upload) => !usedBy.has(upload.url));
  const totalBytes = uploads.reduce((sum, upload) => sum + upload.bytes, 0);

  return (
    <main className="mx-auto w-full max-w-[64rem] px-[1.375rem] py-10 sm:px-8">
      <h1 className="mb-2 font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em]">
        Admin
      </h1>
      <p className="mb-8 max-w-[44rem] text-sm leading-relaxed text-ink-76">
        Everything on this instance. Deleting here is immediate and permanent —
        there is no trash and no undo, and the people it belongs to are not told.
      </p>

      <Section
        title="Accounts"
        count={accounts.length}
        empty="Nobody has signed up yet."
      >
        {accounts.map((user) => {
          const { lists: listCount, gifts: giftCount } =
            owned.get(user.id) ?? { lists: 0, gifts: 0 };

          return (
            <Row key={user.id}>
              <Avatar name={user.name} url={user.avatarUrl} size={36} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{user.name}</p>
                <p className="truncate text-xs text-ink-72">{user.email}</p>
                <p className="mt-0.5 truncate text-xs text-ink-62">
                  /lists/{user.handle} · {plural(listCount, "list")} ·{" "}
                  {plural(giftCount, "gift")} · joined {stamp(user.createdAt)}
                </p>
              </div>

              <AdminDelete
                action={deleteAccount}
                fields={{ userId: user.id }}
                label="Delete account"
                prompt={
                  listCount > 0
                    ? `Delete ${user.name} and ${plural(listCount, "list")} with ${plural(
                        giftCount,
                        "gift",
                      )} on them? Everyone who reserved one of those gifts loses that reservation.`
                    : `Delete ${user.name}? They have no lists.`
                }
              />
            </Row>
          );
        })}
      </Section>

      <Section title="Lists" count={allLists.length} empty="No lists yet.">
        {allLists.map(({ list, ownerHandle, ownerName, giftCount }) => {
          const path = routes.publicList(list, ownerHandle);
          const short = routes.shortLink(list);

          return (
            <Row key={list.id}>
              <span className="text-xl leading-none">{list.emoji}</span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{list.name}</p>
                {/* The URL is what an operator came looking for: it is how a
                    report about a list arrives, and the only way to see what is
                    on one. Opened in a new tab so this screen stays put. */}
                <Link
                  href={path}
                  target="_blank"
                  className="block truncate text-xs font-medium text-violet hover:text-violet-hover"
                >
                  {displayHost}
                  {path}
                </Link>
                <p className="mt-0.5 truncate text-xs text-ink-62">
                  {ownerName ? (
                    <>
                      {ownerName} (/lists/{ownerHandle})
                    </>
                  ) : (
                    // No owner: started anonymously and never claimed, so it
                    // belongs to a cookie on somebody's phone.
                    <span className="font-semibold text-amber">Unclaimed draft</span>
                  )}{" "}
                  · {plural(giftCount, "gift")}
                  {short ? ` · ${displayHost}${short}` : ""} · made{" "}
                  {stamp(list.createdAt)}
                </p>
              </div>

              <AdminDelete
                action={deleteList}
                fields={{ listId: list.id }}
                label="Delete list"
                prompt={`Delete “${list.name}” and ${plural(
                  giftCount,
                  "gift",
                )}? Anyone who reserved one loses that reservation, and the link stops working.`}
              />
            </Row>
          );
        })}
      </Section>

      <Section
        title="Photos"
        count={uploads.length}
        empty="Nothing has been uploaded yet."
        note={
          uploads.length > 0
            ? `${fileSize(totalBytes)} in data/uploads · ${orphans.length} used by nothing`
            : undefined
        }
      >
        {uploads.map((upload) => {
          const places = usedBy.get(upload.url);

          return (
            <Row key={upload.name}>
              {/* Not next/image: these are served by a route handler from
                  outside `public/`, and the optimizer has nothing to gain on a
                  thumbnail of a file already on this disk. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upload.url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-control border border-ink-line object-cover"
              />

              <div className="min-w-0 flex-1">
                {places ? (
                  <>
                    <p className="truncate text-sm font-semibold">{places[0]}</p>
                    {places.length > 1 ? (
                      <p className="text-xs text-ink-72">
                        and {plural(places.length - 1, "other place")}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm font-semibold text-amber">Used by nothing</p>
                )}
                <p className="mt-0.5 truncate text-xs text-ink-62">
                  {fileSize(upload.bytes)} · uploaded {stamp(upload.uploadedAt)} ·{" "}
                  <span className="font-mono">{upload.name}</span>
                </p>
              </div>

              <AdminDelete
                action={deleteImage}
                fields={{ name: upload.name }}
                label="Delete photo"
                prompt={
                  places
                    ? `Delete this file? It is taken out of ${plural(
                        places.length,
                        "place",
                      )} showing it, and each of those falls back to an emoji or initials.`
                    : "Delete this file? Nothing is showing it."
                }
              />
            </Row>
          );
        })}
      </Section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* The furniture. All three sections are the same shape, so it is written once. */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  count,
  empty,
  note,
  children,
}: {
  title: string;
  count: number;
  /** Shown instead of the rows on a fresh instance, which is the usual case. */
  empty: string;
  /** A line beside the heading, where a total says more than the count does. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[1.375rem] leading-[1.15] tracking-[-0.02em]">
          {title}
          <span className="ml-2 align-middle text-sm font-semibold text-ink-62">
            {count}
          </span>
        </h2>
        {note ? <CapsLabel>{note}</CapsLabel> : null}
      </div>

      {count === 0 ? (
        <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-10 text-center text-sm text-ink-72">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">{children}</ul>
      )}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-card border border-ink-line bg-surface px-5 py-4 sm:flex-nowrap">
      {children}
    </li>
  );
}

/** "3 lists", "1 gift". Every count on this page is something about to be lost. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * "16 Sep 2025". The year is here because this is the one screen where the rows
 * from two years ago are the interesting ones, which is why it isn't
 * `formatShortDate`.
 */
function stamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * "412KB", "1.8MB". `formatBytes` in config/site is for telling somebody how far
 * over the 8MB limit their photo is, so it works in megabytes and would read
 * "0.0MB" for most of what is actually on this disk.
 */
function fileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes}B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)}KB`;
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}
