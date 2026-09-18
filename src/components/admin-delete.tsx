"use client";

import { useActionState } from "react";
import { useState } from "react";

import type { AdminState } from "@/app/admin/actions";

/**
 * The delete control on the operator's screen, used by all three of its
 * sections so an account, a list and a photo are all removed by the same
 * gesture.
 *
 * Two steps, in place, like the one in the gift editor: the first click swaps
 * the button for a sentence saying what is about to be lost, and only the
 * second one submits. No `confirm()` — a browser dialog can't say which list it
 * means, and it can't be styled to look as serious as it is.
 *
 * The row this sits in usually disappears when the action succeeds, because the
 * page re-renders without it. Where it doesn't — a photo whose file wouldn't
 * delete — the reason is shown here rather than thrown.
 */
export function AdminDelete({
  action,
  fields,
  prompt,
  label = "Delete",
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
}: {
  action: (previous: AdminState, formData: FormData) => Promise<AdminState>;
  /** Hidden inputs naming what to delete; the action re-checks them anyway. */
  fields: Record<string, string>;
  /** What will be lost, in a sentence. Shown only once they have asked. */
  prompt: string;
  label?: string;
  confirmLabel?: string;
  busyLabel?: string;
}) {
  const [state, submit, pending] = useActionState<AdminState, FormData>(action, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-pill border border-rose/30 px-[13px] py-1.5 text-xs font-semibold text-rose transition-colors duration-150 hover:bg-rose-wash focus-ring"
        >
          {label}
        </button>
        {state.error ? (
          <p className="max-w-[16rem] text-right text-xs leading-[1.5] text-rose">
            {state.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col items-end gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <p className="max-w-[18rem] text-right text-xs leading-[1.6] text-ink-76">
        {prompt}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-pill border border-ink-line-strong px-[13px] py-1.5 text-xs font-semibold text-ink-72 transition-colors duration-150 hover:bg-ink/[.03] focus-ring"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-rose px-[15px] py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-rose-dark disabled:opacity-60"
        >
          {pending ? busyLabel : confirmLabel}
        </button>
      </div>

      {state.error ? (
        <p className="max-w-[18rem] text-right text-xs leading-[1.5] text-rose">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
