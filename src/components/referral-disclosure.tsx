import { referralDisclosures } from "@/lib/outbound";

/**
 * The statement a referral programme requires on any page carrying its tagged
 * links. Renders nothing when none of `hrefs` is tagged.
 */
export function ReferralDisclosure({
  hrefs,
  className,
}: {
  hrefs: Iterable<string | null | undefined>;
  className?: string;
}) {
  const disclosures = referralDisclosures(hrefs);
  if (disclosures.length === 0) return null;

  return (
    <p className={`text-xs leading-relaxed ${className ?? "text-ink-62"}`}>
      {disclosures.join(" ")}
    </p>
  );
}
