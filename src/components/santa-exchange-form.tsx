"use client";

import { useActionState, useState } from "react";

import { Button, CapsLabel, Input, Textarea } from "@/components/ui";
import type { SantaState } from "@/lib/secret-santa";

/** A short, fixed set: a Secret Santa is one occasion, not a dozen. */
const EMOJI = ["🎅", "🎄", "🎁", "⛄", "🦌", "❄️", "🕎", "🌟"];

export type ExchangeDetails = {
  name: string;
  emoji: string;
  /** As typed into the budget box: "25", not cents. */
  budget: string;
  /** yyyy-mm-dd, or empty. */
  exchangeDate: string;
  note: string;
};

/**
 * What a Secret Santa is: its name, budget, date and a note. Used to start one
 * and to correct it from the dashboard, so it is described the same way both
 * times.
 */
export function SantaExchangeForm({
  action,
  code,
  details,
  creating = false,
  today,
}: {
  action: (previous: SantaState, formData: FormData) => Promise<SantaState>;
  /** Set when editing, so the action can find the exchange again. */
  code?: string;
  details?: ExchangeDetails;
  /** Creating offers "I'm taking part" and a bigger submit button. */
  creating?: boolean;
  /** From the server, to avoid a hydration mismatch on the date's minimum. */
  today?: string;
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  const [emoji, setEmoji] = useState(details?.emoji ?? EMOJI[0]);

  return (
    <form action={submit}>
      {code ? <input type="hidden" name="code" value={code} /> : null}
      <input type="hidden" name="emoji" value={emoji} />

      <label htmlFor="santa-name">
        <CapsLabel className="mb-[7px]">Name</CapsLabel>
      </label>
      <Input
        id="santa-name"
        name="name"
        defaultValue={details?.name}
        placeholder="Tucker family Christmas"
        required
        maxLength={80}
        autoFocus={creating}
        className="mb-3"
      />

      <div className="mb-5 flex flex-wrap gap-[6px]" role="group" aria-label="Emoji">
        {EMOJI.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === emoji}
            onClick={() => setEmoji(option)}
            className={`flex h-11 w-11 items-center justify-center rounded-control text-lg transition-colors duration-150 sm:h-[34px] sm:w-[34px] ${
              option === emoji
                ? "border-[1.5px] border-violet bg-violet/10"
                : "border border-ink-line bg-surface hover:bg-ink/[.03]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-[14px] sm:grid-cols-2">
        <div>
          <label htmlFor="santa-budget">
            <CapsLabel className="mb-[7px]">Budget per gift</CapsLabel>
          </label>
          <Input
            id="santa-budget"
            name="budget"
            inputMode="decimal"
            defaultValue={details?.budget}
            placeholder="25"
          />
        </div>
        <div>
          <label htmlFor="santa-date">
            <CapsLabel className="mb-[7px]">Gift-giving day</CapsLabel>
          </label>
          <Input
            id="santa-date"
            name="exchangeDate"
            type="date"
            min={today}
            defaultValue={details?.exchangeDate}
          />
        </div>
      </div>

      <label htmlFor="santa-note">
        <CapsLabel className="mb-[7px]">A note for everyone</CapsLabel>
      </label>
      <Textarea
        id="santa-note"
        name="note"
        rows={2}
        maxLength={1000}
        defaultValue={details?.note}
        placeholder="Gifts under the tree by Christmas Eve. Nothing with a plug."
        className="mb-5"
      />

      {creating ? (
        <label className="mb-5 flex cursor-pointer items-center justify-between gap-3 rounded-control border border-ink-line bg-surface px-[13px] py-[11px]">
          <span>
            <span className="block text-sm font-semibold">I&rsquo;m taking part too</span>
            <span className="block text-2xs text-ink-72">
              You&rsquo;ll draw a name like everyone else, and you still won&rsquo;t see
              anyone else&rsquo;s.
            </span>
          </span>
          <input type="checkbox" name="takingPart" defaultChecked className="h-4 w-4 accent-violet" />
        </label>
      ) : null}

      {state.error ? (
        <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
          {state.error}
        </p>
      ) : state.message ? (
        <p role="status" className="mb-4 text-xs font-semibold text-pine-dark">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="text-xs text-ink-66 max-sm:text-center">All of this is editable later</span>
        <Button type="submit" disabled={pending} size={creating ? "md" : "sm"}>
          {creating ? (pending ? "Starting…" : "Start the Secret Santa") : pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
