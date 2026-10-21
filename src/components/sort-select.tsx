"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTrackingScope } from "@/components/tracking";
import type { GiftSort, SortControl } from "@/lib/sort";
import { track } from "@/lib/track";

/**
 * The sort select in the filter bar. It sits inside a plain GET form (see
 * PriceFilterBar), so with JavaScript off it is a select and a Sort button
 * that load the sorted page. With it on, the button is hidden and a change
 * goes straight to the new address as a soft navigation that keeps the
 * reader's place, the same as a price chip.
 *
 * Kept controlled rather than keyed by the address, so the select stays the
 * same element across the navigation and keyboard focus stays on it; the
 * value is only reset from the address when the address changes underneath
 * it, as going back does.
 *
 * Reports sort_used when a guest changes it, inside a list's tracking scope
 * only; opening a sorted link doesn't count. A /gifts shelf has no scope.
 */
export function SortSelect({
  control,
  path,
}: {
  control: SortControl;
  /** The page's own path, without a query, as the form's action. */
  path: string;
}) {
  const router = useRouter();
  const scope = useTrackingScope();
  const [value, setValue] = useState(control.current);
  const [shown, setShown] = useState(control.current);
  if (control.current !== shown) {
    setShown(control.current);
    setValue(control.current);
  }

  return (
    <select
      id="sort-select"
      name="sort"
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        setValue(next);

        // What the form would submit, minus the default, which a link never
        // carries.
        const params = new URLSearchParams();
        for (const [key, entry] of new FormData(event.target.form!)) {
          if (key === "sort" && entry === control.fallback) continue;
          params.set(key, String(entry));
        }
        const query = params.toString();
        router.push(query ? `${path}?${query}` : path, { scroll: false });

        if (scope) track("sort_used", { listId: scope.listId, props: { sort: next as GiftSort } });
      }}
      className="min-h-[40px] min-w-0 flex-1 rounded-control sm:flex-none border border-ink-line-strong bg-surface px-[10px] text-xs font-semibold text-ink-72 focus-ring"
    >
      {control.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
