import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  lists,
  santaAssignments,
  santaExchanges,
  santaExclusions,
  santaParticipants,
  users,
  type SantaExchange,
  type SantaParticipant,
} from "@/db/schema";
import { uniqueShortCode } from "@/lib/handle";
import { DRAFT_SEGMENT, publicList } from "@/lib/routes";
import { drawNames, pairKey } from "@/lib/santa-draw";
import { parsePriceToCents } from "@/lib/scrape-parse";
import { getCurrentUser, readSantaToken, readSantaTokens } from "@/lib/session";

/**
 * Secret Santa, the part with the rules in it. Pages and actions ask here and
 * never query the santa_* tables themselves, so the one promise that matters —
 * nobody learns who drew whom except the person who drew — has one place to
 * be kept. Assignments are read in exactly one function, assignmentFor.
 */

/** Two people drawing each other is a swap, not a secret. */
export const MIN_PARTICIPANTS = 3;
/** Larger than any family or office party; past it, a mistake or a bot. */
export const MAX_PARTICIPANTS = 100;
export const MAX_PERSON_NAME = 60;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** A private link's secret and the hash that is all the database keeps of it. */
export function newPrivateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

export async function uniqueExchangeCode(): Promise<string> {
  return uniqueShortCode(async (candidate) => {
    const row = await db
      .select({ id: santaExchanges.id })
      .from(santaExchanges)
      .where(eq(santaExchanges.code, candidate))
      .get();
    return Boolean(row);
  });
}

/**
 * What every Secret Santa action answers with. `link` is a private link that
 * has just been made, handed back once to the organiser who made it so they
 * can pass it on; it is never stored and never shown again.
 */
export type SantaState = { ok?: boolean; error?: string; message?: string; link?: string };

/** The fields an organiser fills in, shared by creating and editing. */
export type ExchangeFields = {
  name: string;
  emoji: string;
  budgetCents: number | null;
  exchangeDate: Date | null;
  note: string | null;
};

/** A budget past this is a typo, or a family that doesn't need a website. */
const MAX_BUDGET_CENTS = 100_000_00;

export function parseExchangeFields(
  formData: FormData,
): { fields: ExchangeFields } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give it a name, like “Tucker family Christmas”." };
  if (name.length > 80) return { error: "That name is a little long." };

  // An emoji is a few code units at most; anything longer was pasted text.
  const emoji = String(formData.get("emoji") ?? "").trim().slice(0, 16) || "🎅";

  const rawBudget = String(formData.get("budget") ?? "").trim();
  let budgetCents: number | null = null;
  if (rawBudget) {
    budgetCents = parsePriceToCents(rawBudget);
    if (budgetCents === null || budgetCents <= 0) {
      return { error: "Type the budget as an amount, numbers only." };
    }
    if (budgetCents > MAX_BUDGET_CENTS) return { error: "That budget looks like a typo." };
  }

  const rawDate = String(formData.get("exchangeDate") ?? "").trim();
  const exchangeDate = rawDate ? new Date(`${rawDate}T00:00:00`) : null;
  if (exchangeDate && Number.isNaN(exchangeDate.getTime())) {
    return { error: "That date didn't look right." };
  }

  const note = String(formData.get("note") ?? "").trim() || null;
  if (note && note.length > 1000) return { error: "That note is a little long." };

  return { fields: { name, emoji, budgetCents, exchangeDate, note } };
}

/** A person's name as they typed it, or the sentence saying why it won't do. */
export function parsePersonName(formData: FormData): { name: string } | { error: string } {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Type your name so everyone knows who’s in." };
  if (name.length > MAX_PERSON_NAME) return { error: "That name is a little long." };
  return { name };
}

/* -------------------------------------------------------------------------- */
/* Finding an exchange, and who is looking at it                              */
/* -------------------------------------------------------------------------- */

export type ResolvedExchange = { exchange: SantaExchange; organizerName: string };

/**
 * The exchange behind a code, without any permission check. A banned
 * organiser's exchanges are gone, like their lists.
 */
export async function resolveExchange(code: string): Promise<ResolvedExchange | null> {
  const row = await db
    .select({ exchange: santaExchanges, organizerName: users.name })
    .from(santaExchanges)
    .innerJoin(users, eq(users.id, santaExchanges.organizerId))
    .where(and(eq(santaExchanges.code, code), isNull(users.bannedAt)))
    .get();
  return row ?? null;
}

/** The exchange, if the signed-in viewer organised it. Null answers rather than throws. */
export async function organizedExchangeOrNull(
  code: string,
): Promise<ResolvedExchange | null> {
  const [resolved, user] = await Promise.all([resolveExchange(code), getCurrentUser()]);
  if (!resolved || !user || resolved.exchange.organizerId !== user.id) return null;
  return resolved;
}

/**
 * Who this browser is in the exchange: the private link's cookie first, then
 * the signed-in account. The cookie wins because it is the more specific
 * claim — it was set by opening one person's link on purpose.
 */
export async function currentParticipant(
  exchange: SantaExchange,
): Promise<SantaParticipant | null> {
  const token = await readSantaToken(exchange.code);
  if (token) {
    const byToken = await db
      .select()
      .from(santaParticipants)
      .where(
        and(
          eq(santaParticipants.exchangeId, exchange.id),
          eq(santaParticipants.tokenHash, sha256(token)),
        ),
      )
      .get();
    if (byToken) return byToken;
  }

  const user = await getCurrentUser();
  if (!user) return null;
  return (
    (await db
      .select()
      .from(santaParticipants)
      .where(
        and(
          eq(santaParticipants.exchangeId, exchange.id),
          eq(santaParticipants.userId, user.id),
        ),
      )
      .get()) ?? null
  );
}

/** The participant a private link belongs to, and their exchange's code. */
export async function participantByToken(
  token: string,
): Promise<{ participant: SantaParticipant; code: string } | null> {
  const row = await db
    .select({ participant: santaParticipants, code: santaExchanges.code })
    .from(santaParticipants)
    .innerJoin(santaExchanges, eq(santaExchanges.id, santaParticipants.exchangeId))
    .where(eq(santaParticipants.tokenHash, sha256(token)))
    .get();
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/* What the dashboard and the participant pages may show                      */
/* -------------------------------------------------------------------------- */

/**
 * Everyone in an exchange, as anyone in it may see them. Deliberately
 * selected column by column: nothing here can be joined to an assignment.
 */
export async function exchangeParticipants(exchangeId: string) {
  return db
    .select({
      id: santaParticipants.id,
      name: santaParticipants.name,
      // SQLite answers 1 or 0; mapped so the type isn't lying.
      hasAccount: sql<boolean>`${santaParticipants.userId} is not null`.mapWith(Boolean),
      hasWishlist: sql<boolean>`${santaParticipants.wishlistId} is not null`.mapWith(Boolean),
      viewedAt: santaParticipants.viewedAt,
      linkResetAt: santaParticipants.linkResetAt,
      joinedAt: santaParticipants.joinedAt,
    })
    .from(santaParticipants)
    .where(eq(santaParticipants.exchangeId, exchangeId))
    .orderBy(asc(santaParticipants.joinedAt), asc(santaParticipants.name))
    .all();
}

export type PublicParticipant = Awaited<ReturnType<typeof exchangeParticipants>>[number];

export async function exchangeExclusions(exchangeId: string) {
  return db
    .select({
      id: santaExclusions.id,
      firstId: santaExclusions.firstId,
      secondId: santaExclusions.secondId,
    })
    .from(santaExclusions)
    .where(eq(santaExclusions.exchangeId, exchangeId))
    .all();
}

/** Whether someone has looked at the draw as it stands now, not an older one. */
export function hasSeenCurrentDraw(
  exchange: SantaExchange,
  viewedAt: Date | null,
): boolean {
  return (
    exchange.status === "drawn" &&
    exchange.drawnAt !== null &&
    viewedAt !== null &&
    viewedAt.getTime() >= exchange.drawnAt.getTime()
  );
}

export type Wishlist = { name: string; emoji: string; href: string };

/** A participant's linked list, if it is still there to be shown. */
export async function wishlistFor(wishlistId: string | null): Promise<Wishlist | null> {
  if (!wishlistId) return null;
  const row = await db
    .select({ list: lists, handle: users.handle, bannedAt: users.bannedAt })
    .from(lists)
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(eq(lists.id, wishlistId))
    .get();
  if (!row || row.bannedAt) return null;
  return {
    name: row.list.name,
    emoji: row.list.emoji,
    href: publicList(row.list, row.handle),
  };
}

/**
 * Who `giverId` is buying for. The only read of santa_assignments anywhere,
 * and only ever called with the viewer's own participant id.
 */
export async function assignmentFor(giverId: string) {
  const row = await db
    .select({ name: santaParticipants.name, wishlistId: santaParticipants.wishlistId })
    .from(santaAssignments)
    .innerJoin(santaParticipants, eq(santaParticipants.id, santaAssignments.receiverId))
    .where(eq(santaAssignments.giverId, giverId))
    .get();
  if (!row) return null;
  return { name: row.name, wishlist: await wishlistFor(row.wishlistId) };
}

/* -------------------------------------------------------------------------- */
/* Joining and drawing                                                        */
/* -------------------------------------------------------------------------- */

export type JoinOutcome =
  | { outcome: "joined"; token: string }
  | { outcome: "closed" | "full" | "name-taken" | "already-in" };

/**
 * Adds someone to an exchange. One transaction, so a join can't land after a
 * draw that started a moment earlier, and two people can't both be the 101st.
 */
export function addParticipant(
  exchangeId: string,
  name: string,
  userId: string | null,
): JoinOutcome {
  const { token, tokenHash } = newPrivateToken();

  return db.transaction((tx): JoinOutcome => {
    const exchange = tx
      .select({ status: santaExchanges.status })
      .from(santaExchanges)
      .where(eq(santaExchanges.id, exchangeId))
      .get();
    if (!exchange || exchange.status !== "open") return { outcome: "closed" };

    const people = tx
      .select({ name: santaParticipants.name, userId: santaParticipants.userId })
      .from(santaParticipants)
      .where(eq(santaParticipants.exchangeId, exchangeId))
      .all();

    if (userId && people.some((person) => person.userId === userId)) {
      return { outcome: "already-in" };
    }
    if (people.length >= MAX_PARTICIPANTS) return { outcome: "full" };
    // Two Sams can't be told apart in an exclusion or a "who's looked" list.
    const folded = name.toLocaleLowerCase();
    if (people.some((person) => person.name.toLocaleLowerCase() === folded)) {
      return { outcome: "name-taken" };
    }

    tx.insert(santaParticipants).values({ exchangeId, name, tokenHash, userId }).run();
    return { outcome: "joined", token };
  });
}

export type DrawOutcome = "drawn" | "not-open" | "too-few" | "impossible";

/**
 * Draws names for the whole exchange at once. The status check and the writes
 * share a transaction, so a double-click draws once and the second press is
 * told it already happened.
 */
export function runDraw(exchangeId: string): DrawOutcome {
  return db.transaction((tx): DrawOutcome => {
    const exchange = tx
      .select({ status: santaExchanges.status })
      .from(santaExchanges)
      .where(eq(santaExchanges.id, exchangeId))
      .get();
    if (!exchange || exchange.status !== "open") return "not-open";

    const ids = tx
      .select({ id: santaParticipants.id })
      .from(santaParticipants)
      .where(eq(santaParticipants.exchangeId, exchangeId))
      .all()
      .map((row) => row.id);
    if (ids.length < MIN_PARTICIPANTS) return "too-few";

    const exclusions = new Set(
      tx
        .select({ firstId: santaExclusions.firstId, secondId: santaExclusions.secondId })
        .from(santaExclusions)
        .where(eq(santaExclusions.exchangeId, exchangeId))
        .all()
        .map((row) => pairKey(row.firstId, row.secondId)),
    );

    const draw = drawNames(ids, exclusions, (max) => randomInt(max));
    if (!draw) return "impossible";

    tx.delete(santaAssignments).where(eq(santaAssignments.exchangeId, exchangeId)).run();
    tx.insert(santaAssignments)
      .values([...draw].map(([giverId, receiverId]) => ({ exchangeId, giverId, receiverId })))
      .run();
    tx.update(santaExchanges)
      .set({ status: "drawn", drawnAt: new Date() })
      .where(eq(santaExchanges.id, exchangeId))
      .run();
    return "drawn";
  });
}

/**
 * Throws the draw away and reopens the exchange. viewedAt is left as it was:
 * it is how a participant who already looked is told their name changed.
 */
export function resetDraw(exchangeId: string): void {
  db.transaction((tx) => {
    tx.delete(santaAssignments).where(eq(santaAssignments.exchangeId, exchangeId)).run();
    tx.update(santaExchanges)
      .set({ status: "open", drawnAt: null })
      .where(eq(santaExchanges.id, exchangeId))
      .run();
  });
}

/* -------------------------------------------------------------------------- */
/* The /secret-santa overview                                                 */
/* -------------------------------------------------------------------------- */

export type ExchangeSummary = {
  exchange: SantaExchange;
  organizing: boolean;
  participating: boolean;
  people: number;
};

/**
 * Every exchange this viewer organises or is in: through their account, or
 * through a private link this browser has opened.
 */
export async function myExchanges(): Promise<ExchangeSummary[]> {
  const [user, tokens] = await Promise.all([getCurrentUser(), readSantaTokens()]);

  const organized = user
    ? await db
        .select({ id: santaExchanges.id })
        .from(santaExchanges)
        .where(eq(santaExchanges.organizerId, user.id))
        .all()
    : [];

  const mine: SQL[] = [];
  if (user) mine.push(eq(santaParticipants.userId, user.id));
  if (tokens.length) {
    mine.push(inArray(santaParticipants.tokenHash, tokens.map(([, token]) => sha256(token))));
  }
  const joined = mine.length
    ? await db
        .select({ exchangeId: santaParticipants.exchangeId })
        .from(santaParticipants)
        .where(or(...mine))
        .all()
    : [];

  const organizedIds = new Set(organized.map((row) => row.id));
  const joinedIds = new Set(joined.map((row) => row.exchangeId));
  const ids = [...new Set([...organizedIds, ...joinedIds])];
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      exchange: santaExchanges,
      people: sql<number>`(select count(*) from ${santaParticipants} where ${santaParticipants.exchangeId} = "santa_exchanges"."id")`,
    })
    .from(santaExchanges)
    .innerJoin(users, eq(users.id, santaExchanges.organizerId))
    .where(and(inArray(santaExchanges.id, ids), isNull(users.bannedAt)))
    .orderBy(desc(santaExchanges.createdAt))
    .all();

  return rows.map(({ exchange, people }) => ({
    exchange,
    organizing: organizedIds.has(exchange.id),
    participating: joinedIds.has(exchange.id),
    people,
  }));
}

/* -------------------------------------------------------------------------- */
/* Linking a wishlist                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The list behind a link someone pasted: the canonical /lists/<handle>/<slug>,
 * a draft's /lists/drafts/<code>, or a short /<code>, with or without the
 * host. Only wishlists; a gift guide is for nobody in particular.
 */
export async function listFromLink(input: string): Promise<string | null> {
  let path: string;
  try {
    path = new URL(input.trim(), "https://placeholder.invalid").pathname;
  } catch {
    return null;
  }

  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);

  if (parts.length === 1) {
    const row = await db
      .select({ id: lists.id, kind: lists.kind })
      .from(lists)
      .where(eq(lists.shortCode, parts[0]))
      .get();
    return row?.kind === "personal" ? row.id : null;
  }

  if (parts.length >= 3 && parts[0] === "lists") {
    const [, handle, key] = parts;
    const row =
      handle === DRAFT_SEGMENT
        ? await db
            .select({ id: lists.id, kind: lists.kind })
            .from(lists)
            .where(and(eq(lists.shortCode, key), isNull(lists.ownerId)))
            .get()
        : await db
            .select({ id: lists.id, kind: lists.kind })
            .from(lists)
            .innerJoin(users, eq(users.id, lists.ownerId))
            .where(and(eq(users.handle, handle), eq(lists.slug, key)))
            .get();
    return row?.kind === "personal" ? row.id : null;
  }

  return null;
}

/** The signed-in viewer's own wishlists, for the picker on their page. */
export async function ownWishlists(userId: string) {
  return db
    .select({ id: lists.id, name: lists.name, emoji: lists.emoji })
    .from(lists)
    .where(and(eq(lists.ownerId, userId), eq(lists.kind, "personal")))
    .orderBy(desc(lists.createdAt))
    .all();
}
