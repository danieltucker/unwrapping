import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";

import { toggleTrackingPaused } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin-action-button";
import { TrackingFeed } from "@/components/tracking-feed";
import { CapsLabel } from "@/components/ui";
import { ITEM_EVENT_TYPES, type ItemEventType } from "@/db/schema";
import { elapsed } from "@/lib/date";
import { REJECT_REASONS, SKIP_REASONS } from "@/lib/event-validation";
import * as routes from "@/lib/routes";
import {
  DEFAULT_FILTER,
  filterHref,
  filterQuery,
  hidingVisitor,
  type BotMode,
  type TrackingFilter,
  type WindowDays,
} from "@/lib/tracking-filter";
import type { trackingOverview, VisitorRow } from "@/lib/tracking-stats";

type Overview = Awaited<ReturnType<typeof trackingOverview>>;

const PATH = routes.adminAnalytics;

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

const WINDOW_LABELS: Record<WindowDays, string> = { 1: "Today", 7: "7 days", 30: "30 days", 90: "90 days" };
const BOT_LABELS: Record<BotMode, string> = { all: "Everyone", hide: "Hide bots", only: "Bots only" };

/**
 * /admin/analytics' Tracking section: is it on, is anything arriving, and are
 * the filters working — then the same numbers for whatever the filter bar
 * narrows them to. The status line and the switch sit above it all so they
 * are there even before the first event.
 */
export function AdminTracking({
  overview,
  listName,
}: {
  overview: Overview;
  /** The name of the list the filter is narrowed to, when it is. */
  listName: string | null;
}) {
  const {
    enabled,
    paused,
    filter,
    days,
    total,
    botShare,
    lastEvent,
    lastEventAgeMs,
    topItems,
    topVisitors,
    visitor,
    drops,
    feed,
  } = overview;
  const peak = Math.max(1, ...days.map((day) => day.total));
  const rejected = REJECT_REASONS.reduce((sum, reason) => sum + (drops[reason] ?? 0), 0);
  const skipped = SKIP_REASONS.reduce((sum, reason) => sum + (drops[reason] ?? 0), 0);
  const columns = filter.types.length > 0 ? filter.types : ITEM_EVENT_TYPES;
  const span = filter.days === 1 ? "today" : `last ${filter.days} days`;

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

      <FilterBar filter={filter} listName={listName} />

      {filter.visitor ? (
        <VisitorPanel filter={filter} visitorId={filter.visitor} visitor={visitor} span={span} />
      ) : null}

      <dl className="grid gap-2.5 sm:grid-cols-4">
        <Tile label="Events" value={total.toLocaleString()} sub={span} />
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
          sub={`${rejected} refused · ${skipped} skipped · unfiltered`}
        />
      </dl>

      <div className="max-h-[32rem] overflow-auto rounded-card border border-ink-line bg-surface">
        <table className="w-full text-left text-2xs">
          <caption className="px-5 pb-1 pt-3 text-left">
            <CapsLabel>Events per day, {span}</CapsLabel>
          </caption>
          <thead className="text-ink-62">
            <tr>
              <th className="px-3 py-2 pl-5 font-semibold">Day</th>
              <th className="w-[22%] px-3 py-2 font-semibold">Total</th>
              {columns.map((type) => (
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
                {columns.map((type) => (
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
          <CapsLabel className="mb-3">
            Top gifts by clicks out · {filter.bots === "only" ? "bots only" : "people only"}, {span}
          </CapsLabel>
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
          <CapsLabel className="mb-3">Not stored · {span} · not filterable</CapsLabel>
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

      {filter.visitor ? null : <TopVisitors filter={filter} visitors={topVisitors} span={span} />}

      <TrackingFeed key={filterQuery(filter)} initial={feed} filter={filter} path={PATH} />
    </div>
  );
}

/**
 * What the numbers are narrowed to. The window and the bot switch are one
 * press each; event types are a form, because picking several is the point.
 * Whatever is narrowed by a link elsewhere on the page — a visitor, a session,
 * a list, someone hidden — shows here as a chip that takes it off again.
 */
function FilterBar({ filter, listName }: { filter: TrackingFilter; listName: string | null }) {
  const href = (change: Partial<TrackingFilter>) => filterHref(PATH, filter, change);
  const chips: { label: ReactNode; href: string }[] = [
    ...(filter.visitor
      ? [{ label: <>Visitor <Mono>{filter.visitor.slice(0, 8)}</Mono></>, href: href({ visitor: null }) }]
      : []),
    ...(filter.session
      ? [{ label: <>Session <Mono>{filter.session.slice(0, 8)}</Mono></>, href: href({ session: null }) }]
      : []),
    ...(filter.list
      ? [{ label: <>List “{listName ?? filter.list.slice(0, 8)}”</>, href: href({ list: null }) }]
      : []),
    ...filter.hide.map((id) => ({
      label: <>Hiding <Mono>{id.slice(0, 8)}</Mono></>,
      href: href({ hide: filter.hide.filter((other) => other !== id) }),
    })),
  ];
  const filtered = filterQuery(filter) !== "";

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ink-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          label="Window"
          options={([1, 7, 30, 90] as const).map((days) => ({
            label: WINDOW_LABELS[days],
            href: href({ days }),
            active: filter.days === days,
          }))}
        />
        <Segmented
          label="Bots"
          options={(["all", "hide", "only"] as const).map((bots) => ({
            label: BOT_LABELS[bots],
            href: href({ bots }),
            active: filter.bots === bots,
          }))}
        />
        {filtered ? (
          <Link href={PATH} className="text-xs font-semibold text-violet hover:text-violet-hover">
            Clear all filters
          </Link>
        ) : null}
      </div>

      <Form action={PATH} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <CapsLabel>Types</CapsLabel>
        {/* Everything else in the filter rides along unchanged. */}
        {filter.days !== DEFAULT_FILTER.days ? <input type="hidden" name="days" value={filter.days} /> : null}
        {filter.bots !== "all" ? <input type="hidden" name="bots" value={filter.bots} /> : null}
        {filter.visitor ? <input type="hidden" name="visitor" value={filter.visitor} /> : null}
        {filter.session ? <input type="hidden" name="session" value={filter.session} /> : null}
        {filter.list ? <input type="hidden" name="list" value={filter.list} /> : null}
        {filter.hide.map((id) => (
          <input key={id} type="hidden" name="hide" value={id} />
        ))}
        {ITEM_EVENT_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-1.5 text-xs text-ink-76">
            <input
              type="checkbox"
              name="type"
              value={type}
              defaultChecked={filter.types.includes(type)}
              className="accent-violet"
            />
            {SHORT[type]}
          </label>
        ))}
        <button
          type="submit"
          className="rounded-pill border border-ink-line-strong bg-surface px-[15px] py-1.5 text-xs font-semibold transition-colors duration-150 hover:bg-ink/[.03] focus-ring"
        >
          Apply
        </button>
        <span className="text-2xs text-ink-62">None ticked means every type.</span>
      </Form>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.href}>
              <Link
                href={chip.href}
                className="flex items-center gap-1.5 rounded-pill bg-violet-wash px-3 py-1 text-xs font-semibold text-violet-hover hover:bg-violet-edge"
                title="Remove this filter"
              >
                {chip.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One visitor, summed up, with the two ways out: hide them, or go back to everyone. */
function VisitorPanel({
  filter,
  visitorId,
  visitor,
  span,
}: {
  filter: TrackingFilter;
  visitorId: string;
  visitor: Overview["visitor"];
  span: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-violet-edge bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <strong className="font-semibold">One visitor</strong>{" "}
          <Mono className="text-xs text-ink-72">{visitorId}</Mono>
        </p>
        <div className="flex flex-wrap gap-2">
          <PillLink href={filterHref(PATH, filter, hidingVisitor(filter, visitorId))}>
            Hide this visitor
          </PillLink>
          <PillLink href={filterHref(PATH, filter, { visitor: null })}>Back to everyone</PillLink>
        </div>
      </div>
      {visitor ? (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-6">
          <Fact label="Events" value={visitor.events.toLocaleString()} />
          <Fact label="Sessions" value={visitor.sessions.toLocaleString()} />
          <Fact label="Lists" value={visitor.lists.toLocaleString()} />
          <Fact label="Flagged as bot" value={`${visitor.botEvents} of ${visitor.events}`} />
          <Fact label="First seen" value={`${elapsed(visitor.firstSeenAgoMs)} ago`} />
          <Fact label="Last seen" value={`${elapsed(visitor.lastSeenAgoMs)} ago`} />
        </dl>
      ) : (
        <p className="text-sm text-ink-72">Nothing from this visitor matches, {span}.</p>
      )}
      <p className="text-2xs text-ink-62">
        A visitor is a browser&apos;s random cookie id, not an account: the same person on their
        phone is another visitor, and a crawler that drops cookies is a new one every time.
      </p>
    </div>
  );
}

/**
 * The busiest visitors in view. A bot the user-agent check missed shows up
 * here as one id with far more events than a person makes, and Hide takes it
 * out of every number on the page.
 */
function TopVisitors({
  filter,
  visitors,
  span,
}: {
  filter: TrackingFilter;
  visitors: VisitorRow[];
  span: string;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-ink-line bg-surface">
      <table className="w-full text-left text-2xs">
        <caption className="px-5 pb-1 pt-3 text-left">
          <CapsLabel>Busiest visitors, {span}</CapsLabel>
        </caption>
        <thead className="text-ink-62">
          <tr>
            {["Visitor", "Events", "Sessions", "Lists", "Last seen", "", ""].map((h, i) => (
              <th key={i} className={`px-3 py-2 font-semibold ${i === 0 ? "pl-5" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visitors.length === 0 ? (
            <tr className="border-t border-ink-line">
              <td colSpan={7} className="px-5 py-4 text-center text-sm text-ink-72">
                No visitors match.
              </td>
            </tr>
          ) : (
            visitors.map((row) => (
              <tr key={row.visitorId} className="border-t border-ink-line">
                <td className="px-3 py-1.5 pl-5 font-mono" title={row.visitorId}>
                  <Link
                    href={filterHref(PATH, filter, { visitor: row.visitorId })}
                    className="text-violet hover:text-violet-hover"
                  >
                    {row.visitorId.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-1.5 font-semibold tabular-nums">{row.events}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.sessions}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.lists}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-ink-72">
                  {elapsed(row.lastSeenAgoMs)} ago
                </td>
                <td className="px-3 py-1.5">
                  {row.botEvents > 0 ? (
                    <span className="rounded-pill bg-rose-wash px-2 py-0.5 font-semibold text-rose">
                      {row.botEvents === row.events ? "bot" : `bot ${row.botEvents}/${row.events}`}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 pr-5 text-right">
                  <Link
                    href={filterHref(PATH, filter, hidingVisitor(filter, row.visitorId))}
                    className="font-semibold text-ink-72 hover:text-ink"
                  >
                    Hide
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Segmented({
  label,
  options,
}: {
  label: string;
  options: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <CapsLabel>{label}</CapsLabel>
      <div className="flex rounded-pill border border-ink-line-strong p-0.5">
        {options.map((option) => (
          <Link
            key={option.label}
            href={option.href}
            aria-current={option.active ? "true" : undefined}
            className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors duration-150 focus-ring ${
              option.active ? "bg-ink text-surface" : "text-ink-72 hover:text-ink"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function PillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-pill border border-ink-line-strong bg-surface px-[15px] py-1.5 text-xs font-semibold transition-colors duration-150 hover:bg-ink/[.03] focus-ring"
    >
      {children}
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs text-ink-62">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
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
