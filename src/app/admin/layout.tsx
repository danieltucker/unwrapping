import type { Metadata } from "next";

import { AdminTabs } from "@/components/admin-tabs";
import { requireAdmin } from "@/lib/admin";
import * as routes from "@/lib/routes";
import { openReports } from "@/lib/secret-santa";

export const metadata: Metadata = {
  title: "Admin",
  // Every account on the instance, a few clicks apart. Nothing here belongs
  // anywhere near a search index.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The operator's screen, in three tabs: what is happening (Analytics), who is
 * here (Accounts), and what they have made (Lists).
 *
 * Reachable only by administrators: whoever the operator named in ADMIN_EMAILS,
 * and whoever they have made one from the Accounts tab — see
 * `src/lib/admin.ts`. Nobody else gets a 403; they get the 404 they would get
 * for a list that isn't theirs, because a signed-in stranger shouldn't learn
 * this screen exists.
 *
 * Each page checks again for itself. A layout isn't re-rendered on every
 * navigation between its pages, so it can't be the only gate.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  // On the tab, so a reported message isn't missed while looking at another one.
  const reports = await openReports();

  return (
    <main className="mx-auto w-full max-w-[64rem] px-[1.375rem] py-10 sm:px-8">
      <h1 className="mb-2 font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em]">
        Admin
      </h1>
      <p className="mb-6 max-w-[44rem] text-sm leading-relaxed text-ink-76">
        Everything on this instance. Deleting here is immediate and permanent —
        there is no trash and no undo, and the people it belongs to are not told.
      </p>

      <AdminTabs
        tabs={[
          { segment: "analytics", href: routes.adminAnalytics, label: "Analytics" },
          { segment: "accounts", href: routes.adminAccounts, label: "Accounts", badge: reports.length },
          { segment: "lists", href: routes.adminLists, label: "Lists & categories" },
        ]}
      />

      {children}
    </main>
  );
}
