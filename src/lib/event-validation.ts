/**
 * What a browser is allowed to send to /api/events, checked before anything
 * touches the database.
 *
 * An allowlist all the way down: a known event type, the ids that type needs
 * and no others, and for each type the property keys it may carry with the
 * values each may take. Anything else is refused and counted rather than
 * stored, so a malformed or hostile request can't put arbitrary text in a row.
 *
 * outbound_click and item_claim are not on the list. The server records those
 * itself, from /go/<itemId> and the reserve action, and a browser claiming to
 * have clicked something it didn't would only make the numbers lie.
 *
 * Pure: whether the ids exist, and whose list they belong to, is the route's
 * business (src/app/api/events/route.ts).
 */
import type { ItemEventType } from "@/db/schema";

export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_EVENTS_PER_BATCH = 50;

/** Why something sent was not stored. Every one is a counter on /admin. */
export const REJECT_REASONS = [
  "bad_json",
  "too_large",
  "too_many",
  "unknown_type",
  "bad_ids",
  "bad_props",
  "unknown_ids",
  "rate_limited",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Sent, well formed, and deliberately not recorded. Also counters on /admin. */
export const SKIP_REASONS = ["dnt", "owner", "paused"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export type DropReason = RejectReason | SkipReason;

export type ClientEventType = Exclude<ItemEventType, "outbound_click" | "item_claim">;

type PropRule = { kind: "enum"; values: readonly string[] } | { kind: "fraction" };

type EventRule = {
  /** Which ids the event must carry; any other id it carries is refused. */
  needs: { list: true; item?: true; idea?: true };
  props: Record<string, PropRule>;
};

const SURFACES = ["home", "gifts", "category"] as const;

const RULES: Record<ClientEventType, EventRule> = {
  list_view: { needs: { list: true }, props: {} },
  idea_expand: { needs: { list: true, idea: true }, props: {} },
  item_impression: {
    needs: { list: true, item: true },
    // Present only when impressions are sampled, so totals can be scaled.
    props: { sample: { kind: "fraction" } },
  },
  filter_used: {
    needs: { list: true },
    props: { filter: { kind: "enum", values: ["all", "free", "affordable", "wanted"] } },
  },
  sort_used: {
    needs: { list: true },
    props: { sort: { kind: "enum", values: ["owner", "low", "high"] } },
  },
  suggestion_impression: {
    needs: { list: true },
    props: { surface: { kind: "enum", values: SURFACES } },
  },
  suggestion_click: {
    needs: { list: true },
    props: { surface: { kind: "enum", values: SURFACES } },
  },
};

/** Which properties must be present, not just allowed. */
const REQUIRED_PROPS: Partial<Record<ClientEventType, string[]>> = {
  filter_used: ["filter"],
  sort_used: ["sort"],
  suggestion_impression: ["surface"],
  suggestion_click: ["surface"],
};

export const CLIENT_EVENT_TYPES = Object.keys(RULES) as ClientEventType[];

/** The shape the browser sends; see src/lib/track.ts. */
export type ClientEvent = {
  type: ClientEventType;
  listId: string;
  itemId?: string;
  ideaId?: string;
  props?: Record<string, string | number>;
};

export type ParsedBatch =
  | { ok: false; reason: RejectReason; count: number }
  | {
      ok: true;
      events: ClientEvent[];
      /** navigator.webdriver, which a headless browser can't help but report. */
      webdriver: boolean;
      rejected: Partial<Record<RejectReason, number>>;
    };

// crypto.randomUUID's format, which every list and item id is in.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks one event against its type's rule. Returns the event in the exact
 * shape that will be stored, or why it was refused.
 */
export function validateEvent(raw: unknown): ClientEvent | RejectReason {
  if (!isObject(raw)) return "bad_props";

  const type = raw.type;
  if (typeof type !== "string" || !Object.hasOwn(RULES, type)) return "unknown_type";
  const rule = RULES[type as ClientEventType];

  for (const key of Object.keys(raw)) {
    if (!["type", "listId", "itemId", "ideaId", "props"].includes(key)) return "bad_props";
  }

  const ids = { list: raw.listId, item: raw.itemId, idea: raw.ideaId };
  for (const [name, value] of Object.entries(ids) as [keyof typeof ids, unknown][]) {
    const needed = rule.needs[name] === true;
    if (value === undefined) {
      if (needed) return "bad_ids";
      continue;
    }
    if (!needed || typeof value !== "string" || !UUID.test(value)) return "bad_ids";
  }

  const props: Record<string, string | number> = {};
  if (raw.props !== undefined) {
    if (!isObject(raw.props)) return "bad_props";
    for (const [key, value] of Object.entries(raw.props)) {
      const propRule = Object.hasOwn(rule.props, key) ? rule.props[key] : undefined;
      if (!propRule) return "bad_props";
      if (propRule.kind === "enum") {
        if (typeof value !== "string" || !propRule.values.includes(value)) return "bad_props";
      } else if (typeof value !== "number" || !(value > 0 && value <= 1)) {
        return "bad_props";
      }
      props[key] = value;
    }
  }
  for (const key of REQUIRED_PROPS[type as ClientEventType] ?? []) {
    if (!(key in props)) return "bad_props";
  }

  return {
    type: type as ClientEventType,
    listId: raw.listId as string,
    ...(raw.itemId === undefined ? {} : { itemId: raw.itemId as string }),
    ...(raw.ideaId === undefined ? {} : { ideaId: raw.ideaId as string }),
    ...(Object.keys(props).length ? { props } : {}),
  };
}

/**
 * Parses a whole request body. Malformed JSON, an oversized body or too many
 * events refuse the lot; a bad event among good ones refuses only itself.
 */
export function parseBatch(body: string): ParsedBatch {
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return { ok: false, reason: "too_large", count: 1 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, reason: "bad_json", count: 1 };
  }
  if (!isObject(parsed) || !Array.isArray(parsed.events)) {
    return { ok: false, reason: "bad_json", count: 1 };
  }
  if (parsed.events.length > MAX_EVENTS_PER_BATCH) {
    return { ok: false, reason: "too_many", count: parsed.events.length };
  }

  const events: ClientEvent[] = [];
  const rejected: Partial<Record<RejectReason, number>> = {};
  for (const raw of parsed.events) {
    const result = validateEvent(raw);
    if (typeof result === "string") rejected[result] = (rejected[result] ?? 0) + 1;
    else events.push(result);
  }

  return { ok: true, events, webdriver: parsed.webdriver === true, rejected };
}

/** Do Not Track, or its successor Global Privacy Control. */
export function asksNotToBeTracked(headers: Headers): boolean {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}
