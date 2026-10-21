import type { Metadata } from "next";

/**
 * Like /lists: everything under /secret-santa is somebody's family, reached by
 * a link shared in a group chat, and never belongs in a search result. The
 * overview at /secret-santa itself is the one exception, and says so on its
 * own page; see robots.ts as well.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function SecretSantaLayout({ children }: LayoutProps<"/secret-santa">) {
  return children;
}
