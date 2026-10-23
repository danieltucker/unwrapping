import type { ReactNode } from "react";

import { CapsLabel } from "@/components/ui";

/*
 * The furniture of /admin's tabs. Every section is the same shape, so it is
 * written once.
 */

export function Pill({ tone, children }: { tone: "ink" | "violet" | "rose"; children: ReactNode }) {
  const tones = {
    ink: "bg-ink/[.06] text-ink-72",
    violet: "bg-violet-wash text-violet-hover",
    rose: "bg-rose-wash text-rose",
  };
  return (
    <span
      className={`ml-2 rounded-pill px-2 py-0.5 align-middle text-2xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  count,
  empty,
  note,
  before,
  bare = false,
  always = false,
  children,
}: {
  title: string;
  count: number;
  /** Shown instead of the rows on a fresh instance, which is the usual case. */
  empty: string;
  /** A line beside the heading, where a total says more than the count does. */
  note?: string;
  /** Sits between the heading and the rows: the "add one" form, where there is one. */
  before?: ReactNode;
  /** The children lay themselves out, rather than being rows in a list. */
  bare?: boolean;
  /** Shows the children even at a count of zero, for a section that explains its own emptiness. */
  always?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[1.375rem] leading-[1.15] tracking-[-0.02em]">
          {title}
          <span className="ml-2 align-middle text-sm font-semibold text-ink-62">
            {count}
          </span>
        </h2>
        {note ? <CapsLabel>{note}</CapsLabel> : null}
      </div>

      {before ? <div className="mb-2.5">{before}</div> : null}

      {count === 0 && !always ? (
        <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-10 text-center text-sm text-ink-72">
          {empty}
        </p>
      ) : bare ? (
        children
      ) : (
        <ul className="flex flex-col gap-2.5">{children}</ul>
      )}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-card border border-ink-line bg-surface px-5 py-4 sm:flex-nowrap">
      {children}
    </li>
  );
}

/** "3 lists", "1 gift". Every count on these pages is something about to be lost. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * "16 Sep 2025". The year is here because this is the one screen where the rows
 * from two years ago are the interesting ones, which is why it isn't
 * `formatShortDate`.
 */
export function stamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * "412KB", "1.8MB". `formatBytes` in config/site is for telling somebody how far
 * over the 8MB limit their photo is, so it works in megabytes and would read
 * "0.0MB" for most of what is actually on this disk.
 */
export function fileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes}B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)}KB`;
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}
