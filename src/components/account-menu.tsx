"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/sign-in/actions";

/** Two initials from a name: "Daniel Tucker" → "DT". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

export function AccountMenu({
  name,
  reservedCount,
  listsHref,
}: {
  name: string;
  reservedCount: number;
  listsHref: string;
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
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="flex h-8 w-8 items-center justify-center rounded-pill bg-violet text-xs font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
      >
        {initials(name)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-10 w-56 overflow-hidden rounded-card border border-ink-line bg-paper shadow-card"
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
