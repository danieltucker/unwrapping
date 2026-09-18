"use client";

/**
 * The last resort: an error in the root layout itself, where error.tsx cannot
 * help because the layout it lives inside is the thing that failed.
 *
 * This file replaces the whole document, which means no layout, no header, and
 * — the part that catches people out — no globals.css and no fonts, since those
 * are imported by the layout that is no longer rendering. So the styles here
 * are written out by hand against the design tokens rather than in Tailwind.
 * Ugly to maintain, but it is the one page that must never depend on anything.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "22px",
          background: "#faf8f5",
          color: "#17112b",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <title>Something went wrong · Unwrap</title>
        <div style={{ maxWidth: "26rem" }}>
          <p style={{ fontSize: "2.5rem", margin: "0 0 12px" }} aria-hidden="true">
            🎁
          </p>
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: "2rem",
              lineHeight: 1.1,
              letterSpacing: "-0.8px",
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 400,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "0.875rem",
              lineHeight: 1.7,
              color: "rgba(23, 17, 43, 0.76)",
            }}
          >
            The page couldn&rsquo;t be built. Nothing you had already saved is
            affected.
          </p>

          <button
            type="button"
            onClick={() => retry()}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "13px 24px",
              background: "#5738e8",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          {error.digest ? (
            <p
              style={{
                marginTop: "32px",
                fontSize: "0.6875rem",
                fontFamily: "ui-monospace, Menlo, monospace",
                color: "rgba(23, 17, 43, 0.62)",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
