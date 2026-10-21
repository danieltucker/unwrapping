import "server-only";

import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

/**
 * Who is allowed into /admin.
 *
 * Two ways in. The people named in the ADMIN_EMAILS environment variable are
 * the root of it: whoever can set that runs the instance, and nothing on the
 * screen can take it away from them, so an administrator can never lock the
 * operator out. Anybody else is an administrator because one of those people
 * — or someone they made one — switched on `users.isAdmin` from the Accounts
 * section, and can be switched off again the same way.
 *
 * Unset and with nobody flagged means nobody, so a self-hosted instance that
 * never heard of this has no admin screen rather than an unguarded one. See
 * .env.example.
 */
const admins = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Named in ADMIN_EMAILS. Emails are stored lowercased at sign-up; compared
 * that way here too.
 */
export function isAdminEmail(email: string): boolean {
  return admins.has(email.trim().toLowerCase());
}

/** Either way in: named in ADMIN_EMAILS, or granted from the admin screen. */
export function isAdmin(user: { email: string; isAdmin: boolean }): boolean {
  return user.isAdmin || isAdminEmail(user.email);
}

/** The signed-in administrator, or null for everybody else. */
export async function adminOrNull() {
  const user = await getCurrentUser();
  return user && isAdmin(user) ? user : null;
}

/**
 * Admin-only access, for rendering a page.
 *
 * A 404 rather than a 403, for the same reason a list someone doesn't own gives
 * one: a signed-in stranger shouldn't learn that this screen exists.
 *
 * Inside a Server Action, prefer `adminOrNull` and answer with a sentence —
 * `notFound()` throws, and a throw from an action takes out the whole screen
 * instead of the one control being used. See list-access.ts, which draws the
 * same line.
 */
export async function requireAdmin() {
  const admin = await adminOrNull();
  if (!admin) notFound();
  return admin;
}
