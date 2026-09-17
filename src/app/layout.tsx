import type { Metadata, Viewport } from "next";
import { Gabarito, Instrument_Serif } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/config/site";
import { origin } from "@/lib/origin";
import "./globals.css";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  // Resolves every relative URL below, and the canonical and og:url on each
  // page. Without it a share preview points at localhost in production.
  metadataBase: new URL(origin),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name}: ${site.searchTitle}`,
    description: site.description,
    url: "/",
    locale: site.locale.replace("-", "_"),
  },
  twitter: { card: "summary_large_image" },
  // Lists are unlisted rather than secret, and a crawler that found one would
  // publish somebody's birthday. Each page under /lists opts back out too, so
  // this holds even for a crawler that ignores robots.txt.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/**
 * The violet from the mark, which is what Android paints the browser bar and
 * the task switcher with. Kept in step with `--color-violet` in globals.css
 * and with the tile in `icon.svg`; nothing reads CSS variables this early.
 */
export const viewport: Viewport = {
  themeColor: "#5738e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${gabarito.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
