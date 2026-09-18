"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  deleteItem,
  refetchItem,
  updateItem,
  type EditItemState,
} from "@/app/lists/[handle]/[slug]/manage/items/[itemId]/edit/actions";
import {
  GiftEmojiField,
  GiftPhotoField,
  GiftUploadDialog,
} from "@/components/gift-photo-fields";
import { GoalField } from "@/components/goal-field";
import { Button, CapsLabel, Input, Textarea } from "@/components/ui";
import { centsToInput } from "@/config/site";
import type { Item } from "@/db/schema";

/** Identifies the list in every form on this page. */
type ListKeys = { handle: string; listKey: string };

export function EditGiftForm({
  item,
  handle,
  listKey,
  onDone,
}: { item: Item; onDone: () => void } & ListKeys) {
  const [state, action, pending] = useActionState<EditItemState, FormData>(
    updateItem,
    {},
  );
  const [selected, setSelected] = useState(item.selectedImageIndex);
  const [title, setTitle] = useState(item.title);
  const [emoji, setEmoji] = useState<string | null>(item.emoji);
  // A group gift needs a goal, so the field only appears once it's one.
  const [isGroupGift, setIsGroupGift] = useState(item.isGroupGift);
  const uploadDialog = useRef<HTMLDialogElement>(null);

  // Kind is fixed once the gift exists, so this only decides what is shown.
  const cash = item.kind === "cash";
  const idea = item.kind === "idea";

  // After an upload the server selects the new photo; follow it so the
  // preview shows what was just added rather than the old choice.
  const [lastFromServer, setLastFromServer] = useState(item.selectedImageIndex);
  if (item.selectedImageIndex !== lastFromServer) {
    setLastFromServer(item.selectedImageIndex);
    setSelected(item.selectedImageIndex);
  }

  // Saved, so the panel has nothing left to show. The editor behind it has
  // already been told to refresh.
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div className="p-[26px]">
      <form action={action}>
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="key" value={listKey} />
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="selectedImageIndex" value={selected} />

        <div className="mb-[18px] flex gap-[15px]">
          <GiftPhotoField
            images={item.images}
            selected={selected}
            onSelect={setSelected}
            emoji={emoji}
            onOpenUpload={() => uploadDialog.current?.showModal()}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
            <div>
              <label htmlFor="title">
                <CapsLabel className="mb-[5px] text-2xs">Title</CapsLabel>
              </label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={160}
                className="py-[9px] text-sm"
              />
            </div>
            {cash || idea ? null : (
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
                    placeholder="-"
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
            )}
          </div>
        </div>

        <GiftEmojiField title={title} value={emoji} onChange={setEmoji} />

        <div className="mb-4">
          <label htmlFor="reason">
            <CapsLabel className="mb-[5px] text-2xs">
              {cash ? "What it's for" : idea ? "What to look for" : "Why you want it"}
            </CapsLabel>
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
          {cash || idea ? null : (
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
          )}

          {cash || isGroupGift ? (
            <GoalField
              defaultValue={centsToInput(item.goalCents ?? item.priceCents)}
              cash={cash}
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
      <GiftUploadDialog
        dialogRef={uploadDialog}
        hasPhoto={item.images.length > 0}
        // The server attaches the photo to the item and revalidates, so the
        // new one arrives through props; nothing to carry here.
        onUploaded={() => {}}
        handle={handle}
        listKey={listKey}
        itemId={item.id}
      />

      {/* Repair and destruction both live down here, out of the way. */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-t border-ink-line pt-5">
        <RefetchLink item={item} handle={handle} listKey={listKey} />
        <DeleteItem item={item} handle={handle} listKey={listKey} onDone={onDone} />
      </div>
    </div>
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

function DeleteItem({
  item,
  handle,
  listKey,
  onDone,
}: { item: Item; onDone: () => void } & ListKeys) {
  const [state, action, pending] = useActionState<EditItemState, FormData>(
    deleteItem,
    {},
  );
  const [confirming, setConfirming] = useState(false);

  // The gift this panel is about no longer exists. The row it opened from is on
  // its way out too, but close explicitly rather than trusting a dialog to take
  // its backdrop with it when React pulls it out of the document.
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

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
