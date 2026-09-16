"use client";

import { useActionState, useEffect, useRef, useState, type RefObject } from "react";

import {
  deleteItem,
  refetchItem,
  updateItem,
  type EditItemState,
} from "@/app/lists/[handle]/[slug]/manage/items/[itemId]/edit/actions";
import { GoalField } from "@/components/goal-field";
import { Button, CapsLabel, Input, Textarea } from "@/components/ui";
import { centsToInput } from "@/config/site";
import { uploadPhoto, type UploadState } from "@/lib/photo-actions";
import type { Item } from "@/db/schema";

/** Identifies the list in every form on this page. */
type ListKeys = { handle: string; listKey: string };

export function EditGiftForm({
  item,
  handle,
  listKey,
}: { item: Item } & ListKeys) {
  const [state, action, pending] = useActionState<EditItemState, FormData>(
    updateItem,
    {},
  );
  const [selected, setSelected] = useState(item.selectedImageIndex);
  // A group gift needs a goal, so the field only appears once it's one.
  const [isGroupGift, setIsGroupGift] = useState(item.isGroupGift);
  const uploadDialog = useRef<HTMLDialogElement>(null);

  // After an upload the server selects the new photo; follow it so the
  // preview shows what was just added rather than the old choice.
  const [lastFromServer, setLastFromServer] = useState(item.selectedImageIndex);
  if (item.selectedImageIndex !== lastFromServer) {
    setLastFromServer(item.selectedImageIndex);
    setSelected(item.selectedImageIndex);
  }

  const preview = item.images[selected] ?? item.images[0] ?? null;

  return (
    <div className="p-[26px]">
      <form action={action}>
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="key" value={listKey} />
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="selectedImageIndex" value={selected} />

        <div className="mb-[18px] flex gap-[15px]">
          <div className="w-24 shrink-0">
            {/* The photo is the control: clicking it is how you change it. */}
            <button
              type="button"
              onClick={() => uploadDialog.current?.showModal()}
              aria-label={preview ? "Change the photo" : "Add a photo"}
              className="group relative mb-2 block h-[118px] w-24 overflow-hidden rounded-[9px] bg-ink/[.05] focus-ring"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center px-2 text-center text-2xs text-ink-62">
                  No photo
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-ink/72 py-[5px] text-2xs font-semibold text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {preview ? "Change" : "Add a photo"}
              </span>
            </button>

            {item.images.length > 1 ? (
              <div className="flex flex-wrap gap-[5px]">
                {item.images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelected(index)}
                    aria-label={`Use photo ${index + 1}`}
                    aria-pressed={index === selected}
                    className={`h-6 w-5 overflow-hidden rounded-[5px] ${
                      index === selected ? "ring-[1.5px] ring-violet" : "opacity-70"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
            <div>
              <label htmlFor="title">
                <CapsLabel className="mb-[5px] text-2xs">Title</CapsLabel>
              </label>
              <Input
                id="title"
                name="title"
                defaultValue={item.title}
                required
                maxLength={160}
                className="py-[9px] text-sm"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="price">
                  <CapsLabel className="mb-[5px] text-2xs">Price</CapsLabel>
                </label>
                <Input
                  id="price"
                  name="price"
                  inputMode="decimal"
                  defaultValue={centsToInput(item.priceCents)}
                  placeholder="—"
                  className="py-[9px] text-sm"
                />
              </div>
              <div className="w-[72px] shrink-0">
                <label htmlFor="quantity">
                  <CapsLabel className="mb-[5px] text-2xs">Qty</CapsLabel>
                </label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={item.quantity}
                  className="py-[9px] text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="reason">
            <CapsLabel className="mb-[5px] text-2xs">Why you want it</CapsLabel>
          </label>
          <Textarea
            id="reason"
            name="reason"
            rows={2}
            maxLength={300}
            defaultValue={item.reason ?? ""}
            className="text-sm"
          />
        </div>

        <div className="mb-5 flex flex-col gap-2">
          <label className="flex cursor-pointer items-center justify-between rounded-control border border-ink-line bg-surface px-[13px] py-[11px]">
            <span className="text-sm font-semibold">Mark as most wanted</span>
            <input
              type="checkbox"
              name="isMostWanted"
              defaultChecked={item.isMostWanted}
              className="h-4 w-4 accent-violet"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-control border border-ink-line bg-surface px-[13px] py-[11px]">
            <span>
              <span className="block text-sm font-semibold">
                Let guests chip in together
              </span>
              <span className="block text-2xs text-ink-72">
                Splits the price across several people
              </span>
            </span>
            <input
              type="checkbox"
              name="isGroupGift"
              checked={isGroupGift}
              onChange={(event) => setIsGroupGift(event.target.checked)}
              className="h-4 w-4 accent-violet"
            />
          </label>

          {isGroupGift ? (
            <GoalField
              defaultValue={centsToInput(item.goalCents ?? item.priceCents)}
            />
          ) : null}
        </div>

        {state.error ? (
          <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      {/* Sits outside the form above: a form cannot be nested inside another. */}
      <UploadDialog
        dialogRef={uploadDialog}
        item={item}
        handle={handle}
        listKey={listKey}
      />

      {/* Repair and destruction both live down here, out of the way. */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-t border-ink-line pt-5">
        <RefetchLink item={item} handle={handle} listKey={listKey} />
        <DeleteItem item={item} handle={handle} listKey={listKey} />
      </div>
    </div>
  );
}

function UploadDialog({
  dialogRef,
  item,
  handle,
  listKey,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  item: Item;
} & ListKeys) {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadPhoto,
    {},
  );

  // Close once the photo lands; an error keeps it open so it can be read.
  useEffect(() => {
    if (state.url) dialogRef.current?.close();
  }, [state.url, dialogRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`upload-heading-${item.id}`}
      className="w-[min(420px,calc(100vw-32px))] rounded-card border border-ink-line bg-paper p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <form action={action} className="p-6">
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="key" value={listKey} />
        <input type="hidden" name="itemId" value={item.id} />

        <h2
          id={`upload-heading-${item.id}`}
          className="mb-2 font-display text-[1.5rem] leading-[1.1] tracking-[-.6px]"
        >
          {item.images.length > 0 ? "Add another photo" : "Add a photo"}
        </h2>
        <p className="mb-4 text-xs leading-[1.6] text-ink-72">
          JPEG, PNG, WebP, GIF or AVIF, up to 8MB. Portrait crops look best.
        </p>

        <input
          type="file"
          name="photo"
          required
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="mb-4 w-full text-xs file:mr-3 file:rounded-pill file:border-0 file:bg-ink/[.06] file:px-4 file:py-2 file:text-xs file:font-semibold"
        />

        {state.error ? (
          <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="mb-2 w-full">
          {pending ? "Uploading…" : "Upload photo"}
        </Button>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="w-full text-center text-sm font-semibold text-ink-72"
        >
          Never mind
        </button>
      </form>
    </dialog>
  );
}

/** Deliberately quiet: re-reading a link is a repair, not a routine step. */
function RefetchLink({ item, handle, listKey }: { item: Item } & ListKeys) {
  const [state, action, pending] = useActionState<EditItemState, FormData>(
    refetchItem,
    {},
  );

  if (!item.url) return null;

  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="key" value={listKey} />
      <input type="hidden" name="itemId" value={item.id} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-ink-62 underline-offset-2 hover:text-ink-76 hover:underline disabled:opacity-60"
      >
        {pending ? "Re-reading the link…" : "Re-read the link"}
      </button>
      {state.message ? (
        <p className="mt-1 text-xs leading-[1.5] text-pine-dark">{state.message}</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-1 text-xs leading-[1.5] text-rose-dark">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function DeleteItem({ item, handle, listKey }: { item: Item } & ListKeys) {
  const [state, action, pending] = useActionState<EditItemState, FormData>(
    deleteItem,
    {},
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="min-w-0">
      {confirming ? (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="key" value={listKey} />
          <input type="hidden" name="itemId" value={item.id} />
          <p className="text-xs leading-[1.6] text-ink-76">
            Delete this gift? Anyone who reserved it loses that reservation.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="rounded-pill bg-rose px-[15px] py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Yes, delete it"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs font-semibold text-ink-72"
          >
            Keep it
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs font-medium text-rose-dark underline-offset-2 hover:underline"
        >
          Delete this gift
        </button>
      )}
      {state.error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-dark">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
