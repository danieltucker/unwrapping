"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/sign-in/actions";
import { Avatar } from "@/components/ui";

export function AccountMenu({
  name,
  avatarUrl,
  reservedCount,
  listsHref,
  profileHref,
  adminHref,
}: {
  name: string;
  /** Their own photo, or null for the circle of initials. */
  avatarUrl: string | null;
  reservedCount: number;
  listsHref: string;
  profileHref: string;
  /** Only set for whoever runs the instance; nobody else is offered the screen. */
  adminHref?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Close on Escape or a click elsewhere; a menu that traps you is worse
  // than no menu.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="relative" ref={container}>
      {/* The colours are the bar's, inherited: this same control sits on the
          violet header and on the paper one. See globals.css. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="flex rounded-pill transition-opacity duration-150 hover:opacity-90 focus-ring"
      >
        <Avatar name={name} url={avatarUrl} size={32} />
      </button>

      {open ? (
        /* The panel hangs below the bar, over the page, so it keeps the
           product's own light surface on either tone. */
        <div
          role="menu"
          className="absolute right-0 top-10 z-10 w-56 overflow-hidden rounded-card border border-ink-line bg-paper text-ink shadow-card"
        >
          <p className="border-b border-ink-line px-4 py-3 text-xs text-ink-62">
            Signed in as <span className="font-semibold text-ink">{name}</span>
          </p>

          <Link
            href={listsHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium hover:bg-ink/[.03]"
          >
            My lists
          </Link>

          <Link
            href="/reserved"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-ink/[.03]"
          >
            Gifts I&rsquo;ve reserved
            {reservedCount > 0 ? (
              <span className="rounded-pill bg-violet/10 px-2 py-0.5 text-xs font-semibold text-violet-hover">
                {reservedCount}
              </span>
            ) : null}
          </Link>

          <Link
            href={profileHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium hover:bg-ink/[.03]"
          >
            Your profile
          </Link>

          {adminHref ? (
            /* Separated from the three entries above it: those are this
               person's own things, and this one is everybody's. */
            <Link
              href={adminHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block border-t border-ink-line px-4 py-3 text-sm font-medium hover:bg-ink/[.03]"
            >
              Admin
            </Link>
          ) : null}

          <form action={signOut} className="border-t border-ink-line">
            <button
              type="submit"
              role="menuitem"
              className="w-full px-4 py-3 text-left text-sm font-medium text-ink-72 hover:bg-ink/[.03]"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
