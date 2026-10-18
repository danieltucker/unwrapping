import { formatPrice } from "@/config/site";

/**
 * "Down $12 since it was added", under a gift's price.
 *
 * Only drawn when the monthly recheck saw the shop's price move; a price the
 * owner typed has no history to compare against. A drop is good news for
 * whoever is buying, so it gets the pine; a rise is just information.
 */
export function PriceChange({
  nowCents,
  wasCents,
  className = "",
}: {
  nowCents: number | null;
  wasCents: number | null;
  className?: string;
}) {
  if (nowCents === null || wasCents === null || nowCents === wasCents) return null;

  const down = nowCents < wasCents;
  const difference = formatPrice(Math.abs(nowCents - wasCents));

  return (
    <p
      className={`text-xs font-semibold ${down ? "text-pine-dark" : "text-ink-62"} ${className}`}
    >
      {down ? `↓ Down ${difference}` : `↑ Up ${difference}`} since it was added
      <span className="font-medium text-ink-62">
        {" "}
        · was <s>{formatPrice(wasCents)}</s>
      </span>
    </p>
  );
}
