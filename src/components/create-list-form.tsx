"use client";

import { useActionState } from "react";

import {
  ClaimRuleFields,
  ListIdentityFields,
  SurpriseChoice,
} from "@/components/list-fields";
import { Button } from "@/components/ui";
import { createList, type CreateListState } from "@/app/new/actions";

export function CreateListForm({
  today,
  defaultName = "",
  defaultEmoji = "🎁",
}: {
  today: string;
  /** Set when the occasion arrived with the visitor, e.g. from /new?for=. */
  defaultName?: string;
  defaultEmoji?: string;
}) {
  const [state, action, pending] = useActionState<CreateListState, FormData>(
    createList,
    {},
  );

  return (
    <form action={action} className="p-7">
      {/* `today` comes from the server to avoid a hydration mismatch. */}
      <ListIdentityFields
        minDate={today}
        defaultName={defaultName}
        defaultEmoji={defaultEmoji}
        autoFocus
      />
      <ClaimRuleFields />
      <SurpriseChoice />

      {state.error ? (
        <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
          {state.error}
        </p>
      ) : null}

      {/* Side by side there is no room left for the button on a phone, and its
          label breaks across two lines. Every other form in the product submits
          with a full-width button, so this one does too once the row is too
          narrow to hold both. */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="text-xs text-ink-66 max-sm:text-center">
          All of this is editable later
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add some gifts"}
        </Button>
      </div>
    </form>
  );
}
