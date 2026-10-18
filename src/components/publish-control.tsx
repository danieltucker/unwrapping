"use client";

import { useActionState } from "react";

import {
  setGuidePublished,
  type PublishState,
} from "@/app/lists/[handle]/[slug]/manage/actions";
import { Button } from "@/components/ui";

/**
 * The gift guide's one extra decision: whether it is on /gifts yet.
 *
 * Unpublished, it is the editor's primary action, because until it is pressed
 * nobody browsing can find the list. Published, it steps back to a quiet
 * "take it down", and the header's status line says where it is live.
 */
export function PublishControl({
  handle,
  listKey,
  published,
}: {
  handle: string;
  listKey: string;
  published: boolean;
}) {
  const [state, action, pending] = useActionState<PublishState, FormData>(
    setGuidePublished,
    {},
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="key" value={listKey} />
      <input type="hidden" name="publish" value={published ? "false" : "true"} />

      {published ? (
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Unpublishing…" : "Unpublish"}
        </Button>
      ) : (
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? "Publishing…" : "Publish to Gift lists"}
        </Button>
      )}

      {state.error ? (
        <p role="alert" className="max-w-[16rem] text-right text-xs font-medium text-rose-dark">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
