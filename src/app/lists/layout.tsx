import type { Metadata } from "next";

/**
 * This layout exists only to carry one piece of metadata down to every page
 * under /lists: a list is unlisted, not public. A crawler that reached one
 * through a shared link would otherwise publish somebody's birthday, and the
 * pages themselves each set only a title, so they inherit this.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ListsLayout({ children }: LayoutProps<"/lists">) {
  return children;
}
