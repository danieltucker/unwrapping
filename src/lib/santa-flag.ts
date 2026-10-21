/**
 * The switch for Secret Santa, read from SECRET_SANTA when it is asked, so an
 * operator flips it with an environment variable and a restart, not a build.
 *
 * - "on", the default: everything works.
 * - "readonly": for an incident in season. Every page still opens and everyone
 *   can still see who they've got, but nothing else changes — no new groups,
 *   no joining, no draws, no messages. See santaPaused.
 * - "off": as if it had never shipped. /secret-santa/** answers 404 from
 *   src/proxy.ts, the links to it are gone, and every action refuses. Drawn
 *   names stay in the database, so turning it back on loses nothing.
 *
 * Anything unrecognised reads as "off": a typo in a kill switch should fail
 * closed. Pure, with no server-only import, because the proxy reads it too.
 */
export type SantaMode = "on" | "readonly" | "off";

export function santaMode(): SantaMode {
  const value = (process.env.SECRET_SANTA ?? "on").trim().toLowerCase();
  if (value === "" || value === "on" || value === "1" || value === "true") return "on";
  if (value === "readonly") return "readonly";
  return "off";
}

export const santaEnabled = (): boolean => santaMode() !== "off";

/**
 * What a Secret Santa action answers when the switch says no, or null when it
 * may go ahead. `reading` is for the few actions that only record that someone
 * looked or flag abuse, which stay open in "readonly".
 */
export function santaPaused(reading = false): string | null {
  const mode = santaMode();
  if (mode === "on") return null;
  if (mode === "readonly" && reading) return null;
  return mode === "readonly"
    ? "Secret Santa is paused for a moment, so nothing can be changed. You can still see who you’ve got. Try again later."
    : "Secret Santa isn't available right now.";
}
