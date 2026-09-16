import type { Metadata } from "next";
import Link from "next/link";

import { ReservationRow } from "@/components/reservation-row";
import { SavePrompt } from "@/components/save-prompt";
import { EyeOffIcon } from "@/components/ui";
import { site } from "@/config/site";
import { formatEventDate } from "@/lib/date";
import { getGuestReservations } from "@/lib/reservations";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Gifts you've reserved",
  // Nothing here should ever appear in a search result.
  robots: { index: false, follow: false },
};

export default async function ReservedPage() {
  const [{ reservations, invitedLists }, user] = await Promise.all([
    getGuestReservations(),
    getCurrentUser(),
  ]);

  const dateFormat = new Intl.DateTimeFormat(site.locale, {
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto w-full max-w-[46rem] px-[1.375rem] py-10">
      <h1 className="mb-2 font-display text-[1.875rem] leading-[1.1] tracking-[-0.03em]">
        Gifts you&rsquo;ve reserved
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-ink-76">
        {user
          ? "Only you can see this page. It follows your account, so it's here on any browser you sign into."
          : "Only you can see this page. It's remembered in this browser, so use the same one to come back to it."}
      </p>

      {reservations.length === 0 ? (
        <div className="rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center">
          <p className="mb-2 text-base font-semibold">Nothing reserved yet</p>
          <p className="text-sm leading-relaxed text-ink-72">
            When you reserve a gift from someone&rsquo;s list, it shows up here so
            you can find it again.
          </p>
        </div>
      ) : (
        <>
          {/* Offered only to guests: an account is what lifts these off the cookie. */}
          {!user ? (
            <div className="mb-5">
              <SavePrompt count={reservations.length} />
            </div>
          ) : null}

          <ul className="mb-7 flex flex-col gap-2.5">
            {reservations.map((reservation) => (
              <ReservationRow
                key={reservation.claimId}
                reservation={reservation}
                eventLine={[
                  reservation.listName,
                  formatEventDate(reservation.eventDate),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                reservedOn={dateFormat.format(reservation.claimedAt)}
              />
            ))}
          </ul>

          <div className="mb-7 flex items-center gap-3 rounded-[0.75rem] border border-violet-edge bg-violet-wash px-4 py-3">
            <EyeOffIcon className="shrink-0 text-violet" />
            <p className="text-xs leading-relaxed text-ink/80">
              The list owner still sees nothing — not what you reserved, and not
              that it was you. Releasing a gift puts it straight back on the list.
            </p>
          </div>
        </>
      )}

      {invitedLists.length > 0 ? (
        <section className="border-t border-ink-line pt-6">
          <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-62">
            Lists you&rsquo;ve been invited to
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {invitedLists.map((list) => (
              <Link
                key={list.path}
                href={list.path}
                className="min-w-[12.5rem] flex-1 rounded-[0.75rem] border border-ink-line bg-surface p-4 transition-colors duration-150 hover:bg-ink/[.02]"
              >
                <p className="mb-1 text-sm font-semibold">
                  {list.emoji} {list.name}
                </p>
                <p className="text-xs text-ink-72">
                  {list.freeCount} {list.freeCount === 1 ? "gift" : "gifts"} still
                  free
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
