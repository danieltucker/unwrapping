import { formatPrice } from "@/config/site";
import type { ItemKind } from "@/db/schema";

/**
 * Group-gift arithmetic and the words for it. Pure, so the server and the
 * browser answer "is this one still open?" identically; a filter that
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
  kind: ItemKind;
  isGroupGift: boolean;
  raisedCents: number;
  goalCents: number | null;
  unitsFree: number;
}): boolean {
  // An idea is a direction, not a present, so taking one on doesn't use it up:
  // it is open to the next guest however many people are already on it.
  if (item.kind === "idea") return true;

  return item.isGroupGift
    ? !isFullyFunded(item.raisedCents, item.goalCents)
    : item.unitsFree > 0;
}

/** "£244 of £420 raised": the text half of the status, never colour alone. */
export function fundingLine(raisedCents: number, goalCents: number | null): string {
  if (!goalCents) return `${formatPrice(raisedCents)} raised so far`;
  if (raisedCents >= goalCents) return `${formatPrice(goalCents)} goal reached`;
  return `${formatPrice(raisedCents)} of ${formatPrice(goalCents)} raised`;
}
