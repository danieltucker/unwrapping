import Link from "next/link";

import * as routes from "@/lib/routes";

/**
 * Offered to a guest who has reserved something or chipped in.
 *
 * The claim it makes has to be true: both are tied to a cookie in one browser,
 * and an account is what lifts them off it. See the userId columns on claims and
 * contributions; signing up links this browser's rows to the account.
 */
export function SavePrompt() {
  return (
    <aside className="rounded-card border border-violet-edge bg-violet-wash p-5">
      <p className="mb-1 text-base font-semibold">
        Keep this page if you switch browsers
      </p>
      <p className="mb-4 text-sm leading-relaxed text-ink-76">
        Right now what you&rsquo;ve reserved and chipped in is remembered only in
        this browser. Clear your cookies or open a different one and you&rsquo;ll
        lose track of what you promised to buy. An account ties it to you instead.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={routes.signUp}
          className="rounded-pill bg-violet px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
        >
          Create an account
        </Link>
        <Link
          href={routes.signIn}
          className="text-sm font-semibold text-ink-72 underline-offset-2 hover:underline"
        >
          I already have one
        </Link>
      </div>
      <p className="mt-3 text-xs text-ink-62">
        The list owner still won&rsquo;t see what you reserved or what you gave, and an
        account doesn&rsquo;t change that.
      </p>
    </aside>
  );
}
