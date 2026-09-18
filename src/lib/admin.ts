import "server-only";

import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

/**
 * Who is allowed into /admin.
 *
 * Deliberately an environment variable rather than a column on `users`: the
 * person who can set it is the person who runs the instance, which is the only
 * honest definition of an administrator here. A flag in the database would have
 * to be turned on by editing the database anyway — there is nobody to grant it
 * — and it would then be reachable by anything that can write a row.
 *
 * Unset means nobody, so a self-hosted instance that never heard of this has no
 * admin screen rather than an unguarded one. See .env.example.
 */
const admins = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
);

/** Emails are stored lowercased at sign-up; compared that way here too. */
export function isAdminEmail(email: string): boolean {
  return admins.has(email.trim().toLowerCase());
}

/** The signed-in administrator, or null for everybody else. */
export async function adminOrNull() {
  const user = await getCurrentUser();
  return user && isAdminEmail(user.email) ? user : null;
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
