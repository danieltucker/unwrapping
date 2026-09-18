import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Not found" };

/**
 * A missing page, still inside the site.
 *
 * Reached by `notFound()` as well as by a bad address, so the two most likely
 * readers are someone following a share link to a list that has been deleted,
 * and someone with an old bookmark. Both want the same two ways out.
 */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-16 text-center">
      <p className="mb-3 text-[2.5rem] leading-none" aria-hidden="true">
        🔍
      </p>
      <h1 className="mb-[10px] font-display text-[2rem] leading-[1.1] tracking-[-.8px]">
        Nothing here
      </h1>
      <p className="mb-6 text-sm leading-[1.7] text-ink-76">
        This page doesn&rsquo;t exist, or the list it pointed at has been taken
        down by whoever made it.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-[10px]">
        <ButtonLink href="/new">Start a list</ButtonLink>
        <Link
          href="/"
          className="rounded-pill border border-ink-line-strong px-[17px] py-3 text-sm font-semibold transition-colors duration-150 hover:bg-ink/[.03]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
