"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { firstInView, flush, track, trackImpression } from "@/lib/track";

/**
 * The pieces of a page that report what happens on it. See src/lib/track.ts.
 *
 * A list page wraps itself in TrackingScope, which says which list this is and
 * whether to report at all; everything inside asks the scope rather than being
 * handed a flag. Outside a scope, or with it disabled — tracking off, or the
 * owner looking at their own list — every piece here renders nothing and
 * sends nothing. The Secret Santa page shows the same cards with no scope.
 */

const Scope = createContext<{ listId: string } | null>(null);

export function TrackingScope({
  listId,
  enabled,
  children,
}: {
  listId: string;
  enabled: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    // Once per page view, so React running effects twice in development
    // doesn't count the view twice.
    if (enabled && firstInView(`view:${listId}`)) track("list_view", { listId });
  }, [enabled, listId]);

  return <Scope.Provider value={enabled ? { listId } : null}>{children}</Scope.Provider>;
}

/** The list being reported on, or null when nothing should be. */
export function useTrackingScope() {
  return useContext(Scope);
}

/**
 * Watches the element it sits in, and calls `onSeen` once at least half of it
 * has been on screen. Rendered as an empty hidden span so it can go inside any
 * card, server component or not, without changing its markup.
 */
function useSeen(active: boolean, onSeen: () => void, onClick?: () => void) {
  const ref = useRef<HTMLSpanElement>(null);
  const seenRef = useRef(onSeen);
  const clickRef = useRef(onClick);
  useEffect(() => {
    seenRef.current = onSeen;
    clickRef.current = onClick;
  });

  useEffect(() => {
    const target = ref.current?.parentElement;
    if (!active || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          seenRef.current();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(target);

    const click = () => clickRef.current?.();
    target.addEventListener("click", click);
    return () => {
      observer.disconnect();
      target.removeEventListener("click", click);
    };
  }, [active]);

  return ref;
}

/** Reports the gift or idea card it sits in when it is seen. */
export function ItemImpression({ itemId }: { itemId: string }) {
  const scope = useTrackingScope();
  const ref = useSeen(scope !== null, () => {
    if (scope) trackImpression(scope.listId, itemId);
  });
  return scope ? <span ref={ref} hidden /> : null;
}

/**
 * Reports a gift guide's tile on a browse page: when it is seen, and when it is
 * opened. Not inside a scope — a browse page is about many lists — so the tile
 * says itself whether to render this.
 */
export function SuggestionTracker({
  listId,
  surface,
}: {
  listId: string;
  surface: "home" | "gifts" | "category";
}) {
  const ref = useSeen(
    true,
    () => {
      if (firstInView(`tile:${listId}`)) {
        track("suggestion_impression", { listId, props: { surface } });
      }
    },
    () => {
      track("suggestion_click", { listId, props: { surface } });
      // The guide opens next. Sent now rather than trusting a timer to.
      flush();
    },
  );
  return <span ref={ref} hidden />;
}
