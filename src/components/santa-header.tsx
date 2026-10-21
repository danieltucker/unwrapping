import type { ReactNode } from "react";

import { formatPrice } from "@/config/site";
import { formatEventDate } from "@/lib/date";
import type { SantaExchange } from "@/db/schema";

/** "Thursday 24 December · $25 each": the line under an exchange's name. */
export function exchangeMeta(exchange: SantaExchange): string[] {
  return [
    formatEventDate(exchange.exchangeDate),
    exchange.budgetCents !== null ? `${formatPrice(exchange.budgetCents)} each` : null,
  ].filter((part): part is string => Boolean(part));
}

/**
 * The ink band at the top of a Secret Santa card: what it is and who runs it.
 * The same on the invite, the participant's page and the dashboard, so people
 * can tell at a glance they're in the right one.
 */
export function SantaCardHeader({
  exchange,
  eyebrow,
  children,
}: {
  exchange: SantaExchange;
  eyebrow: string;
  children?: ReactNode;
}) {
  const meta = exchangeMeta(exchange);
  return (
    <header className="bg-ink px-[26px] py-[22px] text-paper">
      <p className="mb-[7px] text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
        {eyebrow}
      </p>
      <h1 className="font-display text-[1.875rem] leading-[1.1] tracking-[-.8px]">
        <span className="mr-2">{exchange.emoji}</span>
        {exchange.name}
      </h1>
      {meta.length ? <p className="mt-2 text-xs font-medium text-paper-72">{meta.join(" · ")}</p> : null}
      {children}
    </header>
  );
}

/** The organiser's note, kept as they wrote it, line breaks included. */
export function SantaNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <p className="whitespace-pre-line rounded-control border border-ink-line bg-surface px-4 py-3 text-sm leading-[1.65] text-ink/85">
      {note}
    </p>
  );
}
