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

      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-ink-66">All of this is editable later</span>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add some gifts"}
        </Button>
      </div>
    </form>
  );
}
