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
      // `fixed` rather than `relative`, which is not a style choice. An element
      // in the top layer whose position computes to `static` or `relative` is
      // promoted to `absolute`, and an absolute box is placed against the
      // document rather than the window — so `margin: auto` centres the panel
      // on the top of the page, and opening a dialog from a gift halfway down a
      // list puts it `scrollY` pixels above the screen, with the close button
      // out of reach. `fixed` is what the browser's own rule for a modal
      // dialog asks for, and it still anchors the close button below.
      className={`fixed rounded-card border border-ink-line bg-paper p-0 text-left text-ink shadow-card backdrop:bg-ink/40 ${WIDTHS[size]}`}
    >
      {children}

      <button
        type="button"
        onClick={() => dialogRef.current?.close()}
        aria-label="Close"
        // The circle stays 32px, which is what the design asks for. The `before`
        // ring is an invisible 44px tap target over the top of it, so a thumb
        // that lands near the corner still closes the panel.
        className="absolute right-[13px] top-[13px] flex h-8 w-8 items-center justify-center rounded-pill border border-ink-line bg-surface text-ink-62 transition-colors duration-150 before:absolute before:-inset-1.5 before:content-[''] hover:bg-ink/[.05] hover:text-ink focus-ring"
      >
        <CloseIcon />
      </button>
    </dialog>
  );
}
