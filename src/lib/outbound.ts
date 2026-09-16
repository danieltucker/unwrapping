/**
 * Every link that sends a guest to a shop goes through here.
 *
 * Referral/affiliate tagging is planned, so no component should ever render a
 * raw `item.url`. The stored URL stays canonical and untouched; tags are
 * applied at render time, which keeps them recomputable when programmes change.
 */

import { sourceDomain } from "@/lib/scrape-parse";

// Re-exported so callers keep importing link helpers from one place.
export { sourceDomain };

/** Per-retailer referral configuration. Empty until programmes are signed up to. */
const REFERRAL_TAGS: Record<string, { param: string; value: string }> = {
  // "amazon.com": { param: "tag", value: "unwrap-20" },
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

/** True once any referral programme is configured — drives the disclosure line. */
export function hasReferralTags(): boolean {
  return Object.keys(REFERRAL_TAGS).length > 0;
}
