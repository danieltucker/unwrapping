"use client";

import type { ReactNode } from "react";

import { useTrackingScope } from "@/components/tracking";
import { filterEventValue, parsePriceFilter } from "@/lib/price";
import { track } from "@/lib/track";

/**
 * Reports filter_used when a guest works the price filter: a chip, the Clear
 * link, or the price form's Apply. Recorded at the moment of use rather than when a
 * filtered page loads, so opening a shared filtered link counts as a visit,
 * not as somebody filtering.
 *
 * Wraps the bar rather than living inside each control, so the bar itself can
 * stay a server component and keep working with JavaScript off. Outside a
 * tracking scope — tracking off, the owner looking, or a /gifts shelf, which
 * isn't one list — it renders its children and nothing else.
 */
export function PriceFilterUsage({ children }: { children: ReactNode }) {
  const scope = useTrackingScope();
  if (!scope) return <>{children}</>;

  const send = (filter: string) =>
    track("filter_used", { listId: scope.listId, props: { filter } });

  return (
    <div
      onClickCapture={(event) => {
        const link = (event.target as Element).closest<HTMLElement>("[data-filter-event]");
        if (link?.dataset.filterEvent) send(link.dataset.filterEvent);
      }}
      onSubmitCapture={(event) => {
        // The sort's own form carries the range too, but sorting isn't
        // filtering; SortSelect reports sort_used itself.
        const form = event.target as HTMLFormElement;
        if (!("priceForm" in form.dataset)) return;
        const data = new FormData(form);
        const params = Object.fromEntries(
          [...data.entries()].map(([key, value]) => [key, String(value)]),
        );
        send(filterEventValue(parsePriceFilter(params)));
      }}
    >
      {children}
    </div>
  );
}
