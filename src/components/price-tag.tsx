import { formatPrice } from "@/config/site";
import { formatAboutRange, ideaPriceRange } from "@/lib/price";

/**
 * A gift's price as a guest reads it: "about $29.99", or the owner's own words
 * ("from $35") when they typed some. See src/lib/price.ts for why every number
 * says "about".
 *
 * Only the inside of the price: the card around it decides the size and
 * colour of the number. No hooks, so server and client cards can both use it.
 */
export function PriceTag({
  cents,
  label,
}: {
  cents: number | null;
  label: string | null;
}) {
  if (label) {
    // Words run longer than a number, so they get a size that wraps politely
    // next to a title rather than the display size that wouldn't.
    return <span className="whitespace-normal text-right text-base leading-tight">{label}</span>;
  }
  if (cents === null) return null;

  return (
    <>
      <span className="mr-[5px] font-sans text-xs font-medium text-ink-62">about</span>
      {formatPrice(cents)}
    </>
  );
}

/**
 * " · about $12 – $40", after the count of picks under an idea. Nothing when
 * none of them has a price. See ideaPriceRange.
 */
export function IdeaRange({
  suggestions,
}: {
  suggestions: readonly { priceCents: number | null; currency: string }[];
}) {
  const range = ideaPriceRange(suggestions);
  if (!range) return null;
  return (
    <span className="font-medium normal-case tracking-normal">
      {" · "}
      {formatAboutRange(range.minCents, range.maxCents)}
    </span>
  );
}

/** The line under a price box in the add and edit forms. */
export function PriceHint({ id }: { id: string }) {
  return (
    <p id={id} className="mt-[5px] text-2xs leading-[1.4] text-ink-62">
      A number, or a few words like &ldquo;from $35&rdquo;
    </p>
  );
}
