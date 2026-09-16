"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  markGiftBought,
  releaseGift,
  reserveGift,
  type BoughtState,
  type ReserveState,
} from "@/app/lists/[handle]/[slug]/actions";
import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { GiftSummary } from "@/components/gift-summary";
import { Modal } from "@/components/modal";
import { BoxIcon, Button } from "@/components/ui";
import type { PublicItem } from "@/lib/claims";
import { visibility } from "@/lib/visibility";
import * as routes from "@/lib/routes";

export function ReserveDialog({
  item,
  handle,
  listKey,
  needsFirstName,
  emphasis,
  signedIn,
  surpriseMode,
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  needsFirstName: boolean;
  emphasis: "filled" | "outline";
  signedIn: boolean;
  surpriseMode: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ReserveState, FormData>(
    reserveGift,
    {},
  );

  // A guest is shown what they've just taken on and offered an account to keep
  // hold of it. Someone signed in already has that, so get out of their way.
  const offerAccount = Boolean(state.ok) && !signedIn;

  useEffect(() => {
    if (state.ok && signedIn) dialog.current?.close();
  }, [state.ok, signedIn]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={
          emphasis === "filled"
            ? "w-full rounded-pill bg-violet py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
            : "w-full rounded-pill border border-violet/45 py-3 text-sm font-semibold text-violet transition-colors duration-150 hover:bg-violet-wash"
        }
      >
        I&rsquo;ll get this one
      </button>

      <Modal dialogRef={dialog} labelledBy={`reserve-heading-${item.id}`}>
        {offerAccount ? (
          <div className="p-7">
            <p className="mb-2 rounded-control bg-pine-wash py-2.5 pl-3.5 pr-12 text-xs font-semibold text-pine-dark">
              ✓ Reserved. It now shows as taken to other guests
            </p>
            <h2 className="mb-2 font-display text-2xl leading-tight tracking-[-0.02em]">
              Don&rsquo;t lose track of it
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-ink-76">
              This reservation is remembered in this browser only. An account keeps
              it wherever you sign in, and the owner still won&rsquo;t see who
              reserved what.
            </p>
            <Link
              href={routes.signUp}
              className="mb-2 block rounded-pill bg-violet py-3.5 text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
            >
              Create an account
            </Link>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="w-full text-center text-sm font-semibold text-ink-72"
            >
              Not now
            </button>
          </div>
        ) : (
          <form action={action} className="p-7">
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="key" value={listKey} />
          <input type="hidden" name="itemId" value={item.id} />

          <GiftSummary item={item} />

          <h2
            id={`reserve-heading-${item.id}`}
            className="mb-2 font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]"
          >
            Reserve this gift?
          </h2>
          <p className="mb-5 text-sm leading-[1.7] text-ink/78">
            {visibility(surpriseMode).reserving}
          </p>

          {needsFirstName ? (
            <div className="mb-4">
              <label
                htmlFor={`first-name-${item.id}`}
                className="mb-[7px] block text-2xs font-semibold uppercase tracking-[.9px] text-ink-66"
              >
                First name, so guests can coordinate
              </label>
              <input
                id={`first-name-${item.id}`}
                name="firstName"
                required
                maxLength={40}
                className="w-full rounded-control border border-ink-line-strong bg-surface px-[14px] py-3 text-sm font-medium focus-ring"
              />
            </div>
          ) : null}

          {state.error ? (
            <p
              role="alert"
              className="mb-4 rounded-control bg-rose/10 px-[13px] py-[10px] text-xs font-medium text-rose-dark"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mb-3 w-full rounded-pill bg-violet py-[14px] text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover disabled:opacity-60"
          >
            {pending ? "Reserving…" : "Yes, reserve it"}
          </button>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="w-full text-center text-sm font-semibold text-ink-72"
          >
            Never mind
          </button>
          </form>
        )}
      </Modal>
    </>
  );
}

/**
 * Shown on a gift this guest holds, so they can hand it back.
 *
 * Geometry is the caller's: a gift card wants it full width, a reservation row
 * wants it matching the button beside it.
 */
export function ReleaseButton({
  itemId,
  handle,
  listKey,
  size = "md",
  className = "w-full",
}: {
  itemId: string;
  handle: string;
  listKey: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [state, action, pending] = useActionState<ReserveState, FormData>(
    releaseGift,
    {},
  );

  return (
    <form action={action} className={className}>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="key" value={listKey} />
      <input type="hidden" name="itemId" value={itemId} />
      <Button
        type="submit"
        variant="outline"
        size={size}
        disabled={pending}
        className="w-full text-ink-72"
      >
        {pending ? "Releasing…" : "Release it"}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-rose-dark">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Ticks a reserved gift off as bought, from the list page itself.
 *
 * On a surprise list this changes nothing the owner can see; on a list where
 * surprise is off it is how they know a gift is actually handled.
 *
 * Having just bought something is the moment you need somewhere to send it, so
 * a list with a delivery address hands it over here rather than making anyone
 * go looking. `deliveryAddress` is null unless the viewer holds this claim:
 * see PublicItem.
 */
export function BoughtButton({
  itemId,
  handle,
  listKey,
  bought,
  deliveryAddress = null,
  size = "md",
  className = "w-full",
}: {
  itemId: string;
  handle: string;
  listKey: string;
  bought: boolean;
  deliveryAddress?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const [state, action, pending] = useActionState<BoughtState, FormData>(
    markGiftBought,
    {},
  );
  const dialog = useRef<HTMLDialogElement>(null);
  // The same button un-marks a bought gift, and that way round has nothing to
  // say. Read at click time, because the prop flips under us on revalidation.
  const marking = useRef(false);

  useEffect(() => {
    if (state.ok && marking.current && deliveryAddress) {
      dialog.current?.showModal();
    }
    marking.current = false;
  }, [state, deliveryAddress]);

  return (
    <>
      <form action={action} className={className}>
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="key" value={listKey} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="bought" value={String(!bought)} />
        <Button
          type="submit"
          variant={bought ? "outline" : "dark"}
          size={size}
          disabled={pending}
          onClick={() => {
            marking.current = !bought;
          }}
          className={`w-full ${bought ? "text-pine-dark" : ""}`}
        >
          {bought ? "✓ Bought" : "Mark as bought"}
        </Button>
        {state.error ? (
          <p role="alert" className="mt-2 text-xs text-rose-dark">
            {state.error}
          </p>
        ) : null}
      </form>

      {deliveryAddress ? (
        <Modal dialogRef={dialog} labelledBy={`send-heading-${itemId}`}>
          <div className="p-7">
            <p className="mb-4 rounded-control bg-pine-wash py-2.5 pl-3.5 pr-12 text-xs font-semibold text-pine-dark">
              ✓ Marked as bought
            </p>

            <h2
              id={`send-heading-${itemId}`}
              className="mb-2 font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]"
            >
              Sending it directly?
            </h2>
            <p className="mb-5 text-sm leading-[1.7] text-ink/78">
              This list has a delivery address. Nobody is told you asked for it,
              and it stays on your reservations page if you need it again.
            </p>

            <div className="mb-5 flex items-start gap-3 rounded-[0.75rem] border border-violet-edge bg-violet-wash px-4 py-[0.8125rem]">
              <BoxIcon size={17} className="mt-0.5 shrink-0 text-violet" />
              <address className="flex-1 whitespace-pre-line text-sm not-italic leading-relaxed text-ink">
                {deliveryAddress}
              </address>
              <CopyButton value={deliveryAddress} className="shrink-0 rounded-pill bg-ink px-[13px] py-1.5 text-2xs font-semibold text-paper transition-colors duration-150 hover:bg-ink/90" />
            </div>

            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="w-full rounded-pill bg-violet py-[14px] text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
            >
              Done
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
