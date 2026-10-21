import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import {
  lists,
  santaAssignments,
  santaExchanges,
  santaExclusions,
  santaMessages,
  santaParticipants,
  santaReports,
  users,
  type SantaExchange,
  type SantaParticipant,
} from "@/db/schema";
import { uniqueShortCode } from "@/lib/handle";
import { DRAFT_SEGMENT, listSegments, manageList, publicList } from "@/lib/routes";
import { drawNames, forcedGivers, pairKey } from "@/lib/santa-draw";
import { parsePriceToCents } from "@/lib/scrape-parse";
import { getCurrentUser, readSantaToken, readSantaTokens } from "@/lib/session";

/**
 * Secret Santa, the part with the rules in it. Pages and actions ask here and
 * never query the santa_* tables themselves, so the one promise that matters —
 * nobody learns who drew whom except the person who drew — has one place to
 * be kept. santa_assignments is read only in this file, and every read is
 * for the viewer's own pair, answers yes/no, or is the operator's report
 * queue on /admin.
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

/** New exchanges per organiser per day: work, family and friends twice over, not a script. */
export const NEW_EXCHANGES_PER_DAY = 10;

export async function startedTooManyToday(organizerId: string): Promise<boolean> {
  const row = await db
    .select({ n: count() })
    .from(santaExchanges)
    .where(
      and(
        eq(santaExchanges.organizerId, organizerId),
        gte(santaExchanges.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    )
    .get();
  return (row?.n ?? 0) >= NEW_EXCHANGES_PER_DAY;
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

/**
 * Characters nobody types on purpose and that change how text reads without
 * showing: zero-width spaces that make "Sam" and "Sam" two different people,
 * and direction overrides that make a name read backwards. The zero-width
 * joiner stays, because emoji are built with it.
 */
const INVISIBLE = "\\u200B\\u200C\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF";
/** For a single line — a name — where a line break is as unwanted as the rest. */
const NOT_IN_A_LINE = new RegExp(`[\\p{Cc}${INVISIBLE}]`, "gu");
/** For a note or a message, which may keep its line breaks and tabs. */
const NOT_IN_TEXT = new RegExp(`[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F${INVISIBLE}]`, "gu");

/** One line of text as it should be stored: whitespace runs as one space. */
export function cleanLine(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").replace(NOT_IN_A_LINE, "").trim();
}

/** Free text — a note, a message — with the invisible characters taken out. */
export function cleanText(value: string): string {
  return value.normalize("NFC").replace(NOT_IN_TEXT, "").trim();
}

/**
 * The form of a name two people can't both have. Compatibility-folded, so a
 * full-width "Ｓａｍ" is Sam, and without any format character at all,
 * joiner included.
 */
export function nameKey(name: string): string {
  return name.normalize("NFKC").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function parseExchangeFields(
  formData: FormData,
): { fields: ExchangeFields } | { error: string } {
  const name = cleanLine(String(formData.get("name") ?? ""));
  if (!name) return { error: "Give it a name, like “Tucker family Christmas”." };
  if (name.length > 80) return { error: "That name is a little long." };

  // An emoji is a few code units at most; anything longer was pasted text.
  const emoji = cleanLine(String(formData.get("emoji") ?? "")).slice(0, 16) || "🎅";

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

  const note = cleanText(String(formData.get("note") ?? "")) || null;
  if (note && note.length > 1000) return { error: "That note is a little long." };

  return { fields: { name, emoji, budgetCents, exchangeDate, note } };
}

/** A person's name as they typed it, or the sentence saying why it won't do. */
export function parsePersonName(formData: FormData): { name: string } | { error: string } {
  const name = cleanLine(String(formData.get("name") ?? ""));
  if (!nameKey(name)) return { error: "Type your name so everyone knows who’s in." };
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
      seenDraw: santaParticipants.seenDraw,
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
export function hasSeenCurrentDraw(exchange: SantaExchange, seenDraw: number | null): boolean {
  return exchange.status === "drawn" && seenDraw === exchange.drawCount;
}

export type Wishlist = {
  name: string;
  emoji: string;
  href: string;
  /** Its editor, which only its owner can open. */
  manageHref: string;
  /** The two segments of /lists/<handle>/<key>, for loading it in place. */
  handle: string;
  listKey: string;
  /** Off means its owner can see what's been reserved; see setWishlist. */
  surpriseMode: boolean;
};

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
  const [handle, listKey] = listSegments(row.list, row.handle);
  return {
    name: row.list.name,
    emoji: row.list.emoji,
    href: publicList(row.list, row.handle),
    manageHref: manageList(row.list, row.handle),
    handle,
    listKey,
    surpriseMode: row.list.surpriseMode,
  };
}

/**
 * Who `giverId` is buying for, and the id of the pair. Only ever called with
 * the viewer's own participant id, and only once they have asked to see it.
 */
async function assignmentFor(giverId: string) {
  const row = await db
    .select({
      assignmentId: santaAssignments.id,
      name: santaParticipants.name,
      wishlistId: santaParticipants.wishlistId,
    })
    .from(santaAssignments)
    .innerJoin(santaParticipants, eq(santaParticipants.id, santaAssignments.receiverId))
    .where(eq(santaAssignments.giverId, giverId))
    .get();
  return row ?? null;
}

/**
 * The pair in which `receiverId` is the one being bought for. The id of the
 * pair and nothing else: not the giver's id, not their name. Anything that
 * reads this to show the receiver their thread must keep it that way.
 */
async function pairOfReceiver(receiverId: string): Promise<string | null> {
  const row = await db
    .select({ assignmentId: santaAssignments.id })
    .from(santaAssignments)
    .where(eq(santaAssignments.receiverId, receiverId))
    .get();
  return row?.assignmentId ?? null;
}

/* -------------------------------------------------------------------------- */
/* The anonymous thread                                                       */
/* -------------------------------------------------------------------------- */

export const MAX_MESSAGE = 1000;
/** A burst: enough for a quick back-and-forth, not enough to flood. */
const MESSAGES_PER_10_MIN = 10;
const MESSAGES_PER_DAY = 60;
const REPORTS_PER_DAY = 20;

/**
 * One message as either side may see it. Deliberately no sender: "mine" is all
 * a reader is told, and the other side is named by the page — the receiver's
 * name for a Santa, "Your Santa" for the person they drew.
 */
export type ThreadMessage = {
  id: string;
  body: string | null;
  mine: boolean;
  at: Date;
  reportedByMe: boolean;
};

async function threadMessages(
  assignmentId: string,
  viewerIsGiver: boolean,
  viewerId: string,
): Promise<ThreadMessage[]> {
  const rows = await db
    .select({
      id: santaMessages.id,
      body: santaMessages.body,
      fromGiver: santaMessages.fromGiver,
      removedAt: santaMessages.removedAt,
      createdAt: santaMessages.createdAt,
      // The outer id is written out in full: in a single-table select Drizzle
      // leaves `${santaMessages.id}` as a bare "id", which inside the subquery
      // would mean the report's id. See the note in src/app/lists/page.tsx.
      reportedByMe: sql<boolean>`exists (select 1 from ${santaReports} where ${santaReports.messageId} = "santa_messages"."id" and ${santaReports.reporterId} = ${viewerId})`.mapWith(Boolean),
    })
    .from(santaMessages)
    .where(eq(santaMessages.assignmentId, assignmentId))
    .orderBy(asc(santaMessages.createdAt), asc(santaMessages.id))
    .all();

  return rows.map((row) => ({
    id: row.id,
    body: row.removedAt ? null : row.body,
    mine: row.fromGiver === viewerIsGiver,
    at: row.createdAt,
    reportedByMe: row.reportedByMe,
  }));
}

export type PostOutcome =
  | "sent"
  | "not-drawn"
  | "not-revealed"
  | "empty"
  | "too-long"
  | "too-fast"
  | "too-many";

/**
 * Sends a message from a participant, either to the person they drew
 * ("receiver") or to whoever drew them ("santa").
 */
export async function postMessage(
  participant: SantaParticipant,
  exchange: SantaExchange,
  to: "receiver" | "santa",
  rawBody: string,
): Promise<PostOutcome> {
  if (exchange.status !== "drawn") return "not-drawn";
  // A Santa writes to someone by name, so they have to have seen it first.
  if (to === "receiver" && !hasSeenCurrentDraw(exchange, participant.seenDraw)) {
    return "not-revealed";
  }

  const body = cleanText(rawBody);
  if (!body) return "empty";
  if (body.length > MAX_MESSAGE) return "too-long";

  const sentSince = async (ms: number) =>
    (
      await db
        .select({ n: count() })
        .from(santaMessages)
        .where(
          and(
            eq(santaMessages.senderId, participant.id),
            gte(santaMessages.createdAt, new Date(Date.now() - ms)),
          ),
        )
        .get()
    )?.n ?? 0;
  if ((await sentSince(10 * 60_000)) >= MESSAGES_PER_10_MIN) return "too-fast";
  if ((await sentSince(86_400_000)) >= MESSAGES_PER_DAY) return "too-many";

  const assignmentId =
    to === "receiver"
      ? (await assignmentFor(participant.id))?.assignmentId
      : await pairOfReceiver(participant.id);
  if (!assignmentId) return "not-drawn";

  await db.insert(santaMessages).values({
    assignmentId,
    senderId: participant.id,
    fromGiver: to === "receiver",
    body,
  });
  return "sent";
}

export type ReportOutcome = "reported" | "missing" | "own" | "too-many";

/**
 * Flags a message for the operator. Only a message in one of the reporter's
 * own threads, and never their own.
 */
export async function reportMessage(
  participant: SantaParticipant,
  messageId: string,
): Promise<ReportOutcome> {
  const message = await db
    .select({
      senderId: santaMessages.senderId,
      giverId: santaAssignments.giverId,
      receiverId: santaAssignments.receiverId,
    })
    .from(santaMessages)
    .innerJoin(santaAssignments, eq(santaAssignments.id, santaMessages.assignmentId))
    .where(eq(santaMessages.id, messageId))
    .get();

  const inThread =
    message && (message.giverId === participant.id || message.receiverId === participant.id);
  if (!message || !inThread) return "missing";
  if (message.senderId === participant.id) return "own";

  const today =
    (
      await db
        .select({ n: count() })
        .from(santaReports)
        .where(
          and(
            eq(santaReports.reporterId, participant.id),
            gte(santaReports.createdAt, new Date(Date.now() - 86_400_000)),
          ),
        )
        .get()
    )?.n ?? 0;
  if (today >= REPORTS_PER_DAY) return "too-many";

  await db
    .insert(santaReports)
    .values({ messageId, reporterId: participant.id })
    .onConflictDoNothing();
  return "reported";
}

/* -------------------------------------------------------------------------- */
/* Everything one member's page may show                                      */
/* -------------------------------------------------------------------------- */

/**
 * The whole of what a participant's page is allowed to know, in one value.
 *
 * Written so it can be checked rather than trusted: there are no participant
 * ids anywhere in it, nothing about who drew anyone, and their match only once
 * they've asked to see it. scripts/test-santa-privacy.mts builds this for every
 * member of a drawn exchange and checks exactly that. The page renders from
 * this and from the lists themselves, which have their own rules.
 */
export async function memberView(
  { exchange, organizerName }: ResolvedExchange,
  participant: SantaParticipant,
) {
  const [people, myWishlist] = await Promise.all([
    exchangeParticipants(exchange.id),
    wishlistFor(participant.wishlistId),
  ]);

  const drawn = exchange.status === "drawn";
  const seen = hasSeenCurrentDraw(exchange, participant.seenDraw);
  const pair = seen ? await assignmentFor(participant.id) : null;
  const santaPair = drawn ? await pairOfReceiver(participant.id) : null;

  return {
    exchange: {
      code: exchange.code,
      name: exchange.name,
      emoji: exchange.emoji,
      note: exchange.note,
      budgetCents: exchange.budgetCents,
      exchangeDate: exchange.exchangeDate,
      drawnAt: exchange.drawnAt,
      open: exchange.status === "open",
    },
    organizerName,
    me: {
      name: participant.name,
      linkResetAt: participant.linkResetAt,
      // Looked at an earlier draw, which has since been thrown away.
      lookedBeforeRedraw: drawn && !seen && participant.seenDraw !== null,
    },
    roster: people.map((person) => ({ name: person.name, linkResetAt: person.linkResetAt })),
    drawn,
    seen,
    match: pair
      ? { name: pair.name, wishlist: await wishlistFor(pair.wishlistId) }
      : null,
    myWishlist,
    threads: {
      withReceiver: pair ? await threadMessages(pair.assignmentId, true, participant.id) : null,
      withSanta: santaPair ? await threadMessages(santaPair, false, participant.id) : null,
    },
  };
}

export type MemberView = Awaited<ReturnType<typeof memberView>>;

/**
 * "Show me who I've got". Records the draw they saw as it stands at this
 * moment, read in the same statement, so a redraw a moment earlier can't be
 * marked as seen by a page loaded before it.
 */
export async function revealMatch(participant: SantaParticipant): Promise<void> {
  await db
    .update(santaParticipants)
    .set({
      viewedAt: new Date(),
      seenDraw: sql`(select ${santaExchanges.drawCount} from ${santaExchanges} where ${santaExchanges.id} = ${participant.exchangeId})`,
    })
    .where(eq(santaParticipants.id, participant.id));
}

/* -------------------------------------------------------------------------- */
/* Reserving as a Santa                                                       */
/* -------------------------------------------------------------------------- */

/** This browser's participant rows across every exchange: by private link or account. */
async function viewerParticipantScope(): Promise<SQL | null> {
  const [user, tokens] = await Promise.all([getCurrentUser(), readSantaTokens()]);
  const mine: SQL[] = [];
  if (user) mine.push(eq(santaParticipants.userId, user.id));
  if (tokens.length) {
    mine.push(inArray(santaParticipants.tokenHash, tokens.map(([, token]) => sha256(token))));
  }
  return mine.length ? or(...mine)! : null;
}

/**
 * Whether the viewer is a Santa who has seen that they drew this list's owner.
 *
 * Their reservation on it is then always anonymous, whatever the list asks
 * for: a first name on a gift would tell anyone else in the family who visits
 * the list exactly who drew whom. See reserveGift.
 */
export async function isSantaFor(listId: string): Promise<boolean> {
  const scope = await viewerParticipantScope();
  if (!scope) return false;

  const receiver = alias(santaParticipants, "receiver");
  const row = await db
    .select({ id: santaAssignments.id })
    .from(santaAssignments)
    .innerJoin(santaParticipants, eq(santaParticipants.id, santaAssignments.giverId))
    .innerJoin(receiver, eq(receiver.id, santaAssignments.receiverId))
    .innerJoin(santaExchanges, eq(santaExchanges.id, santaAssignments.exchangeId))
    .where(
      and(
        scope,
        eq(receiver.wishlistId, listId),
        eq(santaExchanges.status, "drawn"),
        sql`${santaParticipants.seenDraw} = ${santaExchanges.drawCount}`,
      ),
    )
    .get();
  return Boolean(row);
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
    // Two Sams can't be told apart in an exclusion or a "who's looked" list,
    // and neither can two that only differ by a character nobody can see.
    const folded = nameKey(name);
    if (people.some((person) => nameKey(person.name) === folded)) {
      return { outcome: "name-taken" };
    }

    tx.insert(santaParticipants).values({ exchangeId, name, tokenHash, userId }).run();
    return { outcome: "joined", token };
  });
}

export type DrawOutcome = "drawn" | "not-open" | "too-few" | "impossible" | "predictable";

/**
 * Draws names for the whole exchange at once. The status check and the writes
 * share a transaction, so a double-click draws once and the second press is
 * told it already happened.
 *
 * Refused as "predictable" when the exclusions leave anyone exactly one person
 * they could draw: the organiser chose those exclusions, so they would know
 * that match without opening anything. See forcedGivers.
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
    if (forcedGivers(ids, exclusions, draw).length > 0) return "predictable";

    tx.delete(santaAssignments).where(eq(santaAssignments.exchangeId, exchangeId)).run();
    tx.insert(santaAssignments)
      .values([...draw].map(([giverId, receiverId]) => ({ exchangeId, giverId, receiverId })))
      .run();
    tx.update(santaExchanges)
      .set({ status: "drawn", drawnAt: new Date(), drawCount: sql`${santaExchanges.drawCount} + 1` })
      .where(eq(santaExchanges.id, exchangeId))
      .run();
    return "drawn";
  });
}

/**
 * Throws the draw away and reopens the exchange. seenDraw is left as it was:
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
  const [user, scope] = await Promise.all([getCurrentUser(), viewerParticipantScope()]);

  const organized = user
    ? await db
        .select({ id: santaExchanges.id })
        .from(santaExchanges)
        .where(eq(santaExchanges.organizerId, user.id))
        .all()
    : [];

  const joined = scope
    ? await db
        .select({ exchangeId: santaParticipants.exchangeId })
        .from(santaParticipants)
        .where(scope)
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

/* -------------------------------------------------------------------------- */
/* The operator's report queue                                                */
/* -------------------------------------------------------------------------- */

/**
 * Reported messages not yet dealt with, for /admin. The operator sees what was
 * written, in which exchange, and who wrote it — enough to act on abuse — but
 * not who reported it, which would hand them the pairing for no reason.
 */
export async function openReports() {
  return db
    .select({
      reportId: santaReports.id,
      reportedAt: santaReports.createdAt,
      messageId: santaMessages.id,
      body: santaMessages.body,
      removedAt: santaMessages.removedAt,
      senderName: santaParticipants.name,
      exchangeName: santaExchanges.name,
    })
    .from(santaReports)
    .innerJoin(santaMessages, eq(santaMessages.id, santaReports.messageId))
    .innerJoin(santaParticipants, eq(santaParticipants.id, santaMessages.senderId))
    .innerJoin(santaAssignments, eq(santaAssignments.id, santaMessages.assignmentId))
    .innerJoin(santaExchanges, eq(santaExchanges.id, santaAssignments.exchangeId))
    .where(isNull(santaReports.resolvedAt))
    .orderBy(desc(santaReports.createdAt))
    .all();
}
