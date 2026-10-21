import { asc, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  checkLinksNow,
  deleteAccount,
  deleteCategory,
  deleteList,
  dismissReport,
  removeReportedMessage,
  setAdmin,
  setBanned,
} from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin-action-button";
import { AdminDelete } from "@/components/admin-delete";
import {
  AdminPhotoGallery,
  type GalleryList,
  type GalleryPerson,
  type GalleryPhoto,
} from "@/components/admin-photo-gallery";
import { AdminTracking } from "@/components/admin-tracking";
import { CategoryForm, CategoryRow } from "@/components/category-form";
import { Avatar, CapsLabel } from "@/components/ui";
import { db } from "@/db";
import {
  items,
  lists,
  uploads as uploadRecords,
  users,
  type List,
  type User,
} from "@/db/schema";
import { isAdmin, isAdminEmail, requireAdmin } from "@/lib/admin";
import { eventCounts } from "@/lib/analytics";
import { allCategories } from "@/lib/guides";
import { linkHealth, priceCheckState } from "@/lib/price-checks";
import { displayHost } from "@/lib/origin";
import * as routes from "@/lib/routes";
import { openReports } from "@/lib/secret-santa";
import { trackingOverview } from "@/lib/tracking-stats";
import { listUploads, type StoredUpload } from "@/lib/uploads";

export const metadata: Metadata = {
  title: "Admin",
  // Every account on the instance, on one page. Nothing here belongs anywhere
  // near a search index.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Everything on this instance, and the three ways to remove some of it:
 * accounts, lists, and the photos on disk. Above them, the one thing here that
 * is curated rather than cleaned up: the categories gift guides are filed under.
 *
 * Reachable only by administrators: whoever the operator named in ADMIN_EMAILS,
 * and whoever they have made one from the Accounts section — see
 * `src/lib/admin.ts`. Nobody else gets a 403; they get the 404 they would get
 * for a list that isn't theirs, because a signed-in stranger shouldn't learn
 * this screen exists.
 *
 * Deliberately one page rather than three. An operator comes here to answer
 * "what is in here, and what is taking up room", and a photo that belongs to
 * nothing is only recognisable next to the lists it isn't on.
 */
export default async function AdminPage() {
  const me = await requireAdmin();

  const [categoryRows, links, accounts, allLists, uploads, photoOwners, uploadRows, reports, santaEvents, tracking] = await Promise.all([
    allCategories(),
    linkHealth(),

    db.select().from(users).orderBy(desc(users.createdAt)).all(),

    // Left-joined rather than inner: a list with no owner is an unclaimed
    // draft, and those are most of what accumulates on an instance people try
    // out and walk away from.
    db
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
      .all(),

    listUploads(),

    // What each file on disk is actually drawing, so "is this safe to delete"
    // is answered on the page rather than guessed at.
    // Oldest first, so the first gift found showing a file is where it was
    // originally uploaded — copies of a list share their photos' URLs.
    db
      .select({ title: items.title, images: items.images, listId: items.listId })
      .from(items)
      .orderBy(asc(items.createdAt))
      .all(),

    // Who uploaded what, for files uploaded since that was recorded.
    db.select().from(uploadRecords).all(),

    openReports(),
    eventCounts(),
    trackingOverview(),
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

  const photos = galleryPhotos({
    uploads,
    photoOwners,
    uploadRows,
    accounts,
    allLists,
    meId: me.id,
  });
  const orphanCount = photos.filter(
    (photo) => photo.lists.length === 0 && photo.profileOf.length === 0,
  ).length;
  const checks = priceCheckState();
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
        title="Gift list categories"
        count={categoryRows.length}
        note="Shown on /gifts and the homepage"
        empty="No categories yet. Add the first above, and gift lists can be filed under it."
        before={<CategoryForm />}
      >
        {categoryRows.map(({ guideCount, ...category }) => (
          <CategoryRow key={category.id} category={category} guideCount={guideCount}>
            <AdminDelete
              action={deleteCategory}
              fields={{ categoryId: category.id }}
              label="Delete"
              prompt={
                guideCount > 0
                  ? `Delete “${category.name}”? Its ${plural(guideCount, "gift list")} stay published, without a category, until their owners pick another.`
                  : `Delete “${category.name}”? Nothing is filed under it.`
              }
            />
          </CategoryRow>
        ))}
      </Section>

      <Section
        title="Reported Secret Santa messages"
        count={reports.length}
        note="Reporters are never shown"
        empty="Nothing reported. Messages between a Santa and the person they drew land here only if one of them flags it."
      >
        {reports.map((report) => (
          <Row key={report.reportId}>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line break-words text-sm leading-[1.6]">
                {report.removedAt ? <em className="text-ink-62">Already removed.</em> : report.body}
              </p>
              <p className="mt-1 text-xs text-ink-72">
                From {report.senderName} in &ldquo;{report.exchangeName}&rdquo; · reported{" "}
                {stamp(report.reportedAt)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <AdminActionButton
                action={dismissReport}
                fields={{ reportId: report.reportId }}
                label="It's fine"
                busyLabel="Dismissing…"
              />
              <AdminDelete
                action={removeReportedMessage}
                fields={{ messageId: report.messageId }}
                label="Remove"
                prompt="Take this message out of the thread? Both people will see that a message was removed."
                confirmLabel="Remove it"
                busyLabel="Removing…"
              />
            </div>
          </Row>
        ))}
      </Section>

      <Section
        title="Secret Santa"
        count={santaEvents.santa_group_created.total}
        note="Counts only: no people, no groups"
        empty="No Secret Santas yet."
        bare
      >
        <dl className="grid gap-2.5 sm:grid-cols-4">
          {(
            [
              ["santa_group_created", "Groups created"],
              ["santa_member_joined", "Members joined"],
              ["santa_draw_run", "Draws run"],
              ["santa_reveal_opened", "Reveals opened"],
            ] as const
          ).map(([event, label]) => (
            <div key={event} className="rounded-card border border-ink-line bg-surface px-5 py-4">
              <dt className="text-xs text-ink-72">{label}</dt>
              <dd className="font-display text-[1.875rem] leading-none">
                {santaEvents[event].last30}
              </dd>
              <dd className="mt-1 text-2xs text-ink-62">
                last 30 days · {santaEvents[event].total} in all
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Tracking"
        count={tracking.total}
        note="Ids and counts only · 30 days"
        empty=""
        bare
        // The switch and the status line have to show before the first event does.
        always
      >
        <AdminTracking overview={tracking} />
      </Section>

      <Section
        title="Product links that need a look"
        count={links.problems.length}
        note={`${links.checked} of ${links.tracked} links checked`}
        empty="Nothing needs a look. Every rechecked link was readable, or not yet worth flagging."
        before={
          <div className="flex flex-col gap-2 rounded-card border border-ink-line bg-surface px-5 py-4">
            <p className="text-xs leading-[1.6] text-ink-72">
              Links are rechecked about once a month, a few an hour, and prices
              that came from the shop follow it. Dead means the shop answered
              404 or 410 twice running; unreadable means it turned us away
              three times running, which big shops do to everyone and which says
              nothing about the product.
              {checks.lastRun
                ? ` Last batch ${stamp(checks.lastRun)}: ${checks.lastSummary ?? "no summary"}`
                : " No batch has run since this server started."}
              {checks.running ? " A batch is running now." : ""}
            </p>
            <AdminActionButton
              action={checkLinksNow}
              label="Check due links now"
              busyLabel="Starting…"
            />
          </div>
        }
      >
        {links.problems.map((link) => (
          <Row key={link.url}>
            <div className="min-w-0 flex-1">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="block truncate text-sm font-semibold text-violet hover:text-violet-hover"
              >
                {link.url}
              </a>
              <p className="mt-0.5 truncate text-xs text-ink-62">
                <span className={`font-semibold ${link.dead ? "text-rose" : "text-amber"}`}>
                  {link.dead
                    ? `Dead · ${link.goneStreak} 404s running`
                    : `Unreadable · ${link.failStreak} times running`}
                </span>{" "}
                · {plural(link.giftCount, "gift")} · last {link.detail ?? link.status},{" "}
                {stamp(link.checkedAt)}
              </p>
            </div>
          </Row>
        ))}
      </Section>

      <Section
        title="Accounts"
        count={accounts.length}
        empty="Nobody has signed up yet."
      >
        {accounts.map((user) => {
          const { lists: listCount, gifts: giftCount } =
            owned.get(user.id) ?? { lists: 0, gifts: 0 };
          const self = user.id === me.id;
          const root = isAdminEmail(user.email);
          const admin = isAdmin(user);

          return (
            <Row key={user.id}>
              <Avatar name={user.name} url={user.avatarUrl} size={36} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {user.name}
                  {self ? <Pill tone="ink">You</Pill> : null}
                  {admin ? <Pill tone="violet">{root ? "Admin · ADMIN_EMAILS" : "Admin"}</Pill> : null}
                  {user.bannedAt ? <Pill tone="rose">Banned {stamp(user.bannedAt)}</Pill> : null}
                </p>
                <p className="truncate text-xs text-ink-72">{user.email}</p>
                <p className="mt-0.5 truncate text-xs text-ink-62">
                  /lists/{user.handle} · {plural(listCount, "list")} ·{" "}
                  {plural(giftCount, "gift")} · joined {stamp(user.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-end gap-2">
                {/* ADMIN_EMAILS is the operator's say-so and can't be undone
                    from here; nor can your own access, or a banned account be
                    promoted. setAdmin refuses all three regardless. */}
                {root || user.bannedAt || (self && admin) ? null : (
                  <AdminActionButton
                    action={setAdmin}
                    fields={admin ? { userId: user.id } : { userId: user.id, grant: "on" }}
                    label={admin ? "Remove admin" : "Make admin"}
                    busyLabel="Saving…"
                  />
                )}

                {user.bannedAt ? (
                  <AdminActionButton
                    action={setBanned}
                    fields={{ userId: user.id }}
                    label="Lift ban"
                    busyLabel="Lifting…"
                  />
                ) : self || admin ? null : (
                  <AdminDelete
                    action={setBanned}
                    fields={{ userId: user.id, ban: "on" }}
                    label="Ban"
                    confirmLabel="Ban"
                    busyLabel="Banning…"
                    prompt={`Ban ${user.name}? They're signed out and can't sign back in, and their ${plural(
                      listCount,
                      "list",
                    )} go offline. Nothing is deleted, and lifting the ban puts it all back.`}
                  />
                )}

                {self ? null : (
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
                )}
              </div>
            </Row>
          );
        })}
      </Section>

      <Section title="Lists" count={allLists.length} empty="No lists yet.">
        {allLists.map(({ list, ownerHandle, ownerName, ownerBanned, giftCount }) => {
          const path = routes.publicList(list, ownerHandle);
          const short = routes.shortLink(list);

          return (
            <Row key={list.id}>
              <span className="text-xl leading-none">{list.emoji}</span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {list.name}
                  {list.kind === "guide" ? (
                    <span className="ml-2 rounded-pill bg-violet-wash px-2 py-0.5 align-middle text-2xs font-semibold text-violet-hover">
                      {list.publishedAt ? "Published gift list" : "Unpublished gift list"}
                    </span>
                  ) : null}
                </p>
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
                      {ownerBanned ? (
                        // Offline for everyone but this screen while the ban stands.
                        <span className="font-semibold text-rose"> · owner banned</span>
                      ) : null}
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
        count={photos.length}
        empty="Nothing has been uploaded yet."
        note={
          photos.length > 0
            ? `${fileSize(totalBytes)} in data/uploads · ${orphanCount} used by nothing`
            : undefined
        }
        bare
      >
        <AdminPhotoGallery photos={photos} />
      </Section>
    </main>
  );
}

/**
 * Every file on disk, with who put it there and where it is shown, in the shape
 * the gallery draws.
 *
 * Who uploaded it comes from the upload's own row where there is one. Files
 * from before those were recorded fall back to the earliest gift showing them —
 * copying a list copies its photos' URLs, so later uses are other people's
 * copies — and then to a profile photo.
 */
function galleryPhotos({
  uploads,
  photoOwners,
  uploadRows,
  accounts,
  allLists,
  meId,
}: {
  uploads: StoredUpload[];
  /** Oldest first. */
  photoOwners: { title: string; images: string[]; listId: string }[];
  uploadRows: (typeof uploadRecords.$inferSelect)[];
  accounts: User[];
  allLists: {
    list: List;
    ownerHandle: string | null;
    ownerName: string | null;
    ownerBanned: boolean;
    giftCount: number;
  }[];
  meId: string;
}): GalleryPhoto[] {
  const people = new Map(accounts.map((user) => [user.id, user]));
  const listsById = new Map(allLists.map((row) => [row.list.id, row]));
  const recorded = new Map(uploadRows.map((row) => [row.name, row]));

  const person = (id: string | null | undefined): GalleryPerson | null => {
    const user = id ? people.get(id) : undefined;
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      banned: user.bannedAt !== null,
      admin: isAdmin(user),
      self: user.id === meId,
    };
  };

  /** Upload URL → list id → the gifts on that list showing it, first use first. */
  const shownOn = new Map<string, Map<string, string[]>>();
  for (const { title, images, listId } of photoOwners) {
    // Every candidate counts, not only the selected one: the others are still
    // on disk and the owner can still switch to them.
    for (const url of new Set(images)) {
      const byList = shownOn.get(url) ?? new Map<string, string[]>();
      byList.set(listId, [...(byList.get(listId) ?? []), title]);
      shownOn.set(url, byList);
    }
  }

  const avatars = new Map<string, User[]>();
  for (const user of accounts) {
    if (user.avatarUrl) avatars.set(user.avatarUrl, [...(avatars.get(user.avatarUrl) ?? []), user]);
  }

  return uploads.map((upload) => {
    const shownLists: GalleryList[] = [...(shownOn.get(upload.url) ?? [])].flatMap(
      ([listId, gifts]) => {
        const row = listsById.get(listId);
        if (!row) return [];
        return [
          {
            id: row.list.id,
            name: row.list.name,
            emoji: row.list.emoji,
            href: routes.publicList(row.list, row.ownerHandle),
            ownerName: row.ownerName,
            ownerBanned: row.ownerBanned,
            giftCount: row.giftCount,
            gifts,
          },
        ];
      },
    );
    const profiles = avatars.get(upload.url) ?? [];

    let uploader: GalleryPerson | null;
    let uploaderSource: GalleryPhoto["uploaderSource"];
    const record = recorded.get(upload.name);

    if (record) {
      // A draft's upload has no account on it, but the list knows whose it
      // became once they signed up.
      const list = record.listId ? listsById.get(record.listId)?.list : undefined;
      uploader = person(record.userId ?? list?.ownerId);
      uploaderSource = uploader ? "recorded" : list && !list.ownerId ? "draft" : "unknown";
    } else {
      const first = shownLists[0] ? listsById.get(shownLists[0].id)?.list : undefined;
      uploader = person(first?.ownerId ?? profiles[0]?.id);
      uploaderSource = uploader ? "inferred" : first ? "draft" : "unknown";
    }

    return {
      name: upload.name,
      url: upload.url,
      size: fileSize(upload.bytes),
      uploaded: stamp(upload.uploadedAt),
      uploader,
      uploaderSource,
      lists: shownLists,
      profileOf: profiles.map((user) => user.name),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* The furniture. Every section is the same shape, so it is written once.    */
/* -------------------------------------------------------------------------- */

function Pill({ tone, children }: { tone: "ink" | "violet" | "rose"; children: ReactNode }) {
  const tones = {
    ink: "bg-ink/[.06] text-ink-72",
    violet: "bg-violet-wash text-violet-hover",
    rose: "bg-rose-wash text-rose",
  };
  return (
    <span
      className={`ml-2 rounded-pill px-2 py-0.5 align-middle text-2xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Section({
  title,
  count,
  empty,
  note,
  before,
  bare = false,
  always = false,
  children,
}: {
  title: string;
  count: number;
  /** Shown instead of the rows on a fresh instance, which is the usual case. */
  empty: string;
  /** A line beside the heading, where a total says more than the count does. */
  note?: string;
  /** Sits between the heading and the rows: the "add one" form, where there is one. */
  before?: ReactNode;
  /** The children lay themselves out, rather than being rows in a list. */
  bare?: boolean;
  /** Shows the children even at a count of zero, for a section that explains its own emptiness. */
  always?: boolean;
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

      {before ? <div className="mb-2.5">{before}</div> : null}

      {count === 0 && !always ? (
        <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-10 text-center text-sm text-ink-72">
          {empty}
        </p>
      ) : bare ? (
        children
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
