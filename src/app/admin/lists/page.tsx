import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { checkLinksNow, deleteCategory, deleteList } from "@/app/admin/actions";
import { allListRows, type AdminListRow } from "@/app/admin/queries";
import { AdminActionButton } from "@/components/admin-action-button";
import { AdminDelete } from "@/components/admin-delete";
import {
  AdminPhotoGallery,
  type GalleryList,
  type GalleryPerson,
  type GalleryPhoto,
} from "@/components/admin-photo-gallery";
import { fileSize, plural, Row, Section, stamp } from "@/components/admin-ui";
import { CategoryForm, CategoryRow } from "@/components/category-form";
import { db } from "@/db";
import { items, uploads as uploadRecords, users, type User } from "@/db/schema";
import { isAdmin, requireAdmin } from "@/lib/admin";
import { allCategories } from "@/lib/guides";
import { displayHost } from "@/lib/origin";
import { linkHealth, priceCheckState } from "@/lib/price-checks";
import * as routes from "@/lib/routes";
import { listUploads, type StoredUpload } from "@/lib/uploads";

export const metadata: Metadata = { title: "Lists & categories · Admin" };

/**
 * What people have made, and what it is made of: the categories gift guides
 * are filed under (the one thing here that is curated rather than cleaned up),
 * every list, the product links on them that have stopped working, and the
 * photos on disk.
 *
 * The photos are on this tab rather than their own because a photo that
 * belongs to nothing is only recognisable next to the lists it isn't on.
 */
export default async function AdminListsPage() {
  const me = await requireAdmin();

  const [categoryRows, links, accounts, allLists, uploads, photoOwners, uploadRows] = await Promise.all([
    allCategories(),
    linkHealth(),
    db.select().from(users).all(),
    allListRows(),
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
  ]);

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
    <>
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
    </>
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
  allLists: AdminListRow[];
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
