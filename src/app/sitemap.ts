import type { MetadataRoute } from "next";

import { allCategories, publishedGuides } from "@/lib/guides";
import { origin } from "@/lib/origin";
import * as routes from "@/lib/routes";

/**
 * The public pages, and nothing else: the landing page, /gifts, each category
 * shelf, and every published gift guide. Personal lists belong to the people
 * holding the link and must never be enumerated here; robots.ts draws the same
 * line.
 */

// Same reason as robots.ts: the origin is a runtime value.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, guides] = await Promise.all([
    allCategories(),
    publishedGuides({ order: "newest", limit: 5000 }),
  ]);

  return [
    {
      url: `${origin}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${origin}${routes.giftGuides}`,
      lastModified: guides[0]?.publishedAt ?? new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    // The overview only. Every exchange under it is somebody's family.
    {
      url: `${origin}${routes.secretSanta}`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...categories.map((category) => ({
      url: `${origin}${routes.giftCategory(category.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...guides.map((guide) => ({
      url: `${origin}${guide.href}`,
      lastModified: guide.publishedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
