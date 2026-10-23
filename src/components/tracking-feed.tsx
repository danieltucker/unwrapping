"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { elapsed } from "@/lib/date";
import { filterHref, filterQuery, isFocused, type TrackingFilter } from "@/lib/tracking-filter";
import type { FeedEvent } from "@/lib/tracking-stats";

const POLL_MS = 5_000;

/**
 * The newest events as they arrive, for /admin/analytics, narrowed by the
 * page's filter. Polls /api/admin/events with the same query while the tab is
 * visible, and keeps the "last event" age ticking between polls.
 *
 * Narrowed to one visitor or session it reads as their timeline. Every
 * visitor, session and list cell links to that narrower view.
 *
 * Remount it (a `key` on the filter) when the filter changes: the events it
 * starts from are only read once.
 */
export function TrackingFeed({
  initial,
  filter,
  path,
}: {
  initial: FeedEvent[];
  filter: TrackingFilter;
  /** The page the links lead back to. */
  path: string;
}) {
  const [events, setEvents] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [stale, setStale] = useState(false);
  const query = filterQuery(filter);
  const timeline = isFocused(filter);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/admin/events${query ? `?${query}` : ""}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { events: FeedEvent[] };
        if (!stopped) {
          setEvents(body.events);
          setStale(false);
        }
      } catch {
        if (!stopped) setStale(true);
      }
    };

    const polling = setInterval(poll, POLL_MS);
    const ticking = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      stopped = true;
      clearInterval(polling);
      clearInterval(ticking);
    };
  }, [query]);

  const last = events[0];
  const narrow = (change: Partial<TrackingFilter>) => filterHref(path, filter, change);

  return (
    <div className="rounded-card border border-ink-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-line px-5 py-3 text-xs">
        <span className="font-semibold">
          {timeline ? `Timeline: ${events.length} events, newest first` : `Live: the latest ${events.length}`}
        </span>
        {/* Times are the reader's own clock and zone, so the server's guess differs. */}
        <span className={stale ? "font-medium text-rose-dark" : "text-ink-62"} suppressHydrationWarning>
          {stale
            ? "Couldn't refresh. Reload the page to check you're still signed in."
            : last
              ? `Last event ${elapsed(now - new Date(last.occurredAt).getTime())} ago · updates every ${POLL_MS / 1000}s`
              : `Nothing yet · updates every ${POLL_MS / 1000}s`}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-72">
          No events match.
        </p>
      ) : (
        <div className={timeline ? "max-h-[40rem] overflow-auto" : "max-h-[26rem] overflow-auto"}>
          <table className="w-full text-left text-2xs">
            <thead className="sticky top-0 bg-surface text-ink-62">
              <tr>
                {["#", "When", "Type", "List", "Gift", "Details", "Visitor", "Session", "Bot"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-ink-line">
                  <td className="px-3 py-1.5 font-mono text-ink-62">{event.id}</td>
                  <td className="whitespace-nowrap px-3 py-1.5" suppressHydrationWarning>
                    {when(event.occurredAt, timeline)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono font-semibold">{event.eventType}</td>
                  <td className="max-w-[12rem] truncate px-3 py-1.5" title={event.listId ?? undefined}>
                    {event.listId ? (
                      <Link
                        href={narrow({ list: event.listId })}
                        className="text-violet hover:text-violet-hover"
                      >
                        {event.listName ?? event.listId.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-1.5 text-ink-76" title={event.itemId ?? undefined}>
                    {event.itemTitle ?? (event.itemId ? event.itemId.slice(0, 8) : "—")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-ink-72">
                    {details(event.properties)}
                  </td>
                  <IdLink value={event.visitorId} href={(id) => narrow({ visitor: id })} label="visitor" />
                  <IdLink value={event.sessionId} href={(id) => narrow({ session: id })} label="session" />
                  <td className="px-3 py-1.5">{event.isBot ? "bot" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Today's events by time alone; a timeline spans days, so it shows the date too. */
function when(iso: string, withDate: boolean): string {
  const date = new Date(iso);
  if (!withDate && date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString();
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** `filter=price · placement=card`: the few fixed properties an event may carry. */
function details(properties: FeedEvent["properties"]): string {
  const entries = Object.entries(properties ?? {});
  return entries.length === 0 ? "" : entries.map(([key, value]) => `${key}=${value}`).join(" · ");
}

/** The first eight characters, which is plenty to tell rows apart by eye. */
function IdLink({
  value,
  href,
  label,
}: {
  value: string | null;
  href: (id: string) => string;
  label: string;
}) {
  return (
    <td className="px-3 py-1.5 font-mono" title={value ?? undefined}>
      {value ? (
        <Link
          href={href(value)}
          className="text-violet hover:text-violet-hover"
          aria-label={`Only this ${label}'s events`}
        >
          {value.slice(0, 8)}
        </Link>
      ) : (
        <span className="text-ink-72">—</span>
      )}
    </td>
  );
}
