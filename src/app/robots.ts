import type { MetadataRoute } from "next";

import { publishedGuides } from "@/lib/guides";
import { origin } from "@/lib/origin";
import * as routes from "@/lib/routes";

/**
 * Only public pages are meant to be indexed: the landing page, the gift lists
 * on /gifts, and each published guide. Everything else is either somebody's
 * list, somebody's account, or a step in a flow.
 *
 * `/` alone would not say that: a short share code lives at the root
 * (`/abc123`), so the allowance has to be the anchored path and the disallow
 * the everything beneath it.
 *
 * Published guides live under /lists like every other list, so each is
 * allowed by its exact path rather than by a pattern; the longest matching
 * rule wins, so these beat the blanket disallow without letting a crawler
 * into anybody's birthday. Their pages say `index` as well — see
 * generateMetadata in /lists/[handle]/[slug] — while every other list says
 * `noindex`, through the /lists layout.
 */

// The origin is read from the environment at runtime, so this file must not be
// baked into the build: the same image is served from different addresses.
export const dynamic = "force-dynamic";

/** Generous: a robots.txt this long is still a few kilobytes. */
const MAX_GUIDES = 5000;

export default async function robots(): Promise<MetadataRoute.Robots> {
  let guides: string[] = [];
  try {
    guides = (await publishedGuides({ order: "newest", limit: MAX_GUIDES })).map(
      (guide) => guide.href,
    );
  } catch (error) {
    // A database that can't answer still gets a robots.txt, just a stricter
    // one: crawlers are kept out of everything but the landing page and /gifts
    // until it can.
    console.error("[robots] could not read published guides:", error);
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/$", `${routes.giftGuides}$`, `${routes.giftGuides}/`, ...guides.map((path) => `${path}$`)],
      disallow: ["/", routes.newGiftGuide],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
