import { ImageResponse } from "next/og";

import { site } from "@/config/site";

/**
 * The picture that appears when a link is pasted into a message.
 *
 * It sits at the root of `app/`, so every page falls back to it, including a
 * shared list. That is deliberate: the preview must say nothing about which
 * list it is. A guest pasting "maya-30" into a group chat should not give the
 * gifts away in the unfurl, and neither should the birthday girl seeing it.
 *
 * Drawn rather than served as a file so the palette follows globals.css, and
 * no font is loaded: next/og's built-in face is close enough at this size, and
 * fetching one would make the build depend on the network.
 */

export const alt = `${site.name}: ${site.searchTitle}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#17112b",
          color: "#faf8f5",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* The mark from icon.svg, inverted: the unfurl sits on ink, where a
              violet tile would all but disappear. */}
          <svg width="52" height="52" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="16" fill="#faf8f5" />
            <path
              d="M31 33.5a3.5 3.5 0 0 1 3.5-3.5a7 7 0 0 1 7 7a10.5 10.5 0 0 1-10.5 10.5a14 14 0 0 1-14-14a17.5 17.5 0 0 1 17.5-17.5a21 21 0 0 1 19 12"
              fill="none"
              stroke="#5738e8"
              strokeWidth={6.5}
              strokeLinecap="round"
            />
          </svg>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{site.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 900,
            }}
          >
            {site.tagline}
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.45, maxWidth: 860, color: "rgba(250,248,245,0.74)" }}>
            Paste links from any shop. Share one link. Nobody buys the same
            thing twice.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            color: "#f2d48b",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#f2d48b",
            }}
          />
          {site.domain}
        </div>
      </div>
    ),
    size,
  );
}
