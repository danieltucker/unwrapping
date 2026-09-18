"use client";

import { useEffect, useState } from "react";

import {
  BoxIcon,
  CapsLabel,
  EyeOffIcon,
  Input,
  Textarea,
  WalletIcon,
} from "@/components/ui";
import { CLAIM_RULE_OPTIONS } from "@/lib/claim-rules";
import type { ClaimRule } from "@/db/schema";
import { matchedPhrase, suggestEmoji } from "@/lib/emoji";

/**
 * The fields that describe a list rather than its gifts. Shared by the create
 * flow and the editor's details dialog, so a list is described the same way
 * whether it is being born or corrected.
 */

export function ListIdentityFields({
  defaultName = "",
  defaultEmoji = "🎁",
  defaultEventDate = "",
  defaultNote = "",
  minDate,
  autoFocus = false,
}: {
  defaultName?: string;
  defaultEmoji?: string;
  defaultEventDate?: string;
  defaultNote?: string;
  /** Set on a new list, where the event can only be ahead of us. */
  minDate?: string;
  autoFocus?: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [debouncedName, setDebouncedName] = useState(defaultName);
  const [emoji, setEmoji] = useState(defaultEmoji);
  // A list that already has an emoji has been decided; don't second-guess it.
  const [pickedEmoji, setPickedEmoji] = useState(defaultName !== "");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(name), 300);
    return () => clearTimeout(timer);
  }, [name]);

  const suggestions = suggestEmoji(debouncedName);
  const phrase = matchedPhrase(debouncedName);

  // Suggestions follow the name as it's typed; an explicit pick wins and stops
  // the updating. Adjusted during render rather than in an effect, so the
  // emoji and the name it came from never disagree for a frame.
  const [lastSuggestion, setLastSuggestion] = useState(suggestions[0]);
  if (!pickedEmoji && suggestions[0] !== lastSuggestion) {
    setLastSuggestion(suggestions[0]);
    setEmoji(suggestions[0]);
  }

  return (
    <>
      <input type="hidden" name="emoji" value={emoji} />

      <div className="mb-3 grid gap-[14px] sm:grid-cols-[1.7fr_1fr]">
        <div>
          <label htmlFor="name">
            <CapsLabel className="mb-[7px]">List name</CapsLabel>
          </label>
          {/* One bordered box split into an emoji button and the text input. */}
          <div className="flex overflow-hidden rounded-control border border-ink-line-strong bg-surface focus-within:border-violet">
            <button
              type="button"
              onClick={() => setPickedEmoji(false)}
              title="Suggest an emoji from the name"
              className="flex shrink-0 items-center gap-[7px] border-r border-ink-line bg-violet-wash px-[13px] text-xl"
            >
              {emoji}
              <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="#5738E8" strokeWidth="1.6" />
              </svg>
            </button>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Maya turns 30"
              required
              maxLength={80}
              autoFocus={autoFocus}
              className="w-full bg-transparent px-[14px] py-3 text-sm font-medium text-ink outline-none placeholder:text-ink-62"
            />
          </div>
        </div>

        <div>
          <label htmlFor="eventDate">
            <CapsLabel className="mb-[7px]">Event date</CapsLabel>
          </label>
          <Input
            id="eventDate"
            name="eventDate"
            type="date"
            min={minDate}
            defaultValue={defaultEventDate}
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-[10px]">
        <span className="text-xs font-medium text-ink-66">
          {phrase ? `Suggested from "${phrase}":` : "Suggestions:"}
        </span>
        <div className="flex flex-wrap gap-[6px]">
          {suggestions.map((option) => {
            const selected = option === emoji;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setEmoji(option);
                  setPickedEmoji(true);
                }}
                // 34px is the design's size and too small to sit in a row of
                // adjacent targets on a phone, where the neighbour is 6px away.
                className={`flex h-11 w-11 items-center justify-center rounded-control text-lg transition-colors duration-150 sm:h-[34px] sm:w-[34px] ${
                  selected
                    ? "border-[1.5px] border-violet bg-violet/10"
                    : "border border-ink-line bg-surface hover:bg-ink/[.03]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="note">
          <CapsLabel className="mb-[7px]">
            Note to guests{" "}
            <span className="font-normal normal-case tracking-normal text-ink-62">
              (optional)
            </span>
          </CapsLabel>
        </label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          maxLength={400}
          defaultValue={defaultNote}
          placeholder="No pressure at all, but if you're the gift-giving type, here's what I'd actually use."
        />
      </div>
    </>
  );
}

export function ClaimRuleFields({ value = "anonymous" }: { value?: ClaimRule }) {
  return (
    <fieldset className="mb-5 overflow-hidden rounded-[12px] border border-ink-line bg-surface">
      <legend className="sr-only">Who can claim a gift</legend>
      <div className="border-b border-ink-line px-4 py-[13px] text-sm font-semibold">
        Who can claim a gift
      </div>
      {CLAIM_RULE_OPTIONS.map((option, index) => (
        <label
          key={option.value}
          className={`flex cursor-pointer gap-3 px-4 py-[14px] ${
            index > 0 ? "border-t border-ink-line" : ""
          }`}
        >
          <input
            type="radio"
            name="claimRule"
            value={option.value}
            defaultChecked={option.value === value}
            className="mt-[3px] h-4 w-4 shrink-0 accent-violet"
          />
          <span>
            <span className="block text-sm font-semibold">{option.title}</span>
            <span className="block text-xs leading-[1.55] text-ink-72">
              {option.detail}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Surprise mode.
 *
 * A birthday wants the blindfold; a wedding registry usually wants the couple
 * to see what's been taken so they can add more. The copy has to change with
 * the choice, because guests are shown the matching promise on the list.
 */
export function SurpriseChoice({ defaultOn = true }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div
      className={`mb-6 rounded-[12px] border px-4 py-[13px] ${
        on ? "border-violet-edge bg-violet-wash" : "border-ink-line bg-surface"
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <EyeOffIcon
          className={`mt-px shrink-0 ${on ? "text-violet" : "text-ink-62"}`}
        />
        <span className="flex-1">
          <span className="block text-sm font-semibold">Keep it a surprise</span>
          <span className="block text-xs leading-[1.55] text-ink-72">
            {on
              ? "You'll only ever see counts, never which gifts are taken, or who took them."
              : "You'll see which gifts are taken, so you can add more. Guests are told, and who took what still stays private."}
          </span>
        </span>
        <input
          type="checkbox"
          name="surpriseMode"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="mt-[3px] h-4 w-4 shrink-0 accent-violet"
        />
      </label>
    </div>
  );
}

/**
 * Where a gift can be posted.
 *
 * Optional, and shown to a narrow audience: only someone who has actually
 * reserved a gift from this list, and only on their own reservations page.
 * That keeps a home address off a URL anybody can open, which is the whole
 * reason it isn't just part of the note to guests.
 */
export function DeliveryAddressField({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  return (
    <div className="mb-6">
      <label htmlFor="deliveryAddress">
        <CapsLabel className="mb-[7px]">
          Delivery address{" "}
          <span className="font-normal normal-case tracking-normal text-ink-62">
            (optional)
          </span>
        </CapsLabel>
      </label>
      <Textarea
        id="deliveryAddress"
        name="deliveryAddress"
        rows={3}
        maxLength={400}
        defaultValue={defaultValue}
        placeholder={"Maya Ferrand\n14 Bellwether Lane\nAustin, TX 78704"}
      />
      <p className="mt-[7px] flex gap-2 text-xs leading-[1.55] text-ink-72">
        <BoxIcon size={15} className="mt-px shrink-0 text-ink-62" />
        <span>
          Only shown to guests who have reserved a gift, on their own
          reservations page. It never appears on the shared list, and seeing it
          doesn&rsquo;t tell you who looked.
        </span>
      </p>
    </div>
  );
}

/**
 * Where a cash gift's money actually goes.
 *
 * Unwrap moves no money, so without this a guest who has chipped in has no way
 * to finish the job. Same rule as the delivery address: it reaches only
 * someone who has already given, never the public list.
 */
export function PaymentDetailsField({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  return (
    <div className="mb-6">
      <label htmlFor="paymentDetails">
        <CapsLabel className="mb-[7px]">
          How to send money{" "}
          <span className="font-normal normal-case tracking-normal text-ink-62">
            (optional)
          </span>
        </CapsLabel>
      </label>
      <Textarea
        id="paymentDetails"
        name="paymentDetails"
        rows={3}
        maxLength={400}
        defaultValue={defaultValue}
        placeholder={"monzo.me/mayaferrand\nor: Maya Ferrand, 04-00-04, 12345678"}
      />
      <p className="mt-[7px] flex gap-2 text-xs leading-[1.55] text-ink-72">
        <WalletIcon size={15} className="mt-px shrink-0 text-ink-62" />
        <span>
          Shown to guests who chip in on a cash gift, so they can send it. You
          still only ever see the total, never who gave what.
        </span>
      </p>
    </div>
  );
}
