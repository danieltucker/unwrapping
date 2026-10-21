import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Secret Santa not found" };

/**
 * A Secret Santa that isn't there: deleted by its organiser, a link mistyped,
 * or a dashboard opened by someone who didn't organise it — which is told the
 * same thing on purpose, so a guess can't confirm a code exists.
 */
export default function SecretSantaNotFound() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-16 text-center">
      <p className="mb-3 text-[2.5rem] leading-none" aria-hidden="true">
        🎄
      </p>
      <h1 className="mb-[10px] font-display text-[2rem] leading-[1.1] tracking-[-.8px]">
        This Secret Santa isn&rsquo;t here
      </h1>
      <p className="mb-6 text-sm leading-[1.7] text-ink-76">
        The link may be mistyped, or the organiser may have deleted it. If you were
        given a private link, try opening that one again.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-[10px]">
        <ButtonLink href="/secret-santa/new">Start your own</ButtonLink>
        <Link
          href="/secret-santa"
          className="rounded-pill border border-ink-line-strong px-[17px] py-3 text-sm font-semibold transition-colors duration-150 hover:bg-ink/[.03]"
        >
          Your Secret Santas
        </Link>
      </div>
    </main>
  );
}
