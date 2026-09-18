"use client";

import { useActionState, useEffect, useRef, useState, type RefObject } from "react";

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
 *
 * usePhotoPaste is the third way in, and in practice the fastest one: copy a
 * screenshot, press paste, and it is already on the gift.
 */

type ListKeys = { handle: string; listKey: string };

/**
 * Reads an image off the clipboard and uploads it.
 *
 * A gift photo is very often a screenshot — of a listing, a text message, a
 * photo somebody sent — and the clipboard is where it already is. Making
 * someone save it to disk first, then find it again in a file picker, is three
 * steps around a thing the browser was willing to hand over directly.
 *
 * Bound to the window rather than to a field, because there is no single place
 * a paste would obviously belong: the panel is mostly a photo, and aiming at it
 * first is exactly the ceremony this removes.
 *
 * Text on the clipboard wins inside a text box. Someone pasting a link into the
 * title is pasting a link, even when a browser has also put the page's image on
 * the clipboard alongside it — and a paste that silently did something else
 * than type would be worse than no paste at all.
 */
export function usePhotoPaste({
  handle,
  listKey,
  itemId,
  onUploaded,
  enabled = true,
}: {
  /** Absent during the add flow, where the gift does not exist yet. */
  itemId?: string;
  /** Called with the stored URL once an upload lands. */
  onUploaded: (url: string) => void;
  /** False while this form is not the one on screen. */
  enabled?: boolean;
} & ListKeys) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Through a ref, so the listener is bound once rather than torn down and
  // rebuilt on every keystroke in the form around it. Kept up to date in an
  // effect rather than during render, which runs after every commit — so by the
  // time anyone can press paste, this is the callback the current render made.
  const landed = useRef(onUploaded);
  useEffect(() => {
    landed.current = onUploaded;
  });

  useEffect(() => {
    if (!enabled) return;

    async function onPaste(event: ClipboardEvent) {
      const file = imageOnClipboard(event.clipboardData);
      if (!file) return;

      // Only once we know we can use it: anything else on the clipboard is
      // still the browser's to handle.
      event.preventDefault();

      // Measured here rather than left to the server, for the same reason the
      // dialog measures it: sending eight megabytes in order to be told it is
      // too big is a slow way to find out.
      if (file.size > uploads.maxBytes) {
        setError(
          `That image is ${formatBytes(file.size)}, and the limit is ${uploads.maxLabel}.`,
        );
        return;
      }

      setError(null);
      setPending(true);

      const formData = new FormData();
      formData.set("handle", handle);
      formData.set("key", listKey);
      if (itemId) formData.set("itemId", itemId);
      formData.set("photo", file);

      try {
        // Wrapped for the same reason the dialog wraps it: a page left open
        // across a deploy calls an action id the server no longer has, and
        // losing the list over a pasted photo is the wrong trade.
        const result = await uploadPhoto({}, formData);
        if (result.error) setError(result.error);
        if (result.url) landed.current(result.url);
      } catch (uploadError) {
        console.error("[paste] the upload action itself failed:", uploadError);
        setError(
          "That didn't reach us. If this page has been open a while, reload it and try again.",
        );
      } finally {
        setPending(false);
      }
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enabled, handle, listKey, itemId]);

  return { pending, error };
}

/**
 * The image a paste is carrying, if it is carrying one.
 *
 * `files` is the dependable path in current browsers; `items` is read as well
 * because it is what some of them populate for an image copied out of a page
 * rather than off the desktop.
 */
function imageOnClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;

  // A paste with text in it, into something that takes text, is a text paste.
  const text = data.getData("text/plain").trim();
  if (text && isTextEntry(document.activeElement)) return null;

  for (const file of Array.from(data.files)) {
    if (file.type.startsWith("image/")) return file;
  }

  for (const item of Array.from(data.items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element.isContentEditable
  );
}

export function GiftPhotoField({
  images,
  selected,
  onSelect,
  emoji,
  onOpenUpload,
  pasting = false,
}: {
  images: string[];
  selected: number;
  onSelect: (index: number) => void;
  /** Shown in place of the photo when there is none. */
  emoji: string | null;
  onOpenUpload: () => void;
  /** A pasted screenshot is on its way up. See usePhotoPaste. */
  pasting?: boolean;
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
        {/* A paste can be aimed anywhere on the panel, so the answer to it has
            to appear where the photo is rather than where the cursor was. */}
        {pasting ? (
          <span
            className="absolute inset-0 flex flex-col items-center justify-center gap-[7px] bg-ink/72 text-2xs font-semibold text-paper"
            aria-live="polite"
          >
            <span className="h-[15px] w-[15px] animate-spin rounded-pill border-[2.5px] border-paper/30 border-t-paper" />
            Pasting…
          </span>
        ) : (
          <span className="absolute inset-x-0 bottom-0 bg-ink/72 py-[5px] text-2xs font-semibold text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            {preview ? "Change" : "Add a photo"}
          </span>
        )}
      </button>

      {/* Said once, quietly, under the control it applies to. Nobody guesses
          that a panel takes a paste unless it tells them. */}
      <p className="mb-2 text-2xs leading-[1.4] text-ink-62">
        Or paste a screenshot
      </p>

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
  // Wrapped rather than passed straight in, because useActionState does not
  // catch: anything the call itself throws goes to the nearest error boundary
  // and takes the page with it. That is not a theoretical failure — the request
  // is a POST to a Server Action identified by an id baked into this build, so
  // a page left open across a deploy or a dev restart calls an id the server no
  // longer has and gets a 404 it cannot parse. Losing the list over a failed
  // photo is the wrong trade; the dialog stays up and says what to do.
  const [state, action, pending] = useActionState<UploadState, FormData>(
    async (previous, formData) => {
      try {
        return await uploadPhoto(previous, formData);
      } catch (error) {
        console.error("[upload] the action itself failed:", error);
        return {
          error:
            "The upload didn't reach us. If this page has been open a while, reload it and try again.",
        };
      }
    },
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
          look best. If the image is already copied, you can just paste it —
          here or anywhere in this panel.
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
