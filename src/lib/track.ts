/**
 * The browser's half of event tracking: `track(type, data)` queues an event and
 * the queue is sent to /api/events in batches with sendBeacon, which survives
 * the page being closed or navigated away from.
 *
 * Only the components in src/components/tracking.tsx call this, and they are
 * only rendered while EVENT_TRACKING is on and the viewer isn't the list's
 * owner, so with tracking off nothing here ever runs. The server checks both
 * again, and everything else besides; see src/lib/tracking.ts.
 *
 * Browser only. Holds no ids: the server sets them as cookies on its answer.
 */
import type { ClientEvent, ClientEventType } from "@/lib/event-validation";

const ENDPOINT = "/api/events";
/** Comfortably inside the server's 50-event, 16KB limit. */
const BATCH_SIZE = 20;
const FLUSH_AFTER_MS = 5_000;

/**
 * The share of item impressions sent. At 1 every one is; below 1 each sent
 * event carries the rate as `sample`, so a total can be scaled back up.
 */
export const IMPRESSION_SAMPLE = 1;

const queue: ClientEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

/** Do Not Track, or Global Privacy Control. Either means nothing is sent. */
function declined(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const win = window as Window & { doNotTrack?: string };
  return nav.doNotTrack === "1" || win.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

export function track(type: ClientEventType, data: Omit<ClientEvent, "type">): void {
  if (typeof window === "undefined" || declined()) return;
  listen();
  queue.push({ type, ...data });
  if (queue.length >= BATCH_SIZE) flush();
  else timer ??= setTimeout(flush, FLUSH_AFTER_MS);
}

/** Sends whatever is queued, now. */
export function flush(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;

  while (queue.length > 0) {
    const events = queue.splice(0, BATCH_SIZE);
    const body = JSON.stringify({ events, webdriver: navigator.webdriver === true });

    let sent = false;
    try {
      sent = navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" })) ?? false;
    } catch {
      // Some browsers throw rather than return false when the beacon is refused.
    }
    if (!sent) {
      fetch(ENDPOINT, {
        method: "POST",
        body,
        keepalive: true,
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
      }).catch(() => {});
    }
  }
}

function listen() {
  if (listening) return;
  listening = true;
  // The last moment a page is guaranteed to be able to send anything.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/* -------------------------------------------------------------------------- */
/* One of each per page view                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What this page view has already reported. A view is one visit to one path,
 * so filtering the grid, which unmounts and remounts the cards, doesn't count
 * a gift again, and coming back to the list later does.
 */
let viewPath: string | null = null;
const seen = new Set<string>();

/** True the first time `key` is asked for in this page view. */
export function firstInView(key: string): boolean {
  if (location.pathname !== viewPath) {
    viewPath = location.pathname;
    seen.clear();
  }
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

/** At most one impression per gift per page view, sampled at IMPRESSION_SAMPLE. */
export function trackImpression(listId: string, itemId: string): void {
  if (!firstInView(`item:${itemId}`)) return;
  if (IMPRESSION_SAMPLE < 1 && Math.random() >= IMPRESSION_SAMPLE) return;
  track("item_impression", {
    listId,
    itemId,
    ...(IMPRESSION_SAMPLE < 1 ? { props: { sample: IMPRESSION_SAMPLE } } : {}),
  });
}
