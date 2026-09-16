"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { chipIn, type ChipInState } from "@/app/lists/[handle]/[slug]/actions";
import { FundingBar } from "@/components/funding";
import { fundingLine } from "@/lib/funding";
import { GiftSummary } from "@/components/gift-summary";
import { formatPrice, site } from "@/config/site";
import type { PublicItem } from "@/lib/claims";
import * as routes from "@/lib/routes";

/** Round offers, so most people never have to type anything. */
const QUICK_AMOUNTS = [1000, 2500, 5000];

/** The symbol on the amount field, from the same place prices are formatted. */
const CURRENCY_PREFIX = new Intl.NumberFormat(site.locale, {
  style: "currency",
  currency: site.currency,
})
  .formatToParts(0)
  .find((part) => part.type === "currency")?.value;

export function ChipInDialog({
  item,
  handle,
  listKey,
  signedIn,
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  signedIn: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ChipInState, FormData>(chipIn, {});
  const [amount, setAmount] = useState("");

  const alreadyGave = item.yourContributionCents > 0;
  const remaining =
    item.goalCents !== null ? Math.max(item.goalCents - item.raisedCents, 0) : null;

  // Never offer more than is still needed, and always offer the rest.
  const suggestions = [
    ...QUICK_AMOUNTS.filter((value) => remaining === null || value < remaining),
    ...(remaining !== null && remaining > 0 ? [remaining] : []),
  ].slice(0, 4);

  // Someone with an account has nothing to lose; close and get out of the way.
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
          alreadyGave
            ? "w-full rounded-pill border border-rose/40 py-3 text-sm font-semibold text-rose-dark transition-colors duration-150 hover:bg-rose-wash"
            : "w-full rounded-pill bg-rose py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-rose-dark"
        }
      >
        {alreadyGave ? "Chip in again" : "Chip in"}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`chip-in-heading-${item.id}`}
        className="w-[min(29rem,calc(100vw-2rem))] rounded-card border border-ink-line bg-paper p-0 text-ink shadow-card backdrop:bg-ink/40"
      >
        {offerAccount ? (
          <div className="p-7">
            <p className="mb-2 rounded-control bg-rose-wash px-3.5 py-2.5 text-xs font-semibold text-rose-dark">
              {state.amountCents !== undefined
                ? `${formatPrice(state.amountCents)} counted toward this gift`
                : "Counted toward this gift"}
            </p>
            <h2 className="mb-2 font-display text-2xl leading-tight tracking-[-0.02em]">
              Keep track of what you gave
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-ink-76">
              This chip-in is remembered in this browser only. An account keeps it
              wherever you sign in — and the owner still only ever sees the total.
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
              id={`chip-in-heading-${item.id}`}
              className="mb-2 font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]"
            >
              Chip in together
            </h2>
            <p className="mb-5 text-sm leading-[1.7] text-ink/78">
              Any amount helps and nothing is wasted. Nothing is charged now — money
              is only taken once the goal is met. The list owner sees the total and
              never who gave it.
            </p>

            {item.goalCents ? (
              <div className="mb-5">
                <FundingBar
                  raisedCents={item.raisedCents}
                  goalCents={item.goalCents}
                  className="mb-2"
                />
                <p className="text-xs font-medium text-ink-72">
                  {fundingLine(item.raisedCents, item.goalCents)}
                  {item.contributorCount > 0
                    ? ` · ${item.contributorCount} ${
                        item.contributorCount === 1 ? "person" : "people"
                      } so far`
                    : null}
                </p>
              </div>
            ) : null}

            {alreadyGave ? (
              <p className="mb-4 rounded-control bg-rose-wash px-[13px] py-[10px] text-xs font-medium text-rose-dark">
                You&rsquo;ve already put in {formatPrice(item.yourContributionCents)}.
              </p>
            ) : null}

            <label
              htmlFor={`amount-${item.id}`}
              className="mb-[7px] block text-2xs font-semibold uppercase tracking-[.9px] text-ink-66"
            >
              How much would you like to put in?
            </label>
            <div className="mb-3 flex items-center rounded-control border border-ink-line-strong bg-surface focus-within:border-violet">
              {CURRENCY_PREFIX ? (
                <span
                  aria-hidden="true"
                  className="pl-[14px] text-sm font-medium text-ink-62"
                >
                  {CURRENCY_PREFIX}
                </span>
              ) : null}
              <input
                id={`amount-${item.id}`}
                name="amount"
                inputMode="decimal"
                required
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="25"
                className="w-full bg-transparent px-[10px] py-3 text-sm font-medium outline-none placeholder:text-ink-62"
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-[6px]">
              {suggestions.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount((value / 100).toString())}
                  className="rounded-pill border border-ink-line-strong bg-surface px-[13px] py-[6px] text-xs font-semibold text-ink-72 transition-colors duration-150 hover:bg-ink/[.03]"
                >
                  {remaining !== null && value === remaining && value > 0
                    ? `The rest — ${formatPrice(value)}`
                    : formatPrice(value)}
                </button>
              ))}
            </div>

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
              className="mb-3 w-full rounded-pill bg-rose py-[14px] text-sm font-semibold text-white transition-colors duration-150 hover:bg-rose-dark disabled:opacity-60"
            >
              {pending ? "Counting it in…" : "Chip in"}
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
      </dialog>
    </>
  );
}
