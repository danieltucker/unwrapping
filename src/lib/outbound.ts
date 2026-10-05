/**
 * Every link that sends a guest to a shop goes through here.
 *
 * Links can carry referral/affiliate tags, so no component should ever render a
 * raw `item.url`. The stored URL stays canonical and untouched; tags are
 * applied at render time, which keeps them recomputable when programmes change.
 */

import { site } from "@/config/site";
import { sourceDomain } from "@/lib/scrape-parse";

// Re-exported so callers keep importing link helpers from one place.
export { sourceDomain };

/**
 * Per-retailer referral configuration, keyed by `sourceDomain`. Associates tags
 * are per-marketplace: a "-20" tag only earns on amazon.com, so other Amazon
 * stores stay untagged until their own programmes are signed up to.
 *
 * `disclosure` is the statement the programme requires wherever its tagged
 * links appear; Amazon's wording is prescribed by the Associates agreement.
 */
const REFERRAL_TAGS: Record<
  string,
  { param: string; value: string; disclosure: string }
> = {
  "amazon.com": {
    param: "tag",
    value: "unwrapping0b-20",
    disclosure: `As an Amazon Associate, ${site.name} earns from qualifying purchases.`,
  },
};

export type LinkContext = "web" | "email";

export function outboundHref(
  url: string | null | undefined,
  context: LinkContext = "web",
): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Only ever follow http(s); a stored javascript: or data: URL must not render.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  // Several affiliate programmes forbid tagged links inside email, so email
  // links stay clean.
  if (context === "email") return parsed.toString();

  const tag = REFERRAL_TAGS[sourceDomain(parsed.toString()) ?? ""];
  if (tag && !parsed.searchParams.has(tag.param)) {
    parsed.searchParams.set(tag.param, tag.value);
  }

  return parsed.toString();
}

/**
 * The disclosures a page owes for the links on it, one per programme. Empty
 * when nothing on the page is tagged, so pages without referral links stay
 * free of the line.
 */
export function referralDisclosures(
  hrefs: Iterable<string | null | undefined>,
): string[] {
  const owed = new Set<string>();
  for (const href of hrefs) {
    const tag = REFERRAL_TAGS[sourceDomain(href) ?? ""];
    if (tag && href && new URL(href).searchParams.get(tag.param) === tag.value) {
      owed.add(tag.disclosure);
    }
  }
  return [...owed];
}
