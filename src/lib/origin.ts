import "server-only";

import { site } from "@/config/site";

/**
 * The address this instance is actually served from.
 *
 * Canonical URLs, Open Graph tags, robots.txt and the sitemap all need an
 * absolute URL, and only the deployment knows what it is: the same image runs
 * on unwrapp.ing, on a NAS at http://nas.local:3000, and behind somebody's
 * reverse proxy.
 *
 * Deliberately not `NEXT_PUBLIC_`: that would be frozen into the browser bundle
 * at build time, so one image could not be served from two addresses. Nothing
 * in the browser needs this, which is why the module is server-only.
 */
export const origin = (process.env.SITE_URL ?? `https://${site.domain}`).replace(
  /\/+$/,
  "",
);

/**
 * Whether cookies set by this instance may be marked `Secure`.
 *
 * A `Secure` cookie sent over plain http is silently dropped by the browser,
 * and a dropped session cookie looks exactly like a sign-in that does nothing.
 * Somebody running this on their own network over http is the normal case, so
 * the flag follows the origin they told us about rather than NODE_ENV alone.
 */
export const secureCookies =
  process.env.NODE_ENV === "production" && origin.startsWith("https://");

/**
 * The origin without its scheme, for the share panel and anywhere else a URL is
 * shown to be read out or typed rather than clicked: `unwrapp.ing/lists/daniel/
 * birthday`, not `https://unwrapp.ing/...`.
 */
export const displayHost = origin.replace(/^https?:\/\//, "");
