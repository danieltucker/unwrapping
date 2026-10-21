"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { deleteImage, deleteList, setBanned } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin-action-button";
import { AdminDelete } from "@/components/admin-delete";
import { Modal } from "@/components/modal";
import { CapsLabel } from "@/components/ui";

/** Someone a photo can be traced to, with what the admin screen needs to act on them. */
export type GalleryPerson = {
  id: string;
  name: string;
  email: string;
  banned: boolean;
  /** Admins can't be banned from here; see setBanned. */
  admin: boolean;
  self: boolean;
};

/** A list showing the photo, and which of its gifts do. */
export type GalleryList = {
  id: string;
  name: string;
  emoji: string;
  href: string;
  /** The owner's name, or null for an unclaimed draft. */
  ownerName: string | null;
  ownerBanned: boolean;
  giftCount: number;
  /** The gifts on it showing this photo. */
  gifts: string[];
};

export type GalleryPhoto = {
  name: string;
  url: string;
  /** Formatted on the server, so the two renders can't disagree about a date. */
  size: string;
  uploaded: string;
  uploader: GalleryPerson | null;
  /**
   * How the uploader is known. "recorded" is the upload's own row; "inferred"
   * is the earliest place it was used, for files from before uploads were
   * recorded. Otherwise, why there is nobody to name.
   */
  uploaderSource: "recorded" | "inferred" | "draft" | "unknown";
  lists: GalleryList[];
  /** Accounts showing it as their profile photo. */
  profileOf: string[];
};

/**
 * Every uploaded photo as a grid of thumbnails, and a viewer over the top of it
 * that says where one came from and offers the three things to do about it:
 * delete the photo, delete a list it is on, or ban whoever put it there.
 *
 * The viewer follows a photo by name rather than by position, so deleting a list
 * leaves you looking at the same picture; deleting the photo itself moves on to
 * the next one in the grid, which is the one you'd have looked at next anyway.
 */
export function AdminPhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<"all" | "unused">("all");
  // Name first; the index is where to land if that photo has just been deleted.
  const [selected, setSelected] = useState<{ name: string; index: number } | null>(null);

  const shown = filter === "unused" ? photos.filter(isUnused) : photos;

  let index = selected ? shown.findIndex((photo) => photo.name === selected.name) : -1;
  if (selected && index === -1 && shown.length > 0) {
    index = Math.min(selected.index, shown.length - 1);
  }
  const current = index >= 0 ? shown[index] : null;

  const open = (at: number) => {
    setSelected({ name: shown[at].name, index: at });
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  };

  const step = (by: number) => {
    if (shown.length === 0 || index === -1) return;
    open((index + by + shown.length) % shown.length);
  };

  // Arrow keys page through while the viewer is open. A listener rather than
  // a prop on the dialog, so it works wherever focus happens to be inside it.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!dialogRef.current?.open) return;
      if (event.key === "ArrowLeft") stepRef.current(-1);
      else if (event.key === "ArrowRight") stepRef.current(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const unusedCount = photos.filter(isUnused).length;

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Show">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All {photos.length}
        </FilterChip>
        <FilterChip active={filter === "unused"} onClick={() => setFilter("unused")}>
          Used by nothing {unusedCount}
        </FilterChip>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-10 text-center text-sm text-ink-72">
          Every photo is in use.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
          {shown.map((photo, at) => (
            <li key={photo.name}>
              <button
                type="button"
                onClick={() => open(at)}
                className="group block w-full text-left focus-ring rounded-control"
              >
                <span className="relative block aspect-square overflow-hidden rounded-control border border-ink-line bg-ink/[.04]">
                  {/* Not next/image: these are served by a route handler from
                      outside `public/`, and the optimizer has nothing to gain on
                      a thumbnail of a file already on this disk. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  {isUnused(photo) ? (
                    <Badge className="bg-amber text-white">Unused</Badge>
                  ) : photo.uploader?.banned ? (
                    <Badge className="bg-rose text-white">Banned</Badge>
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold">
                  {photo.lists[0]?.name ??
                    (photo.profileOf.length > 0 ? "Profile photo" : "Not shown anywhere")}
                </span>
                <span className="block truncate text-2xs text-ink-62">
                  {photo.uploader?.name ??
                    (photo.uploaderSource === "draft" ? "Unclaimed draft" : "Unknown uploader")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal dialogRef={dialogRef} size="xl" label="Photo">
        {current ? (
          <div className="grid md:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="relative flex min-h-[16rem] items-center justify-center bg-ink/[.06] md:min-h-[32rem] md:rounded-l-card max-md:rounded-t-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={current.name}
                src={current.url}
                alt=""
                className="max-h-[55vh] w-full object-contain md:max-h-[75vh]"
              />
              {shown.length > 1 ? (
                <>
                  <StepButton side="left" onClick={() => step(-1)} />
                  <StepButton side="right" onClick={() => step(1)} />
                </>
              ) : null}
              <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-pill bg-ink/70 px-2.5 py-0.5 text-2xs font-semibold text-white">
                {index + 1} of {shown.length}
              </span>
            </div>

            <PhotoDetails key={current.name} photo={current} />
          </div>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-ink-72">No photos left to show.</p>
        )}
      </Modal>
    </>
  );
}

/**
 * The side panel: the file, who it came from, where it is shown, and a control
 * beside each of those. Keyed by photo, so a half-confirmed delete doesn't
 * follow you to the next picture.
 */
function PhotoDetails({ photo }: { photo: GalleryPhoto }) {
  const places = photo.lists.reduce((sum, list) => sum + list.gifts.length, 0) + photo.profileOf.length;
  const { uploader } = photo;

  return (
    <div className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto px-5 pb-5 pt-14 md:pt-5 md:pr-14">
      <div>
        <CapsLabel className="mb-1.5">Uploaded by</CapsLabel>
        {uploader ? (
          <>
            <p className="text-sm font-semibold">
              {uploader.name}
              {uploader.banned ? (
                <span className="ml-2 rounded-pill bg-rose-wash px-2 py-0.5 align-middle text-2xs font-semibold text-rose">
                  Banned
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-ink-72">{uploader.email}</p>
            {photo.uploaderSource === "inferred" ? (
              <p className="mt-1 text-2xs leading-[1.5] text-ink-62">
                From before uploads were recorded — this is whoever used it first.
              </p>
            ) : null}
            <div className="mt-2.5 flex justify-end">
              {uploader.banned ? (
                <AdminActionButton
                  action={setBanned}
                  fields={{ userId: uploader.id }}
                  label="Lift ban"
                  busyLabel="Lifting…"
                />
              ) : uploader.self || uploader.admin ? (
                <p className="text-2xs text-ink-62">
                  {uploader.self ? "That's you." : "An admin — remove their access to ban them."}
                </p>
              ) : (
                <AdminDelete
                  action={setBanned}
                  fields={{ userId: uploader.id, ban: "on" }}
                  label="Ban user"
                  confirmLabel="Ban"
                  busyLabel="Banning…"
                  prompt={`Ban ${uploader.name}? They're signed out and can't sign back in, and all their lists go offline. Nothing is deleted; you can lift it from Accounts.`}
                />
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-72">
            {photo.uploaderSource === "draft"
              ? "Someone who hasn't made an account — it was uploaded to an unclaimed draft. Delete the list to remove it."
              : "Nobody we can name. It was uploaded before uploads were recorded, and nothing shows it now."}
          </p>
        )}
      </div>

      <div>
        <CapsLabel className="mb-1.5">
          {places === 0 ? "Shown on" : `Shown in ${plural(places, "place")}`}
        </CapsLabel>
        {places === 0 ? (
          <p className="text-sm font-semibold text-amber">Nothing — safe to delete.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {photo.lists.map((list) => (
              <li key={list.id} className="rounded-control border border-ink-line bg-surface px-3 py-2.5">
                <a
                  href={list.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-semibold text-violet hover:text-violet-hover"
                >
                  <span className="mr-1.5">{list.emoji}</span>
                  {list.name}
                </a>
                <p className="truncate text-xs text-ink-62">
                  {list.ownerName ?? "Unclaimed draft"}
                  {list.ownerBanned ? " (banned)" : ""} · {plural(list.giftCount, "gift")}
                </p>
                <p className="mt-0.5 text-xs leading-[1.5] text-ink-76">
                  On {list.gifts.map((gift) => `“${gift}”`).join(", ")}
                </p>
                <div className="mt-2 flex justify-end">
                  <AdminDelete
                    action={deleteList}
                    fields={{ listId: list.id }}
                    label="Delete list"
                    prompt={`Delete “${list.name}” and ${plural(
                      list.giftCount,
                      "gift",
                    )}? Anyone who reserved one loses that reservation, and the link stops working.`}
                  />
                </div>
              </li>
            ))}
            {photo.profileOf.map((name) => (
              <li key={name} className="rounded-control border border-ink-line bg-surface px-3 py-2.5 text-sm font-semibold">
                {name}’s profile photo
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto border-t border-ink-line pt-4">
        <p className="mb-2.5 text-xs text-ink-62">
          {photo.size} · uploaded {photo.uploaded}
          <span className="mt-0.5 block truncate font-mono text-2xs">{photo.name}</span>
        </p>
        <div className="flex justify-end">
          <AdminDelete
            action={deleteImage}
            fields={{ name: photo.name }}
            label="Delete photo"
            prompt={
              places > 0
                ? `Delete this file? It is taken out of ${plural(
                    places,
                    "place",
                  )} showing it, and each of those falls back to an emoji or initials.`
                : "Delete this file? Nothing is showing it."
            }
          />
        </div>
      </div>
    </div>
  );
}

function StepButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill border border-ink-line bg-surface/90 text-ink shadow-card transition-colors duration-150 hover:bg-surface focus-ring ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-pill border px-[13px] py-1.5 text-xs font-semibold transition-colors duration-150 focus-ring ${
        active
          ? "border-violet bg-violet-wash text-violet-hover"
          : "border-ink-line-strong bg-surface text-ink-72 hover:bg-ink/[.03]"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`absolute left-1.5 top-1.5 rounded-pill px-1.5 py-0.5 text-2xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function isUnused(photo: GalleryPhoto): boolean {
  return photo.lists.length === 0 && photo.profileOf.length === 0;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
