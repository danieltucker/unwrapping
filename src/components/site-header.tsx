import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu } from "@/components/account-menu";
import { HeaderBar } from "@/components/header-bar";
import { isAdminEmail } from "@/lib/admin";
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
 * The bar and the mark are static, so they are deliberately kept outside the
 * boundary below: a layout that awaited the session before painting anything
 * would stall every navigation on a cookie read. Their colours come from
 * HeaderBar, which is the piece that knows which page it is sitting on.
 */
export function SiteHeader() {
  return (
    <HeaderBar>
      {/* The placeholder is the height of the tallest control in the cluster,
          so the header doesn't resize when identity resolves. */}
      <Suspense fallback={<div className="h-8" aria-hidden="true" />}>
        <Identity />
      </Suspense>
    </HeaderBar>
  );
}

/**
 * The top right belongs to identity: an avatar when signed in, and otherwise
 * the way in. A guest's reservations are reachable either way, because losing
 * track of what you promised to buy is the easiest way to spoil a party.
 *
 * Nothing here names a colour. Every one of them is a `--header-*` property
 * inherited from the bar, so this cluster reads correctly on either tone
 * without knowing which one it is on.
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
          className="inline-flex items-center gap-2 rounded-pill border border-(--header-line) bg-(--header-pill) px-3.5 py-2 text-xs font-semibold transition-colors duration-150 hover:bg-(--header-wash)"
        >
          <TagIcon />
          Reserved
          <span className="rounded-pill bg-(--header-wash) px-1.5 py-0.5 text-xs font-semibold">
            {reservedCount}
          </span>
        </Link>
      ) : null}

      {user ? (
        <AccountMenu
          name={user.name}
          avatarUrl={user.avatarUrl}
          reservedCount={reservedCount}
          listsHref={routes.myLists}
          profileHref={routes.profile}
          adminHref={isAdminEmail(user.email) ? routes.admin : null}
        />
      ) : (
        <>
          <Link
            href={routes.signIn}
            className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-(--header-muted) -my-2 hover:text-(--header-fg) sm:min-h-0 sm:my-0"
          >
            Sign in
          </Link>
          <Link
            href={routes.newList}
            className="rounded-pill bg-(--header-accent) px-4 py-2 text-xs font-semibold text-(--header-accent-fg) transition-colors duration-150 hover:bg-(--header-accent-hover)"
          >
            Start a list
          </Link>
        </>
      )}
    </div>
  );
}
