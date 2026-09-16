import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
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
 * One header for every page.
 *
 * The top right belongs to identity: an avatar when signed in, and otherwise
 * the way in. A guest's reservations are reachable either way, because losing
 * track of what you promised to buy is the easiest way to spoil a party.
 */
export async function SiteHeader() {
  const [user, reservedCount] = await Promise.all([
    getCurrentUser(),
    countGuestReservations(),
  ]);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-ink-line px-[1.375rem] py-3 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-[0.45rem] bg-ink text-xs font-bold text-paper">
          {site.name.charAt(0)}
        </span>
        <span className="text-sm font-bold tracking-[-0.01em]">{site.name}</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* A guest with reservations gets a real control, not a line of prose. */}
        {reservedCount > 0 && !user ? (
          <Link
            href="/reserved"
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
              className="px-2 text-xs font-semibold text-ink-76 hover:text-ink"
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
    </header>
  );
}
