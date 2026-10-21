import { ImageResponse } from "next/og";

import { site } from "@/config/site";

/**
 * The Secret Santa link preview, drawn the same way as the site's own (see
 * src/app/opengraph-image.tsx): ink, the mark, no fetched font. Used by the
 * overview and by each invite link, which fill in their own words.
 *
 * Whatever is passed here is shown to anyone the link is pasted in front of,
 * so an invite passes counts and amounts and never a person's name.
 */
export const santaOgSize = { width: 1200, height: 630 };

export function santaOgImage({
  eyebrow,
  title,
  facts,
  footer,
}: {
  eyebrow: string;
  title: string;
  /** Short lines shown as chips: "6 people in", "$25 each". */
  facts: string[];
  footer: string;
}) {
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
          <div style={{ fontSize: 26, color: "#f2d48b", marginLeft: 12 }}>{eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 1000 }}>
            {title}
          </div>
          {facts.length ? (
            <div style={{ display: "flex", gap: 14 }}>
              {facts.map((fact) => (
                <div
                  key={fact}
                  style={{
                    fontSize: 28,
                    padding: "10px 22px",
                    borderRadius: 999,
                    background: "rgba(250,248,245,0.1)",
                    color: "#faf8f5",
                  }}
                >
                  {fact}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 26, color: "rgba(250,248,245,0.74)" }}>{footer}</div>
      </div>
    ),
    santaOgSize,
  );
}
