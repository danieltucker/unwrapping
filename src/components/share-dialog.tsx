"use client";

import { useRef, type ReactNode } from "react";

import { Button, LinkIcon } from "@/components/ui";

/**
 * The editor's Share control.
 *
 * The link, the QR and the invite route all live behind this one button rather
 * than along the top of the page: sharing is a moment, not a permanent fixture,
 * and the owner's screen is for working on the list.
 *
 * The panel itself is rendered on the server and handed in as children, so the
 * QR never has to be generated in the browser.
 */
export function ShareDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => dialog.current?.showModal()}
        className="gap-2"
      >
        <LinkIcon className="text-ink-62" />
        Share
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby="share-heading"
        className="w-[min(30rem,calc(100vw-2rem))] rounded-card border border-ink-line bg-paper p-0 text-ink shadow-card backdrop:bg-ink/40"
      >
        <div className="p-7">
          <h2
            id="share-heading"
            className="mb-1 font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]"
          >
            Share your list
          </h2>
          <p className="mb-6 text-sm leading-[1.65] text-ink-76">
            Anyone with the link can open the list and reserve from it. No account,
            no sign-up.
          </p>

          {children}

          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="mt-6 w-full text-center text-sm font-semibold text-ink-72"
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
