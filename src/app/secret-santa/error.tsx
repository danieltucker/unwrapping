"use client";

import Link from "next/link";

import { Button } from "@/components/ui";

/**
 * Anything that throws under /secret-santa, said in Secret Santa terms. The
 * important reassurance is the second sentence: a draw that has been made is
 * kept, so an error is never a reason to draw again.
 */
export default function SecretSantaError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, as in src/app/error.tsx: this version re-fetches the segment.
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-16 text-center">
      <p className="mb-3 text-[2.5rem] leading-none" aria-hidden="true">
        🎅
      </p>
      <h1 className="mb-[10px] font-display text-[2rem] leading-[1.1] tracking-[-.8px]">
        That didn&rsquo;t work
      </h1>
      <p className="mb-6 text-sm leading-[1.7] text-ink-76">
        Something went wrong at our end, not yours. Who&rsquo;s in and any names
        already drawn are safe, so there&rsquo;s no need to draw again.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-[10px]">
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
        <Link
          href="/secret-santa"
          className="rounded-pill border border-ink-line-strong px-[17px] py-3 text-sm font-semibold transition-colors duration-150 hover:bg-ink/[.03]"
        >
          Your Secret Santas
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-2xs text-ink-62">Reference {error.digest}</p>
      ) : null}
    </main>
  );
}
