"use client";

import Link from "next/link";
import { useActionState } from "react";

import { markBought, type MarkBoughtState } from "@/app/reserved/actions";
import { ReleaseButton } from "@/components/reserve-dialog";
import { Button } from "@/components/ui";
import { formatPrice } from "@/config/site";
import type { Reservation } from "@/lib/reservations";

export function ReservationRow({
  reservation,
  eventLine,
  reservedOn,
}: {
  reservation: Reservation;
  eventLine: string;
  reservedOn: string;
}) {
  const [state, action, pending] = useActionState<MarkBoughtState, FormData>(
    markBought,
    {},
  );

  return (
    <li className="flex gap-4 rounded-[12px] border border-ink-line bg-surface p-[18px]">
      <div className="h-20 w-[66px] shrink-0 overflow-hidden rounded-[8px] bg-ink/[.05]">
        {reservation.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reservation.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={reservation.listPath}
          className="mb-[6px] flex items-center gap-2 text-2xs font-semibold uppercase tracking-[1.3px] text-ink-62 hover:text-ink-76"
        >
          <span className="text-sm">{reservation.listEmoji}</span>
          {eventLine}
        </Link>

        <p className="mb-[5px] text-base font-semibold">
          {reservation.title}
          {reservation.priceCents !== null ? (
            <span className="font-normal text-ink-72">
              {" · "}
              {formatPrice(reservation.priceCents)}
            </span>
          ) : null}
        </p>

        {/* Said here as well as on the list, because this page is where people
            come back to days later and the two lists may differ. */}
        {!reservation.listIsSurprise ? (
          <p className="mb-[7px] text-xs font-medium text-ink-62">
            This list isn&rsquo;t a surprise: its owner can see the gift is taken,
            never that it was you.
          </p>
        ) : null}

        <p className="mb-[13px] text-xs text-ink-72">
          Reserved by you on {reservedOn}
          {reservation.href ? (
            <>
              {" · "}
              <a
                href={reservation.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-violet hover:text-violet-hover"
              >
                {reservation.sourceDomain} ↗
              </a>
            </>
          ) : null}
        </p>

        {/* Both actions share one size, so they line up whatever the label says. */}
        <div className="flex flex-wrap items-center gap-2">
          <form action={action}>
            <input type="hidden" name="claimId" value={reservation.claimId} />
            <input
              type="hidden"
              name="bought"
              value={String(!reservation.markedBought)}
            />
            <Button
              type="submit"
              size="sm"
              variant={reservation.markedBought ? "outline" : "dark"}
              disabled={pending}
              className={reservation.markedBought ? "text-pine-dark" : undefined}
            >
              {reservation.markedBought ? "✓ Bought" : "Mark as bought"}
            </Button>
          </form>

          <ReleaseButton
            itemId={reservation.itemId}
            handle={reservation.handle}
            listKey={reservation.listKey}
            size="sm"
            className=""
          />
        </div>

        {state.error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-rose-dark">
            {state.error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
