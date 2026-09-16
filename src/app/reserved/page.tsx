import type { Metadata } from "next";
import Link from "next/link";

import { ContributionRow } from "@/components/contribution-row";
import { DeliveryAddressPanel } from "@/components/delivery-address-panel";
import {
  PaymentDetailsPanel,
  type PaymentDetails,
} from "@/components/payment-details-panel";
import { ReservationRow } from "@/components/reservation-row";
import { SavePrompt } from "@/components/save-prompt";
import { EyeOffIcon } from "@/components/ui";
import { formatEventDate, formatShortDate } from "@/lib/date";
import { getGuestContributions } from "@/lib/contributions";
import { getGuestReservations } from "@/lib/reservations";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Gifts you've reserved",
  // Nothing here should ever appear in a search result.
  robots: { index: false, follow: false },
};

export default async function ReservedPage() {
  const [{ reservations, invitedLists, addresses }, contributions, user] =
    await Promise.all([
      getGuestReservations(),
      getGuestContributions(),
      getCurrentUser(),
    ]);

  /** The caps line above a row: which list, and when the event is. */
  const eventLine = (name: string, date: Date | null) =>
    [name, formatEventDate(date)].filter(Boolean).join(" · ");

  // One line per list, however many cash gifts on it were chipped in on.
  const payments = [
    ...new Map<string, PaymentDetails>(
      contributions
        .filter((c) => c.paymentDetails !== null)
        .map((c) => [
          c.listPath,
          {
            listName: c.listName,
            listEmoji: c.listEmoji,
            ownerName: c.ownerName,
            details: c.paymentDetails as string,
          },
        ]),
    ).values(),
  ];

  const nothingYet = reservations.length === 0 && contributions.length === 0;

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

      {nothingYet ? (
        <div className="rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center">
          <p className="mb-2 text-base font-semibold">Nothing reserved yet</p>
          <p className="text-sm leading-relaxed text-ink-72">
            When you reserve a gift or chip in toward one, it shows up here so you
            can find it again.
          </p>
        </div>
      ) : (
        <>
          {/* Offered only to guests: an account is what lifts these off the cookie. */}
          {!user ? (
            <div className="mb-5">
              <SavePrompt />
            </div>
          ) : null}

          {reservations.length > 0 ? (
            <ul className="mb-7 flex flex-col gap-2.5">
              {reservations.map((reservation) => (
                <ReservationRow
                  key={reservation.claimId}
                  reservation={reservation}
                  eventLine={eventLine(reservation.listName, reservation.eventDate)}
                  reservedOn={formatShortDate(reservation.claimedAt)}
                />
              ))}
            </ul>
          ) : null}

          {contributions.length > 0 ? (
            <section className="mb-7">
              <h2 className="mb-3 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-62">
                Group gifts you&rsquo;ve chipped in on
              </h2>
              <ul className="flex flex-col gap-2.5">
                {contributions.map((contribution) => (
                  <ContributionRow
                    key={contribution.itemId}
                    contribution={contribution}
                    eventLine={eventLine(
                      contribution.listName,
                      contribution.eventDate,
                    )}
                    chippedOn={formatShortDate(contribution.lastChippedAt)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Both sit with what they belong to, above the general promise. */}
          {payments.length > 0 ? <PaymentDetailsPanel payments={payments} /> : null}

          {addresses.length > 0 ? (
            <DeliveryAddressPanel addresses={addresses} />
          ) : null}

          <div className="mb-7 flex items-center gap-3 rounded-[0.75rem] border border-violet-edge bg-violet-wash px-4 py-3">
            <EyeOffIcon className="shrink-0 text-violet" />
            <p className="text-xs leading-relaxed text-ink/80">
Nobody is ever told who reserved or gave what. On a surprise list the owner
              doesn&rsquo;t even see which gifts are taken. Releasing a gift puts it
              straight back on the list.
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
