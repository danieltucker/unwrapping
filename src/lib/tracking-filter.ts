import { ITEM_EVENT_TYPES, type ItemEventType } from "@/db/schema";

/**
 * What the Analytics tab is looking at, read from and written back to its URL
 * so a filtered view can be reloaded, bookmarked or pasted to another admin.
 *
 * "A single user" here is a visitor: the random id in the `unwrap_vid` cookie.
 * Events are never tied to an account (see docs/event-tracking.md), so this is
 * the closest thing there is, and it is deliberately not linked to one.
 *
 * Pure, with no server imports: the page, the live feed's route handler and
 * the client feed all build the same query string from it.
 */

export const WINDOWS = [1, 7, 30, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];

/** Flagged by user agent or webdriver; see src/lib/bot.ts. */
export const BOT_MODES = ["all", "hide", "only"] as const;
export type BotMode = (typeof BOT_MODES)[number];

export type TrackingFilter = {
  days: WindowDays;
  bots: BotMode;
  /** Empty means every type. */
  types: ItemEventType[];
  /** One visitor's events only. */
  visitor: string | null;
  /** One session's events only. */
  session: string | null;
  /** One list's events only. */
  list: string | null;
  /** Visitors left out: the bot the user-agent check missed, or your own phone. */
  hide: string[];
};

export const DEFAULT_FILTER: TrackingFilter = {
  days: 30,
  bots: "all",
  types: [],
  visitor: null,
  session: null,
  list: null,
  hide: [],
};

/** Visitor and session ids are 22 base64url characters; list ids are UUIDs. */
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_HIDDEN = 20;

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function all(params: Params, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key);
  const value = params[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

const first = (params: Params, key: string) => all(params, key)[0] ?? null;
const id = (value: string | null) => (value && ID.test(value) ? value : null);

/** Anything malformed is ignored rather than refused: it is an admin's own URL bar. */
export function parseTrackingFilter(params: Params): TrackingFilter {
  const days = Number(first(params, "days"));
  const bots = first(params, "bots");
  const types = new Set(all(params, "type"));
  const hide = [...new Set(all(params, "hide").flatMap((value) => value.split(",")))]
    .filter((value) => ID.test(value))
    .slice(0, MAX_HIDDEN);

  return {
    days: (WINDOWS as readonly number[]).includes(days) ? (days as WindowDays) : DEFAULT_FILTER.days,
    bots: (BOT_MODES as readonly string[]).includes(bots ?? "") ? (bots as BotMode) : "all",
    types: ITEM_EVENT_TYPES.filter((type) => types.has(type)),
    visitor: id(first(params, "visitor")),
    session: id(first(params, "session")),
    list: id(first(params, "list")),
    hide,
  };
}

/** The query string for a filter, defaults left out so a plain view has a plain URL. */
export function filterQuery(filter: TrackingFilter): string {
  const query = new URLSearchParams();
  if (filter.days !== DEFAULT_FILTER.days) query.set("days", String(filter.days));
  if (filter.bots !== "all") query.set("bots", filter.bots);
  for (const type of filter.types) query.append("type", type);
  if (filter.visitor) query.set("visitor", filter.visitor);
  if (filter.session) query.set("session", filter.session);
  if (filter.list) query.set("list", filter.list);
  for (const visitor of filter.hide) query.append("hide", visitor);
  return query.toString();
}

/** `path` with this filter, after applying `change` to it. */
export function filterHref(
  path: string,
  filter: TrackingFilter,
  change: Partial<TrackingFilter> = {},
): string {
  const query = filterQuery({ ...filter, ...change });
  return query ? `${path}?${query}` : path;
}

/** The same filter with one more visitor hidden, and no longer focused on them. */
export function hidingVisitor(filter: TrackingFilter, visitor: string): Partial<TrackingFilter> {
  return {
    hide: filter.hide.includes(visitor) ? filter.hide : [...filter.hide, visitor].slice(0, MAX_HIDDEN),
    visitor: filter.visitor === visitor ? null : filter.visitor,
  };
}

/** Narrowed to one visitor or session: the feed becomes their timeline. */
export function isFocused(filter: TrackingFilter): boolean {
  return filter.visitor !== null || filter.session !== null;
}
