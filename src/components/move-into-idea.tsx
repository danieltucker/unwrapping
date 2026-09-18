"use client";

import { useState, useTransition } from "react";

import { moveGiftToIdea } from "@/app/lists/[handle]/[slug]/manage/actions";
import { CapsLabel } from "@/components/ui";
import { formatPrice } from "@/config/site";

/**
 * Putting a present that is already on the list under an idea.
 *
 * Two ways in, because a list is built in whatever order it occurs to someone:
 * the idea is often written down after the presents it turns out to describe.
 *
 *  - IdeaField is the dropdown on the edit panel: you are looking at a gift and
 *    decide it belongs under "Knitting". It rides along with the rest of that
 *    form, so it saves when the gift does.
 *  - MoveIntoIdea is the picker inside "Add a gift to Knitting": you are looking
 *    at the idea and decide which of the gifts already on the list belong in it.
 *    Moving one across is the whole action there, so it saves on the tap.
 *
 * Both end up in moveUnderIdea on the server, which is where the move is
 * checked rather than trusted.
 */

/** One idea, as the dropdown lists it. */
export type IdeaOption = { id: string; title: string };

/** One present that could be moved, as the picker shows it. */
export type MovableGift = {
  id: string;
  title: string;
  priceCents: number | null;
  /** The photo it is showing on the list today, or null. */
  image: string | null;
  emoji: string | null;
  /** The idea it sits under now, so the picker can say where it comes from. */
  parentTitle: string | null;
};

/**
 * Which idea this present belongs under. Rendered only for a present on a list
 * that has ideas on it: with nothing to choose between, a dropdown holding
 * only "On its own" is a control that does nothing.
 */
export function IdeaField({
  ideas,
  value,
}: {
  ideas: IdeaOption[];
  /** The idea it is under now, or null. */
  value: string | null;
}) {
  return (
    <div className="mb-4">
      <label htmlFor="parentId">
        <CapsLabel className="mb-[5px] text-2xs">Part of an idea</CapsLabel>
      </label>
      <select
        id="parentId"
        name="parentId"
        defaultValue={value ?? ""}
        className="w-full rounded-control border border-ink-line-strong bg-surface px-[13px] py-[10px] text-sm font-medium text-ink focus-ring"
      >
        <option value="">On its own</option>
        {ideas.map((idea) => (
          <option key={idea.id} value={idea.id}>
            Under &ldquo;{idea.title}&rdquo;
          </option>
        ))}
      </select>
      <p className="mt-[7px] text-xs leading-[1.55] text-ink-72">
        A present inside an idea is shown with it rather than in the grid.
        Guests can still take the idea itself and choose their own.
      </p>
    </div>
  );
}

export function MoveIntoIdea({
  handle,
  listKey,
  parentId,
  parentTitle,
  gifts,
  onDone,
  onBack,
}: {
  handle: string;
  listKey: string;
  /** The idea everything here would move into. */
  parentId: string;
  parentTitle: string;
  gifts: MovableGift[];
  onDone: () => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // Which one was tapped, so only that row says it is on its way.
  const [moving, setMoving] = useState<string | null>(null);
  const [, startMoving] = useTransition();

  function move(id: string) {
    setError(null);
    setMoving(id);
    startMoving(async () => {
      const result = await moveGiftToIdea(handle, listKey, id, parentId);
      setMoving(null);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="p-[26px]">
      <h2 className="mb-[6px] font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]">
        Move one into {parentTitle}
      </h2>
      <p className="mb-5 text-sm leading-[1.65] text-ink-76">
        Nothing is re-added or re-claimed: the gift keeps its photo, its price
        and anyone who has already reserved it. It just moves under the idea.
      </p>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-control bg-rose/10 px-[13px] py-[10px] text-xs font-medium text-rose-dark"
        >
          {error}
        </p>
      ) : null}

      <ul className="mb-4 flex flex-col gap-2">
        {gifts.map((gift) => (
          <li key={gift.id}>
            <button
              type="button"
              onClick={() => move(gift.id)}
              disabled={moving !== null}
              className="flex w-full items-center gap-3 rounded-control border border-ink-line bg-surface px-[13px] py-[10px] text-left transition-colors duration-150 hover:bg-ink/[.03] disabled:opacity-60"
            >
              <span className="h-10 w-9 shrink-0 overflow-hidden rounded-[7px] bg-ink/[.05]">
                {gift.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gift.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-base leading-none">
                    {gift.emoji ?? "🎁"}
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {gift.title}
                </span>
                {/* Where it is coming from matters when it is coming from
                    somewhere: moving a present out of one idea and into
                    another empties the first one. */}
                <span className="block text-xs text-ink-72">
                  {gift.parentTitle
                    ? `Currently under “${gift.parentTitle}”`
                    : "Currently on its own"}
                </span>
              </span>

              <span className="shrink-0 text-sm font-semibold">
                {moving === gift.id
                  ? "Moving…"
                  : gift.priceCents === null
                    ? "-"
                    : formatPrice(gift.priceCents)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onBack}
        className="min-h-11 w-full text-center text-sm font-semibold text-ink-72"
      >
        Back
      </button>
    </div>
  );
}
