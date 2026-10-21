import Link from "next/link";
import { connection } from "next/server";

import { isSantaSeason } from "@/lib/date";
import * as routes from "@/lib/routes";

/**
 * A thin strip pointing at Secret Santa, shown in season and not otherwise.
 *
 * Waits for a request before reading the date: a page rendered ahead of time
 * would otherwise keep whatever answer it got at build time all year.
 */
export async function SantaSeasonBanner() {
  await connection();
  if (!isSantaSeason()) return null;

  return (
    <aside
      aria-label="Secret Santa"
      className="border-b border-violet-edge bg-violet-wash px-[1.375rem] py-3 text-center text-sm sm:px-8"
    >
      <span aria-hidden="true">🎅 </span>
      It&rsquo;s Secret Santa season. Draw names for your group in a minute, free and
      with no app.{" "}
      <Link
        href={routes.secretSanta}
        className="whitespace-nowrap font-semibold text-violet underline-offset-2 hover:underline"
      >
        Start a Secret Santa →
      </Link>
    </aside>
  );
}
