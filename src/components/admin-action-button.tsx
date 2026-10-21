"use client";

import { useActionState } from "react";

import type { AdminState } from "@/app/admin/actions";

/**
 * A one-press admin action that isn't a delete: no confirmation step, and the
 * answer shown beside it. AdminDelete is the one for anything irreversible.
 */
export function AdminActionButton({
  action,
  label,
  busyLabel,
  fields = {},
}: {
  action: (previous: AdminState, formData: FormData) => Promise<AdminState>;
  label: string;
  busyLabel: string;
  /** Hidden inputs naming what to act on; the action re-checks them anyway. */
  fields?: Record<string, string>;
}) {
  const [state, submit, pending] = useActionState<AdminState, FormData>(action, {});

  return (
    <form action={submit} className="flex flex-wrap items-center gap-3">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className="rounded-pill border border-ink-line-strong bg-surface px-[15px] py-1.5 text-xs font-semibold transition-colors duration-150 hover:bg-ink/[.03] disabled:opacity-60 focus-ring"
      >
        {pending ? busyLabel : label}
      </button>
      {state.error ? (
        <p className="text-xs font-medium text-rose-dark">{state.error}</p>
      ) : state.message ? (
        <p className="text-xs font-semibold text-pine-dark">{state.message}</p>
      ) : null}
    </form>
  );
}
