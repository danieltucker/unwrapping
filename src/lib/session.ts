import "server-only";

import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { secureCookies } from "@/lib/origin";

const SESSION_COOKIE = "unwrap_session";
const GUEST_COOKIE = "unwrap_guest";
const DRAFT_COOKIE = "unwrap_draft";
const SESSION_DAYS = 30;
const GUEST_DAYS = 400; // Chrome's cap; the guest's reservations should outlive the party.

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set; see .env.local");
  }
  return value;
}

const cookieOptions = {
  httpOnly: true,
  // Follows the origin rather than NODE_ENV: an instance served over plain http
  // on someone's own network would otherwise set a Secure cookie the browser
  // throws away, which reads as a sign-in button that does nothing.
  secure: secureCookies,
  sameSite: "lax" as const,
  path: "/",
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/* -------------------------------------------------------------------------- */
/* Owner sessions                                                             */
/* -------------------------------------------------------------------------- */

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  // Only the hash is stored, so a leaked database can't be used to sign in.
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt });

  (await cookies()).set(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
}

/**
 * The signed-in owner, or null. Memoized per render pass so a page can call it
 * from several components without repeating the query.
 */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    // Banning deletes their sessions too; this is for the one that was being
    // used at that very moment, and anything else that slips past.
    .where(and(eq(sessions.tokenHash, sha256(token)), isNull(users.bannedAt)))
    .get();

  if (!row || row.expiresAt.getTime() < Date.now()) return null;

  // The handle appears in every list URL, so callers routinely need it, and
  // the avatar is drawn in the header of every page there is.
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    isAdmin: row.isAdmin,
  };
});

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }

  store.delete(SESSION_COOKIE);
}

/* -------------------------------------------------------------------------- */
/* Guest identity: no account, just a signed cookie                           */
/* -------------------------------------------------------------------------- */

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function verify(signed: string): string | null {
  const separator = signed.lastIndexOf(".");
  if (separator === -1) return null;

  const value = signed.slice(0, separator);
  const signature = Buffer.from(signed.slice(separator + 1));
  const expected = Buffer.from(sign(value));

  if (signature.length !== expected.length) return null;
  return timingSafeEqual(signature, expected) ? value : null;
}

/**
 * Identifies the creator of an anonymous list before they have an account,
 * so the draft can be claimed at sign-up. Server Actions only; it sets a cookie.
 */
export async function ensureDraftToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DRAFT_COOKIE)?.value;
  const verified = existing ? verify(existing) : null;
  if (verified) return verified;

  const token = randomBytes(24).toString("base64url");
  store.set(DRAFT_COOKIE, `${token}.${sign(token)}`, {
    ...cookieOptions,
    expires: new Date(Date.now() + GUEST_DAYS * 86_400_000),
  });

  return token;
}

/** The draft token if this browser holds one. Safe to call while rendering. */
export const readDraftToken = cache(async (): Promise<string | null> => {
  const signed = (await cookies()).get(DRAFT_COOKIE)?.value;
  return signed ? verify(signed) : null;
});

/** The guest token if this browser already has one, without issuing a new one. */
export const readGuestToken = cache(async (): Promise<string | null> => {
  const signed = (await cookies()).get(GUEST_COOKIE)?.value;
  return signed ? verify(signed) : null;
});

/* -------------------------------------------------------------------------- */
/* Secret Santa: one cookie per exchange, holding that person's private link   */
/* -------------------------------------------------------------------------- */

const SANTA_COOKIE_PREFIX = "unwrap_santa_";

/**
 * The raw token from this exchange's private link, if this browser has opened
 * it. Not signed: the token is already a random secret, and only its hash is
 * stored, so there is nothing a signature would add.
 *
 * A cookie per exchange rather than the guest cookie, because the private link
 * is a bearer secret that has to be able to *replace* who this browser is in
 * one exchange without disturbing its reservations anywhere else.
 */
export const readSantaToken = cache(async (code: string): Promise<string | null> => {
  return (await cookies()).get(`${SANTA_COOKIE_PREFIX}${code}`)?.value ?? null;
});

/** Every exchange this browser holds a private link for, as [code, token]. */
export const readSantaTokens = cache(async (): Promise<[string, string][]> => {
  return (await cookies())
    .getAll()
    .filter((cookie) => cookie.name.startsWith(SANTA_COOKIE_PREFIX))
    .map((cookie) => [cookie.name.slice(SANTA_COOKIE_PREFIX.length), cookie.value]);
});

/** Server Actions and Route Handlers only. */
export async function setSantaToken(code: string, token: string): Promise<void> {
  (await cookies()).set(`${SANTA_COOKIE_PREFIX}${code}`, token, {
    ...cookieOptions,
    expires: new Date(Date.now() + GUEST_DAYS * 86_400_000),
  });
}

/** Server Actions and Route Handlers only. */
export async function clearSantaToken(code: string): Promise<void> {
  (await cookies()).delete(`${SANTA_COOKIE_PREFIX}${code}`);
}

/**
 * Issues a guest token if there isn't one. Only call this from a Server Action
 * or Route Handler; cookies cannot be set while rendering a page.
 */
export async function ensureGuestToken(): Promise<string> {
  const existing = await readGuestToken();
  if (existing) return existing;

  const token = randomBytes(24).toString("base64url");
  (await cookies()).set(GUEST_COOKIE, `${token}.${sign(token)}`, {
    ...cookieOptions,
    expires: new Date(Date.now() + GUEST_DAYS * 86_400_000),
  });

  return token;
}
