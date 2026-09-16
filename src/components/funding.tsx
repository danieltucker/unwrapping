import { formatPrice } from "@/config/site";
import { fundingPercent } from "@/lib/funding";

/**
 * The rose progress bar. Rose means group gift and nothing else, so this is the
 * only place it appears outside a chip-in control. The arithmetic and the words
 * that go with it live in @/lib/funding.
 */
export function FundingBar({
  raisedCents,
  goalCents,
  className = "",
}: {
  raisedCents: number;
  goalCents: number | null;
  className?: string;
}) {
  if (!goalCents) return null;

  return (
    <div
      className={`h-1.5 overflow-hidden rounded-pill bg-ink/[.08] ${className}`}
      role="progressbar"
      aria-label="Amount raised so far"
      aria-valuenow={raisedCents}
      aria-valuemin={0}
      aria-valuemax={goalCents}
      aria-valuetext={`${formatPrice(raisedCents)} of ${formatPrice(goalCents)} raised`}
    >
      <div
        className="h-full rounded-pill bg-rose"
        style={{ width: `${fundingPercent(raisedCents, goalCents)}%` }}
      />
    </div>
  );
}
