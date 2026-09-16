"use client";

import type { ReactNode, RefObject } from "react";

import { CloseIcon } from "@/components/ui";

/**
 * Every modal in the product, so they all dismiss the same way.
 *
 * `<dialog>` gives focus trapping and Escape for free; this adds the two ways
 * people actually reach for: a close control that is always in the same
 * corner, and a click on the backdrop. The panels themselves still differ, so
 * the chrome is all this owns.
 *
 * The close button is last in the DOM and positioned over the panel, so
 * opening a dialog still puts focus on the first field rather than on a way
 * out of it.
 */

const WIDTHS = {
  sm: "w-[min(29rem,calc(100vw-2rem))]",
  md: "w-[min(30rem,calc(100vw-2rem))]",
  lg: "w-[min(34rem,calc(100vw-2rem))]",
} as const;

export function Modal({
  dialogRef,
  size = "sm",
  labelledBy,
  label,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  size?: keyof typeof WIDTHS;
  /** Id of the panel's own heading. Use `label` where there isn't one. */
  labelledBy?: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-label={label}
      // A click lands on the dialog itself only when it misses the panel,
      // which is the backdrop.
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className={`relative rounded-card border border-ink-line bg-paper p-0 text-left text-ink shadow-card backdrop:bg-ink/40 ${WIDTHS[size]}`}
    >
      {children}

      <button
        type="button"
        onClick={() => dialogRef.current?.close()}
        aria-label="Close"
        className="absolute right-[13px] top-[13px] flex h-8 w-8 items-center justify-center rounded-pill border border-ink-line bg-surface text-ink-62 transition-colors duration-150 hover:bg-ink/[.05] hover:text-ink focus-ring"
      >
        <CloseIcon />
      </button>
    </dialog>
  );
}
