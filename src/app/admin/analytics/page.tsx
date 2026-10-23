import { eq } from "drizzle-orm";
import type { Metadata } from "next";

import { AdminTracking } from "@/components/admin-tracking";
import { Section } from "@/components/admin-ui";
import { db } from "@/db";
import { lists } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { eventCounts } from "@/lib/analytics";
import { parseTrackingFilter } from "@/lib/tracking-filter";
import { trackingOverview } from "@/lib/tracking-stats";

export const metadata: Metadata = { title: "Analytics · Admin" };

/**
 * What is happening on this instance: event tracking on lists, filterable down
 * to one visitor, and the Secret Santa counts. The filter lives in the URL —
 * see `src/lib/tracking-filter.ts`.
 */
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin();
  const filter = parseTrackingFilter(await searchParams);

  const [tracking, santaEvents, list] = await Promise.all([
    trackingOverview(filter),
    eventCounts(),
    filter.list
      ? db.select({ name: lists.name }).from(lists).where(eq(lists.id, filter.list)).get()
      : Promise.resolve(undefined),
  ]);

  return (
    <>
      <Section
        title="Tracking"
        count={tracking.total}
        note="Ids and counts only"
        empty=""
        bare
        // The switch and the status line have to show before the first event does.
        always
      >
        <AdminTracking overview={tracking} listName={list?.name ?? null} />
      </Section>

      <Section
        title="Secret Santa"
        count={santaEvents.santa_group_created.total}
        note="Counts only: no people, no groups"
        empty="No Secret Santas yet."
        bare
      >
        <dl className="grid gap-2.5 sm:grid-cols-4">
          {(
            [
              ["santa_group_created", "Groups created"],
              ["santa_member_joined", "Members joined"],
              ["santa_draw_run", "Draws run"],
              ["santa_reveal_opened", "Reveals opened"],
            ] as const
          ).map(([event, label]) => (
            <div key={event} className="rounded-card border border-ink-line bg-surface px-5 py-4">
              <dt className="text-xs text-ink-72">{label}</dt>
              <dd className="font-display text-[1.875rem] leading-none">
                {santaEvents[event].last30}
              </dd>
              <dd className="mt-1 text-2xs text-ink-62">
                last 30 days · {santaEvents[event].total} in all
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
