import { toggleTrackingPaused } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin-action-button";
import { TrackingFeed } from "@/components/tracking-feed";
import { CapsLabel } from "@/components/ui";
import { ITEM_EVENT_TYPES, type ItemEventType } from "@/db/schema";
import { elapsed } from "@/lib/date";
import { REJECT_REASONS, SKIP_REASONS } from "@/lib/event-validation";
import type { trackingOverview } from "@/lib/tracking-stats";

type Overview = Awaited<ReturnType<typeof trackingOverview>>;

/** Column headings for the per-day table; the full names are in the feed. */
const SHORT: Record<ItemEventType, string> = {
  list_view: "Views",
  idea_expand: "Idea opens",
  item_impression: "Impressions",
  outbound_click: "Clicks out",
  filter_used: "Filters",
  sort_used: "Sorts",
  suggestion_impression: "Tiles seen",
  suggestion_click: "Tiles opened",
  item_claim: "Claims",
};

const REASON_LABELS: Record<string, string> = {
  bad_json: "Not valid JSON",
  too_large: "Body over 16KB",
  too_many: "Over 50 in a batch",
  unknown_type: "Unknown event type",
  bad_ids: "Missing or malformed ids",
  bad_props: "Properties not allowed",
  unknown_ids: "Ids that don't exist",
  rate_limited: "Rate limited",
  dnt: "Do Not Track",
  owner: "Owner's own list",
  paused: "While paused",
};

/**
 * /admin's Tracking section: is it on, is anything arriving, and are the
 * filters working. The status line and the switch sit above the numbers so
 * they are there even before the first event.
 */
export function AdminTracking({ overview }: { overview: Overview }) {
  const { enabled, paused, days, total, botShare, lastEvent, lastEventAgeMs, topItems, drops, feed } =
    overview;
  const peak = Math.max(1, ...days.map((day) => day.total));
  const rejected = REJECT_REASONS.reduce((sum, reason) => sum + (drops[reason] ?? 0), 0);
  const skipped = SKIP_REASONS.reduce((sum, reason) => sum + (drops[reason] ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink-line bg-surface px-5 py-4">
        <p className="text-sm">
          {!enabled ? (
            <>
              <strong className="font-semibold">Off.</strong> Buy buttons go straight to the shop and
              nothing is recorded. Remove <code className="font-mono text-xs">EVENT_TRACKING</code> or set
              it to <code className="font-mono text-xs">on</code>, and restart, to turn it on.
            </>
          ) : paused ? (
            <>
              <strong className="font-semibold text-rose-dark">Paused.</strong> Links still go through
              /go to the shop; nothing is being recorded.
            </>
          ) : (
            <>
              <strong className="font-semibold text-pine-dark">Recording.</strong> No names, emails,
              IP addresses or user agents are stored, and raw events are deleted after 13 months.
            </>
          )}
        </p>
        {enabled ? (
          <AdminActionButton
            action={toggleTrackingPaused}
            label={paused ? "Resume recording" : "Pause recording"}
            busyLabel={paused ? "Resuming…" : "Pausing…"}
          />
        ) : null}
      </div>

      <dl className="grid gap-2.5 sm:grid-cols-4">
        <Tile label="Events" value={total.toLocaleString()} sub="last 30 days" />
        <Tile
          label="From bots"
          value={botShare === null ? "–" : `${Math.round(botShare * 100)}%`}
          sub="flagged by user agent"
        />
        <Tile
          label="Last event"
          value={lastEventAgeMs === null ? "–" : `${elapsed(lastEventAgeMs)} ago`}
          sub={lastEvent ? lastEvent.eventType : "nothing yet"}
        />
        <Tile
          label="Turned away"
          value={(rejected + skipped).toLocaleString()}
          sub={`${rejected} refused · ${skipped} skipped`}
        />
      </dl>

      <div className="overflow-x-auto rounded-card border border-ink-line bg-surface">
        <table className="w-full text-left text-2xs">
          <caption className="px-5 pb-1 pt-3 text-left">
            <CapsLabel>Events per day, last 30 days</CapsLabel>
          </caption>
          <thead className="text-ink-62">
            <tr>
              <th className="px-3 py-2 pl-5 font-semibold">Day</th>
              <th className="w-[22%] px-3 py-2 font-semibold">Total</th>
              {ITEM_EVENT_TYPES.map((type) => (
                <th key={type} className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                  {SHORT[type]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.day} className="border-t border-ink-line">
                <td className="whitespace-nowrap px-3 py-1.5 pl-5 text-ink-72">{day.day}</td>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    {/* One series, so one colour; the number beside it is the value. */}
                    <span
                      className="h-2 rounded-r-[4px] bg-violet"
                      style={{ width: `${(day.total / peak) * 100}%`, minWidth: day.total ? 2 : 0 }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold tabular-nums">{day.total}</span>
                  </span>
                </td>
                {ITEM_EVENT_TYPES.map((type) => (
                  <td key={type} className="px-3 py-1.5 text-right tabular-nums text-ink-76">
                    {day.counts[type] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-ink-line bg-surface px-5 py-4">
          <CapsLabel className="mb-3">Top gifts by clicks out · people only, 30 days</CapsLabel>
          {topItems.length === 0 ? (
            <p className="text-sm text-ink-72">No clicks out yet.</p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {topItems.map((item, index) => (
                <li key={item.itemId} className="flex items-baseline gap-3">
                  <span className="w-5 text-right text-xs text-ink-62">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{item.title}</span>
                    <span className="text-ink-62"> · {item.listName}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{item.clicks}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-card border border-ink-line bg-surface px-5 py-4">
          <CapsLabel className="mb-3">Not stored · 30 days</CapsLabel>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            {[...REJECT_REASONS, ...SKIP_REASONS].map((reason) => (
              <div key={reason} className="contents">
                <dt className="text-ink-72">
                  {REASON_LABELS[reason]}
                  {(SKIP_REASONS as readonly string[]).includes(reason) ? (
                    <span className="text-ink-62"> · skipped</span>
                  ) : null}
                </dt>
                <dd className="text-right font-semibold tabular-nums">{drops[reason] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <TrackingFeed initial={feed} />
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-card border border-ink-line bg-surface px-5 py-4">
      <dt className="text-xs text-ink-72">{label}</dt>
      <dd className="font-display text-[1.875rem] leading-none">{value}</dd>
      <dd className="mt-1 text-2xs text-ink-62">{sub}</dd>
    </div>
  );
}
