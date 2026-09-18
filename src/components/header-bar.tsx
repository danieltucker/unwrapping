"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/ui";
import { site } from "@/config/site";

/**
 * The bar itself, and the one decision it makes: which way round it is.
 *
 * The rule is that the header is the inverse of the page under it. Nearly every
 * screen is paper, so nearly every screen gets the violet bar. The exception is
 * the guest's view of a list, which opens with the dark rail: putting a third
 * colour above that turns the top of the page into a stack of bands, so there
 * the bar stays paper and the page leads.
 *
 * Client, because the route is the only thing that answers the question and a
 * Server Component cannot read it — that restriction is deliberate in Next, so
 * layout state survives navigation. The identity cluster inside is still
 * rendered on the server and arrives here as children; what it can't be handed
 * as a prop it inherits as CSS, through the `--header-*` custom properties the
 * tone sets. See globals.css.
 */

type Tone = "paper" | "violet";

/**
 * /lists/<handle>/<slug> exactly: the list as a guest sees it.
 *
 * Its /manage and /share screens sit one and two segments deeper and are the
 * owner's own, drawn on paper like the rest of the product, so they are not
 * matched here. Neither is /lists, the dashboard.
 */
function toneFor(pathname: string): Tone {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 3 && segments[0] === "lists" ? "paper" : "violet";
}

export function HeaderBar({ children }: { children: ReactNode }) {
  const tone = toneFor(usePathname());

  return (
    <header
      className={`flex items-center justify-between gap-4 border-b px-[1.375rem] py-3 sm:px-8 ${
        tone === "violet" ? "header-violet" : "header-paper"
      } bg-(--header-bg) border-(--header-border) text-(--header-fg)`}
    >
      {/* The pills here are already thumb-sized; the plain text links are not,
          and a 16px-tall tap target is the one people miss. On a phone those
          carry a 44px touch area, spent against the header's own padding by the
          negative margin rather than on the row, so nothing looks any different
          or moves. From `sm` up, where there is a pointer, it goes back. */}
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2.5 -my-2.5 sm:min-h-0 sm:my-0"
      >
        <BrandMark size={24} inverted={tone === "violet"} />
        <span className="text-sm font-bold tracking-[-0.01em]">{site.name}</span>
      </Link>

      {children}
    </header>
  );
}
