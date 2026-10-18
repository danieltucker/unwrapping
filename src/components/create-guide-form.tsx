"use client";

import { useActionState } from "react";

import { createGiftGuide, type CreateGuideState } from "@/app/gifts/new/actions";
import { CategoryField, ListIdentityFields } from "@/components/list-fields";
import { Button } from "@/components/ui";

export function CreateGuideForm({
  categories,
}: {
  categories: { id: string; name: string; emoji: string }[];
}) {
  const [state, action, pending] = useActionState<CreateGuideState, FormData>(
    createGiftGuide,
    {},
  );

  return (
    <form action={action} className="p-7">
      <ListIdentityFields guide autoFocus />
      <CategoryField categories={categories} />

      {state.error ? (
        <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
          {state.error}
        </p>
      ) : null}

      {/* Full width on a phone, for the same reason as CreateListForm. */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="text-xs text-ink-66 max-sm:text-center">
          Nobody sees it until you publish
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add some gifts"}
        </Button>
      </div>
    </form>
  );
}
