"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Button, CapsLabel, Input } from "@/components/ui";
import type { SantaState } from "@/lib/secret-santa";

/**
 * The small forms on the Secret Santa pages. Each one names what it acts on in
 * hidden inputs; the actions find the exchange and the person again anyway.
 */

type SantaAction = (previous: SantaState, formData: FormData) => Promise<SantaState>;

function Hidden({ fields }: { fields: Record<string, string> }) {
  return Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}

/** The answer to an action: an error, a confirmation, or a link to pass on. */
function Answer({ state, align = "left" }: { state: SantaState; align?: "left" | "right" }) {
  const text = align === "right" ? "text-right" : "";
  if (state.error) {
    return (
      <p role="alert" className={`text-xs font-medium leading-[1.5] text-rose-dark ${text}`}>
        {state.error}
      </p>
    );
  }
  if (state.link) return <LinkHandoff link={state.link} message={state.message} />;
  if (state.message) {
    return (
      <p role="status" className={`text-xs font-semibold text-pine-dark ${text}`}>
        {state.message}
      </p>
    );
  }
  return null;
}

/** A private link that was just made, shown once to whoever has to pass it on. */
export function LinkHandoff({ link, message }: { link: string; message?: string }) {
  return (
    <div className="w-full rounded-control border border-violet-edge bg-violet-wash p-3 text-left">
      {message ? <p className="mb-2 text-xs leading-[1.55] text-ink-76">{message}</p> : null}
      <div className="flex items-center gap-[10px] rounded-control border border-ink-line-strong bg-surface px-[11px] py-[9px]">
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-ink/82">
          {link.replace(/^https?:\/\//, "")}
        </span>
        <CopyButton value={link} label="Copy" />
      </div>
    </div>
  );
}

/** A one-press action with its answer beside it. */
export function SantaButton({
  action,
  fields,
  label,
  busyLabel,
  variant = "outline",
  size = "sm",
}: {
  action: SantaAction;
  fields: Record<string, string>;
  label: string;
  busyLabel: string;
  variant?: "primary" | "outline";
  size?: "sm" | "md";
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  return (
    <form action={submit} className="flex flex-col items-start gap-2">
      <Hidden fields={fields} />
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? busyLabel : label}
      </Button>
      <Answer state={state} />
    </form>
  );
}

/**
 * Two steps, in place, for anything that can't be taken back: the first press
 * says what is about to happen, and only the second does it. The same gesture
 * as deleting on the admin screen and in the gift editor.
 */
export function SantaConfirm({
  action,
  fields,
  label,
  prompt,
  confirmLabel,
  busyLabel,
  tone = "rose",
  trigger = "pill",
  align = "right",
}: {
  action: SantaAction;
  fields: Record<string, string>;
  label: string;
  /** What will happen, in a sentence. Shown only once they have asked. */
  prompt: string;
  confirmLabel: string;
  busyLabel: string;
  /** Rose for losing something; violet for a big step that isn't a loss. */
  tone?: "rose" | "violet";
  /** "button" for the page's main action, "pill" for a row's small one. */
  trigger?: "pill" | "button";
  align?: "left" | "right";
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const promptId = useId();
  // Only move focus because of a press, never on the first render.
  const pressed = useRef(false);

  // Keyboard and screen-reader users land where the decision is: on Cancel
  // when the question appears (the safe choice for something irreversible),
  // and back on the trigger when it goes.
  useEffect(() => {
    if (!pressed.current) return;
    (confirming ? cancelRef : triggerRef).current?.focus();
  }, [confirming]);

  // Back to the first step once the action answers, so the answer — a link to
  // pass on, or why it didn't work — has somewhere to show. Adjusted during
  // render rather than in an effect, as in ListIdentityFields.
  const [answered, setAnswered] = useState(state);
  if (state !== answered) {
    setAnswered(state);
    setConfirming(false);
  }

  const items = align === "right" ? "items-end" : "items-start";
  const text = align === "right" ? "text-right" : "";

  const solid =
    tone === "rose" ? "bg-rose hover:bg-rose-dark" : "bg-violet hover:bg-violet-hover";

  if (!confirming) {
    return (
      <div className={`flex flex-col gap-1.5 ${items}`}>
        {trigger === "button" ? (
          <Button
            ref={triggerRef}
            type="button"
            variant={tone === "violet" ? "primary" : "outline"}
            onClick={() => {
              pressed.current = true;
              setConfirming(true);
            }}
          >
            {label}
          </Button>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              pressed.current = true;
              setConfirming(true);
            }}
            className={`rounded-pill border px-[13px] py-1.5 text-xs font-semibold transition-colors duration-150 focus-ring ${
              tone === "rose"
                ? "border-rose/30 text-rose hover:bg-rose-wash"
                : "border-ink-line-strong text-ink-76 hover:bg-ink/[.03]"
            }`}
          >
            {label}
          </button>
        )}
        <div className="max-w-[22rem]">
          <Answer state={state} align={align} />
        </div>
      </div>
    );
  }

  return (
    <form
      action={submit}
      role="group"
      aria-label={label}
      className={`flex flex-col gap-2 ${items}`}
    >
      <Hidden fields={fields} />
      <p id={promptId} className={`max-w-[22rem] text-xs leading-[1.6] text-ink-76 ${text}`}>
        {prompt}
      </p>
      <div className="flex items-center gap-2">
        <button
          ref={cancelRef}
          type="button"
          // Read out with the question, so Cancel isn't heard on its own.
          aria-describedby={promptId}
          onClick={() => setConfirming(false)}
          className="rounded-pill border border-ink-line-strong px-[13px] py-1.5 text-xs font-semibold text-ink-72 transition-colors duration-150 hover:bg-ink/[.03] focus-ring"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className={`rounded-pill px-[15px] py-1.5 text-xs font-semibold text-white transition-colors duration-150 disabled:opacity-60 ${solid}`}
        >
          {pending ? busyLabel : confirmLabel}
        </button>
      </div>
    </form>
  );
}

/** Joining from the invite link: a name, and that's all. */
export function SantaJoinForm({
  action,
  code,
  defaultName,
}: {
  action: SantaAction;
  code: string;
  defaultName: string;
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  return (
    <form action={submit}>
      <input type="hidden" name="code" value={code} />
      <label htmlFor="join-name">
        <CapsLabel className="mb-[7px]">Your name</CapsLabel>
      </label>
      <Input
        id="join-name"
        name="name"
        defaultValue={defaultName}
        placeholder="The name your family knows you by"
        required
        maxLength={60}
        autoComplete="given-name"
        className="mb-4"
      />
      {state.error ? (
        <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Joining…" : "I’m in"}
      </Button>
    </form>
  );
}

/** The organiser adding someone who won't open the link themselves. */
export function AddPersonForm({ action, code }: { action: SantaAction; code: string }) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  return (
    <form action={submit} className="flex flex-col gap-2">
      <input type="hidden" name="code" value={code} />
      <label htmlFor="add-person" className="sr-only">
        Their name
      </label>
      <div className="flex gap-2">
        <Input id="add-person" name="name" placeholder="Grandma" required maxLength={60} />
        <Button type="submit" variant="outline" size="sm" disabled={pending} className="shrink-0">
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      <Answer state={state} />
    </form>
  );
}

/** Two people who mustn't draw each other. */
export function ExclusionForm({
  action,
  code,
  people,
}: {
  action: SantaAction;
  code: string;
  people: { id: string; name: string }[];
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  const select =
    "min-w-0 flex-1 rounded-control border border-ink-line-strong bg-surface px-[12px] py-[10px] text-sm font-medium text-ink focus-ring";

  return (
    <form action={submit} className="flex flex-col gap-2">
      <input type="hidden" name="code" value={code} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="firstId" aria-label="First person" defaultValue="" className={select} required>
          <option value="" disabled>
            Someone
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold text-ink-62">and</span>
        <select name="secondId" aria-label="Second person" defaultValue="" className={select} required>
          <option value="" disabled>
            someone else
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Keep apart"}
        </Button>
      </div>
      <Answer state={state} />
    </form>
  );
}

/**
 * Linking a wishlist: one of their own from a menu when they're signed in, or
 * any Unwrap list link pasted in.
 */
export function WishlistForm({
  action,
  code,
  ownLists,
}: {
  action: SantaAction;
  code: string;
  ownLists: { id: string; name: string; emoji: string }[];
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  const [picked, setPicked] = useState(ownLists[0]?.id ?? "");

  return (
    <form action={submit} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      {ownLists.length > 0 ? (
        <div>
          <label htmlFor="wishlist-pick">
            <CapsLabel className="mb-[7px]">One of your lists</CapsLabel>
          </label>
          <select
            id="wishlist-pick"
            name="listId"
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
            className="w-full rounded-control border border-ink-line-strong bg-surface px-[14px] py-3 text-sm font-medium text-ink focus-ring"
          >
            {ownLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.emoji} {list.name}
              </option>
            ))}
            <option value="">A link instead…</option>
          </select>
        </div>
      ) : null}

      {ownLists.length === 0 || picked === "" ? (
        <div>
          <label htmlFor="wishlist-link">
            <CapsLabel className="mb-[7px]">Link to your wishlist</CapsLabel>
          </label>
          <Input
            id="wishlist-link"
            name="link"
            inputMode="url"
            placeholder="unwrapp.ing/AbC2345"
            required
          />
        </div>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Linking…" : "Link it"}
        </Button>
      </div>
      <Answer state={state} />
    </form>
  );
}

/**
 * Moves focus to the element with `id` once, when the page arrives with it.
 * For the reveal: the name appears in place of the button that was pressed,
 * and without this a screen reader would be left on nothing.
 */
export function FocusOnMount({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.focus();
  }, [id]);
  return null;
}
