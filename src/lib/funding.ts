import { formatPrice } from "@/config/site";

/**
 * Group-gift arithmetic and the words for it. Pure, so the server and the
 * browser answer "is this one still open?" identically — a filter that
 * disagreed with the count above it would look like a bug.
 */

/** How far a group gift has got, capped at 100 so an overshoot doesn't overflow. */
export function fundingPercent(raisedCents: number, goalCents: number | null): number {
  if (!goalCents || goalCents <= 0) return 0;
  return Math.min(Math.round((raisedCents / goalCents) * 100), 100);
}

export function isFullyFunded(raisedCents: number, goalCents: number | null): boolean {
  return goalCents !== null && goalCents > 0 && raisedCents >= goalCents;
}

/** Still something a guest could act on: not claimed out, not fully funded. */
export function isStillOpen(item: {
  isGroupGift: boolean;
  raisedCents: number;
  goalCents: number | null;
  unitsFree: number;
}): boolean {
  return item.isGroupGift
    ? !isFullyFunded(item.raisedCents, item.goalCents)
    : item.unitsFree > 0;
}

/** "£244 of £420 raised" — the text half of the status, never colour alone. */
export function fundingLine(raisedCents: number, goalCents: number | null): string {
  if (!goalCents) return `${formatPrice(raisedCents)} raised so far`;
  if (raisedCents >= goalCents) return `${formatPrice(goalCents)} goal reached`;
  return `${formatPrice(raisedCents)} of ${formatPrice(goalCents)} raised`;
}
