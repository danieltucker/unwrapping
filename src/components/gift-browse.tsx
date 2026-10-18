import Link from "next/link";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui";
import type { CategoryWithCount } from "@/lib/guides";
import * as routes from "@/lib/routes";

/**
 * The furniture shared by /gifts and each category's shelf: the ink banner at
 * the top, the row of categories, and the closing nudge to make one.
 */

export function BrowseBanner({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
}) {
  return (
    <section className="bg-ink px-[1.375rem] py-12 text-paper sm:px-8 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-[72rem]">
        <p className="mb-3 text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
          {eyebrow}
        </p>
        <h1 className="mb-4 max-w-[40rem] font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em] text-paper sm:text-[3.25rem]">
          {title}
        </h1>
        <p className="mb-7 max-w-[38rem] text-base leading-[1.7] text-paper-72">{intro}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <ButtonLink href={routes.newGiftGuide}>Make a gift list</ButtonLink>
          <Link
            href={routes.newList}
            className="text-sm font-semibold text-paper underline-offset-2 hover:underline"
          >
            Or start a wishlist for yourself
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CategoryChips({
  categories,
  current,
}: {
  categories: CategoryWithCount[];
  /** The shelf being looked at, drawn as selected rather than as a link to itself. */
  current?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2.5">
      <li>
        <Link
          href={routes.giftGuides}
          aria-current={current === undefined ? "page" : undefined}
          className={chip(current === undefined)}
        >
          Everything
        </Link>
      </li>
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={routes.giftCategory(category.slug)}
            aria-current={current === category.slug ? "page" : undefined}
            className={chip(current === category.slug)}
          >
            <span aria-hidden="true">{category.emoji}</span>
            {category.name}
            {category.guideCount > 0 ? (
              <span className="text-xs font-medium opacity-70">{category.guideCount}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function chip(selected: boolean): string {
  return `inline-flex items-center gap-2 rounded-pill border px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
    selected
      ? "border-violet bg-violet text-white"
      : "border-ink-line-strong bg-surface hover:border-violet hover:bg-violet-wash"
  }`;
}

export function MakeOneCta() {
  return (
    <section className="mt-12 rounded-card border border-violet-edge bg-violet-wash p-6 sm:p-8">
      <h2 className="mb-2 font-display text-[1.75rem] leading-[1.1] tracking-[-0.02em]">
        Know what makes a great gift?
      </h2>
      <p className="mb-5 max-w-[38rem] text-sm leading-[1.7] text-ink-76">
        Put together a list for the kind of person you know best — the climber,
        the new parent, the one who already has everything — and it goes up here
        for anyone to buy from or copy.
      </p>
      <ButtonLink href={routes.newGiftGuide}>Make a gift list</ButtonLink>
    </section>
  );
}
