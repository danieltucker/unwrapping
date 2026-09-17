import type { MetadataRoute } from "next";

import { origin } from "@/lib/origin";

/**
 * One entry, deliberately. Lists belong to the people holding the link and must
 * never be enumerated here; the sign-in and create flows have nothing to rank
 * for. When there are real content pages (occasions, pricing), add them.
 */

// Same reason as robots.ts: the origin is a runtime value.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${origin}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
