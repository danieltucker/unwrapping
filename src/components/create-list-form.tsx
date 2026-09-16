"use client";

import { useActionState, useEffect, useState } from "react";

import { Button, CapsLabel, Input, SurprisePanel, Textarea } from "@/components/ui";
import { matchedPhrase, suggestEmoji } from "@/lib/emoji";
import { createList, type CreateListState } from "@/app/new/actions";

const CLAIM_RULE_OPTIONS = [
  {
    value: "anonymous",
    title: "Anyone with the link, anonymously",
    detail: "No sign-up. Guests see what's taken; nobody sees who took it.",
  },
  {
    value: "firstName",
    title: "Ask for a first name",
    detail: "Guests can coordinate with each other. Still hidden from you.",
  },
  {
    value: "account",
    title: "Require an account",
    detail: "Best for big lists where duplicates get expensive.",
  },
] as const;

export function CreateListForm() {
  const [state, action, pending] = useActionState<CreateListState, FormData>(
    createList,
    {},
  );

  const [name, setName] = useState("");
  // Suggestions follow the name as it's typed, but stop once the owner chooses.
  const [debouncedName, setDebouncedName] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [pickedEmoji, setPickedEmoji] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(name), 300);
    return () => clearTimeout(timer);
  }, [name]);

  const suggestions = suggestEmoji(debouncedName);
  const phrase = matchedPhrase(debouncedName);

  // An explicit pick wins and stops updating.
  useEffect(() => {
    if (!pickedEmoji) setEmoji(suggestions[0]);
  }, [suggestions, pickedEmoji]);

  return (
    <form action={action} className="p-7">
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
              className="flex shrink-0 items-center gap-[7px] border-r border-ink-line bg-violet-wash px-[13px] text-[19px]"
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
              autoFocus
              className="w-full bg-transparent px-[14px] py-3 text-[14.5px] font-medium text-ink outline-none placeholder:text-ink-62"
            />
          </div>
        </div>

        <div>
          <label htmlFor="eventDate">
            <CapsLabel className="mb-[7px]">Date</CapsLabel>
          </label>
          <Input id="eventDate" name="eventDate" type="date" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-[10px]">
        <span className="text-[12px] font-medium text-ink-66">
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
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-control text-[17px] transition-colors duration-150 ${
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
              — optional
            </span>
          </CapsLabel>
        </label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          maxLength={400}
          placeholder="No pressure at all — but if you're the gift-giving type, here's what I'd actually use."
        />
      </div>

      <fieldset className="mb-5 overflow-hidden rounded-[12px] border border-ink-line bg-surface">
        <legend className="sr-only">Who can claim a gift</legend>
        <div className="border-b border-ink-line px-4 py-[13px] text-[13px] font-semibold">
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
              defaultChecked={index === 0}
              className="mt-[3px] h-4 w-4 shrink-0 accent-violet"
            />
            <span>
              <span className="block text-[13.5px] font-semibold">{option.title}</span>
              <span className="block text-[12.5px] leading-[1.55] text-ink-72">
                {option.detail}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mb-6">
        <SurprisePanel>
          <strong className="font-semibold">
            You&rsquo;ll never see who claimed what
          </strong>{" "}
          — not before the party, not after. That isn&rsquo;t a setting.
        </SurprisePanel>
      </div>

      {state.error ? (
        <p role="alert" className="mb-4 text-[12.5px] font-medium text-rose-dark">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <span className="text-[12.5px] text-ink-66">All of this is editable later</span>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add some gifts"}
        </Button>
      </div>
    </form>
  );
}
