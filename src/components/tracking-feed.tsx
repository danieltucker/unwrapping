"use client";

import { useEffect, useState } from "react";

import { elapsed } from "@/lib/date";
import type { FeedEvent } from "@/lib/tracking-stats";

const POLL_MS = 5_000;

/**
 * The newest events as they arrive, for /admin. Ids and types only — there is
 * nothing else in a row to show. Polls /api/admin/events while the tab is
 * visible, and keeps the "last event" age ticking between polls.
 */
export function TrackingFeed({ initial }: { initial: FeedEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/admin/events", { cache: "no-store" });
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
  }, []);

  const last = events[0];

  return (
    <div className="rounded-card border border-ink-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-line px-5 py-3 text-xs">
        <span className="font-semibold">Live: the latest {events.length}</span>
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
          No events have been recorded.
        </p>
      ) : (
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-left font-mono text-2xs">
            <thead className="sticky top-0 bg-surface text-ink-62">
              <tr>
                {["#", "When", "Type", "List", "Item", "Idea", "Visitor", "Session", "Bot"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-ink-line">
                  <td className="px-3 py-1.5 text-ink-62">{event.id}</td>
                  <td className="whitespace-nowrap px-3 py-1.5" suppressHydrationWarning>
                    {new Date(event.occurredAt).toLocaleTimeString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-semibold">{event.eventType}</td>
                  <Id value={event.listId} />
                  <Id value={event.itemId} />
                  <Id value={event.ideaId} />
                  <Id value={event.visitorId} />
                  <Id value={event.sessionId} />
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

/** The first eight characters, which is plenty to tell rows apart by eye. */
function Id({ value }: { value: string | null }) {
  return (
    <td className="px-3 py-1.5 text-ink-72" title={value ?? undefined}>
      {value ? value.slice(0, 8) : "—"}
    </td>
  );
}
