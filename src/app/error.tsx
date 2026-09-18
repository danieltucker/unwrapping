"use client";

import Link from "next/link";

import { Button } from "@/components/ui";

/**
 * Anything that throws while rendering a page, inside the site's own chrome.
 *
 * Without this, a thrown error takes the whole document with it: Next serves
 * its own black page with a digest on it, which looks like the site has fallen
 * over rather than like one thing having gone wrong. The header stays, the
 * background stays, and there is a way onward.
 *
 * The digest is shown deliberately, in small print. It is the only handle on
 * what actually happened — `docker compose logs` records the same string
 * against the stack trace — and someone reporting a problem can quote it.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, not `reset`: this version re-fetches the segment rather than only
  // clearing the boundary. See node_modules/next/dist/docs/.../error.md.
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-16 text-center">
      <p className="mb-3 text-[2.5rem] leading-none" aria-hidden="true">
        🎁
      </p>
      <h1 className="mb-[10px] font-display text-[2rem] leading-[1.1] tracking-[-.8px]">
        That didn&rsquo;t work
      </h1>
      <p className="mb-6 text-sm leading-[1.7] text-ink-76">
        Something went wrong at our end, not yours. Nothing you had already saved
        is affected.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-[10px]">
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
        <Link
          href="/lists"
          className="rounded-pill border border-ink-line-strong px-[17px] py-3 text-sm font-semibold transition-colors duration-150 hover:bg-ink/[.03]"
        >
          My lists
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-2xs text-ink-62">
          Reference {error.digest}
        </p>
      ) : null}
    </main>
  );
}
