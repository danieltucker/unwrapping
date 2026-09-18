"use client";

import { useActionState, useEffect, useState, type RefObject } from "react";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { formatBytes, uploads } from "@/config/site";
import { suggestGiftEmoji } from "@/lib/emoji";
import { uploadPhoto, type UploadState } from "@/lib/photo-actions";

/**
 * The picture half of both gift forms: the preview that doubles as the upload
 * control, the thumbnail strip, the upload dialog, and the emoji that stands
 * in when there is no photo at all.
 *
 * Shared because a gift written in by hand has to be able to do everything a
 * scraped one can. The only difference between the two callers is where an
 * uploaded URL goes: straight onto the item when it already exists, or into
 * the add form's own state when it doesn't.
 *
 * The dialog is a separate export because it has to be rendered outside the
 * form the preview sits in; one form cannot be nested inside another.
 */

type ListKeys = { handle: string; listKey: string };

export function GiftPhotoField({
  images,
  selected,
  onSelect,
  emoji,
  onOpenUpload,
}: {
  images: string[];
  selected: number;
  onSelect: (index: number) => void;
  /** Shown in place of the photo when there is none. */
  emoji: string | null;
  onOpenUpload: () => void;
}) {
  const preview = images[selected] ?? images[0] ?? null;

  return (
    <div className="w-24 shrink-0">
      {/* The photo is the control: clicking it is how you change it. */}
      <button
        type="button"
        onClick={onOpenUpload}
        aria-label={preview ? "Change the photo" : "Add a photo"}
        className="group relative mb-2 block h-[118px] w-24 overflow-hidden rounded-[9px] bg-ink/[.05] focus-ring"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : emoji ? (
          <span className="flex h-full items-center justify-center text-[2.75rem] leading-none">
            {emoji}
          </span>
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-2xs text-ink-62">
            No photo
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-ink/72 py-[5px] text-2xs font-semibold text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          {preview ? "Change" : "Add a photo"}
        </span>
      </button>

      {images.length > 1 ? (
        <div className="flex flex-wrap gap-[5px]">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => onSelect(index)}
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
  );
}

export function GiftUploadDialog({
  dialogRef,
  hasPhoto,
  onUploaded,
  handle,
  listKey,
  itemId,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  hasPhoto: boolean;
  /** Called with the stored URL once an upload lands. */
  onUploaded: (url: string) => void;
  /** Absent during the add flow, where the gift does not exist yet. */
  itemId?: string;
} & ListKeys) {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadPhoto,
    {},
  );
  // Measured here, on the file the picker handed us, rather than left to the
  // server: a photo straight off a phone is routinely over the limit, and
  // sending eight megabytes in order to be told so is a slow way to find out.
  const [tooBig, setTooBig] = useState<string | null>(null);
  // What we already know beats what came back from the last attempt.
  const problem = tooBig ?? state.error;

  // Hand the URL up and close once the photo lands; an error keeps the dialog
  // open so it can be read. Keyed on the URL alone, so a re-render never
  // reports the same upload twice.
  useEffect(() => {
    if (!state.url) return;
    onUploaded(state.url);
    dialogRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.url, dialogRef]);

  return (
    <Modal dialogRef={dialogRef} label={hasPhoto ? "Add another photo" : "Add a photo"}>
      <form action={action} className="p-6">
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="key" value={listKey} />
        {itemId ? <input type="hidden" name="itemId" value={itemId} /> : null}

        <h2 className="mb-2 font-display text-[1.5rem] leading-[1.1] tracking-[-.6px]">
          {hasPhoto ? "Add another photo" : "Add a photo"}
        </h2>
        <p className="mb-4 text-xs leading-[1.6] text-ink-72">
          JPEG, PNG, WebP, GIF or AVIF, up to {uploads.maxLabel}. Portrait crops
          look best.
        </p>

        <input
          type="file"
          name="photo"
          required
          accept={uploads.accept}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setTooBig(
              file && file.size > uploads.maxBytes
                ? `That photo is ${formatBytes(file.size)}, and the limit is ${uploads.maxLabel}. Try a smaller one, or a screenshot of it.`
                : null,
            );
          }}
          className="mb-4 w-full text-xs file:mr-3 file:rounded-pill file:border-0 file:bg-ink/[.06] file:px-4 file:py-2 file:text-xs file:font-semibold"
        />

        {problem ? (
          <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
            {problem}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending || tooBig !== null}
          className="mb-2 w-full"
        >
          {pending ? "Uploading…" : "Upload photo"}
        </Button>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="min-h-11 w-full text-center text-sm font-semibold text-ink-72"
        >
          Never mind
        </button>
      </form>
    </Modal>
  );
}

/**
 * An emoji for gifts that will never have a photo: cash, a contribution, a
 * favour. Suggestions come from the title, the way a list's emoji comes from
 * its name, and pressing the chosen one again clears it.
 */
export function GiftEmojiField({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string | null;
  onChange: (emoji: string | null) => void;
}) {
  const [debouncedTitle, setDebouncedTitle] = useState(title);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTitle(title), 300);
    return () => clearTimeout(timer);
  }, [title]);

  // A chosen emoji that isn't among the suggestions still belongs at the front,
  // or picking one and then editing the title would make it disappear.
  const suggestions = suggestGiftEmoji(debouncedTitle);
  const options =
    value && !suggestions.includes(value)
      ? [value, ...suggestions.slice(0, 4)]
      : suggestions;

  return (
    <div className="mb-4">
      <input type="hidden" name="emoji" value={value ?? ""} />
      <div className="flex flex-wrap items-center gap-[10px]">
        <span className="text-xs font-medium text-ink-66">
          {value ? "Shown instead of a photo:" : "No photo? Pick an emoji:"}
        </span>
        <div className="flex flex-wrap gap-[6px]">
          {options.map((option) => {
            const chosen = option === value;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={chosen}
                aria-label={chosen ? `Remove the ${option} emoji` : `Use ${option}`}
                onClick={() => onChange(chosen ? null : option)}
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-control text-lg transition-colors duration-150 ${
                  chosen
                    ? "border-[1.5px] border-violet bg-violet/10"
                    : "border border-ink-line bg-surface hover:bg-ink/[.03]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
