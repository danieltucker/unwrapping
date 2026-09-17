import type { MetadataRoute } from "next";

import { site } from "@/config/site";

/**
 * What a phone uses when someone adds the site to their home screen.
 *
 * Generated rather than kept as a static file so the name follows
 * `src/config/site.ts`: the product name is still provisional, and a manifest
 * is exactly the kind of file that gets left behind saying the old one.
 *
 * The maskable icon is a separate file from the plain one on purpose. Android
 * crops icons to whatever shape the launcher uses, so that copy carries the
 * padding the crop eats; using it everywhere would leave the mark looking
 * small in the tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name}: ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#5738e8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
