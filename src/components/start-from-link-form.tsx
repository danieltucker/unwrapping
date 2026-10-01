"use client";

import { useActionState } from "react";

import { startFromLink, type StartFromLinkState } from "@/app/new/actions";
import { Button, Input, LinkIcon } from "@/components/ui";

/**
 * The landing page's way in: paste the first thing you want and land in the
 * editor with it already on the list. Asking for a link rather than a name is
 * deliberate; most people arrive with a product open in another tab, and a
 * gift on the list is a stronger reason to keep going than a title.
 *
 * Plain text rather than type="url": people paste "amazon.com/…" without the
 * scheme, and the browser would refuse it before the server could fix it up.
 */
export function StartFromLinkForm() {
  const [state, action, pending] = useActionState<StartFromLinkState, FormData>(
    startFromLink,
    {},
  );

  return (
    <form action={action} className="max-w-[32.5rem]">
      <label htmlFor="start-url" className="mb-2 block text-sm font-semibold">
        Paste a link to something you&rsquo;d love
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <LinkIcon className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-ink-62" />
          {/* React empties a form once its action returns; keying on the
              rejected paste puts it back so it can be fixed, not retyped. */}
          <Input
            key={state.url}
            defaultValue={state.url}
            id="start-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://shop.com/the-thing-you-want"
            className="pl-10"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "start-url-error" : undefined}
            disabled={pending}
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Reading the page…" : "Start my list"}
        </Button>
      </div>

      {state.error ? (
        <p
          id="start-url-error"
          role="alert"
          className="mt-2 text-xs font-medium text-rose-dark"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
