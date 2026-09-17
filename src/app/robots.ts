import type { MetadataRoute } from "next";

import { origin } from "@/lib/origin";

/**
 * Only the landing page is meant to be indexed. Everything else is either
 * somebody's list, somebody's account, or a step in a flow.
 *
 * `/` alone would not say that: a short share code lives at the root
 * (`/abc123`), so the allowance has to be the anchored path and the disallow
 * the everything beneath it.
 */

// The origin is read from the environment at runtime, so this file must not be
// baked into the build: the same image is served from different addresses.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/$",
      disallow: "/",
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
