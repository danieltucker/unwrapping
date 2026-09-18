import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu } from "@/components/account-menu";
import { BrandMark } from "@/components/ui";
import { site } from "@/config/site";
import { countGuestReservations } from "@/lib/reservations";
import * as routes from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";

/** Gift-tag mark, so the reservations entry reads as a thing, not a sentence. */
function TagIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2.5 9V3.5a1 1 0 0 1 1-1H9l8 8-6.5 6.5-8-8Z" />
      <circle cx="6" cy="6" r="1.2" />
    </svg>
  );
}

/**
 * One header for every page. The root layout renders it once, so a new page
 * gets it by existing rather than by remembering to import it.
 *
 * The mark is static, so it is deliberately kept outside the boundary below:
 * a layout that awaits the session before painting anything would stall every
 * navigation on a cookie read.
 */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-ink-line px-[1.375rem] py-3 sm:px-8">
      {/* The pills here are already thumb-sized; the plain text links are not,
          and a 16px-tall tap target is the one people miss. On a phone those
          carry a 44px touch area, spent against the header's own padding by the
          negative margin rather than on the row, so nothing looks any different
          or moves. From `sm` up, where there is a pointer, it goes back. */}
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2.5 -my-2.5 sm:min-h-0 sm:my-0"
      >
        <BrandMark size={24} />
        <span className="text-sm font-bold tracking-[-0.01em]">{site.name}</span>
      </Link>

      {/* The placeholder is the height of the tallest control in the cluster,
          so the header doesn't resize when identity resolves. */}
      <Suspense fallback={<div className="h-8" aria-hidden="true" />}>
        <Identity />
      </Suspense>
    </header>
  );
}

/**
 * The top right belongs to identity: an avatar when signed in, and otherwise
 * the way in. A guest's reservations are reachable either way, because losing
 * track of what you promised to buy is the easiest way to spoil a party.
 */
async function Identity() {
  const [user, reservedCount] = await Promise.all([
    getCurrentUser(),
    countGuestReservations(),
  ]);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* A guest with reservations gets a real control, not a line of prose. */}
      {reservedCount > 0 && !user ? (
        <Link
          href={routes.reserved}
          className="inline-flex items-center gap-2 rounded-pill border border-ink-line-strong bg-surface px-3.5 py-2 text-xs font-semibold transition-colors duration-150 hover:bg-ink/[.03]"
        >
          <TagIcon />
          Reserved
          <span className="rounded-pill bg-violet/10 px-1.5 py-0.5 text-xs font-semibold text-violet-hover">
            {reservedCount}
          </span>
        </Link>
      ) : null}

      {user ? (
        <AccountMenu
          name={user.name}
          reservedCount={reservedCount}
          listsHref={routes.myLists}
        />
      ) : (
        <>
          <Link
            href={routes.signIn}
            className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-ink-76 -my-2 hover:text-ink sm:min-h-0 sm:my-0"
          >
            Sign in
          </Link>
          <Link
            href={routes.newList}
            className="rounded-pill bg-violet px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
          >
            Start a list
          </Link>
        </>
      )}
    </div>
  );
}
