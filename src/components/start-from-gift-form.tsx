"use client";

import { useActionState, useRef } from "react";

import { startFromGift, type StartFromGiftState } from "@/app/new/actions";
import { LinkIcon } from "@/components/ui";

/** Hand-written gifts worth suggesting, to show the box isn't links only. */
const EXAMPLES = ["Good olive oil", "A day of babysitting"];

/**
 * The landing page's way in, drawn for the ink hero: say the first thing you
 * want and land in the editor with it already on the list. Most people arrive
 * with a product open in another tab, so a link is what the box asks for
 * first, but a plain name works too and becomes a hand-written gift.
 *
 * Plain text rather than type="url": people paste "amazon.com/…" without the
 * scheme, and the browser would refuse it before the server could fix it up.
 * It also has to accept words.
 *
 * On a phone the field and button stack; from `sm` up they share one white
 * bar, the button sitting inside it, which is the shape people recognise as
 * "type here and go".
 */
export function StartFromGiftForm() {
  const [state, action, pending] = useActionState<StartFromGiftState, FormData>(
    startFromGift,
    {},
  );
  const input = useRef<HTMLInputElement>(null);

  const tryExample = (example: string) => {
    if (!input.current) return;
    input.current.value = example;
    input.current.focus();
  };

  return (
    <form action={action} className="mx-auto w-full max-w-[40rem]">
      <label
        htmlFor="start-gift"
        className="mb-3 block text-sm font-semibold text-paper"
      >
        Paste a link, or type the name of something you&rsquo;d love
      </label>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2 sm:rounded-pill sm:bg-surface sm:p-1.5 sm:shadow-float sm:focus-within:ring-4 sm:focus-within:ring-violet-on-ink/40">
        <div className="relative flex-1">
          <LinkIcon
            size={18}
            className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-ink-62"
          />
          {/* React empties a form once its action returns; keying on the
              rejected entry puts it back so it can be fixed, not retyped. */}
          <input
            ref={input}
            key={state.value}
            defaultValue={state.value}
            id="start-gift"
            name="gift"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://shop.com/… or “a cosy blanket”"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "start-gift-error" : undefined}
            disabled={pending}
            required
            className="w-full rounded-pill bg-surface py-4 pl-12 pr-5 text-base font-medium text-ink placeholder:text-ink-62 outline-none focus-visible:ring-4 focus-visible:ring-violet-on-ink/40 sm:bg-transparent sm:py-3 sm:text-lg sm:focus-visible:ring-0 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center justify-center rounded-pill bg-violet px-7 pb-[0.8125rem] pt-[0.9375rem] text-base font-semibold text-white transition-colors duration-150 hover:bg-violet-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Starting your list…" : "Start my list"}
        </button>
      </div>

      {state.error ? (
        <p
          id="start-gift-error"
          role="alert"
          className="mt-3 text-sm font-medium text-rose-on-ink"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-paper-72">
        <span>No link? Try</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => tryExample(example)}
            disabled={pending}
            className="rounded-pill border border-paper-line bg-paper-fill px-3 py-1.5 font-medium text-paper-88 transition-colors duration-150 hover:border-paper/40 hover:text-paper"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}
