/**
 * Handles and short codes. Pure, so `node scripts/test-parse.mts`-style checks
 * can cover them without a database.
 */

/** Paths the app owns; a handle must never shadow one. */
const RESERVED_HANDLES = new Set([
  "lists",
  "list",
  "new",
  "sign-in",
  "sign-up",
  "sign-out",
  "settings",
  "account",
  "uploads",
  "api",
  "admin",
  "help",
  "about",
  "pricing",
  "support",
  "me",
  "you",
  "reserved",
]);

const MAX_HANDLE = 24;

export function handleFromName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_HANDLE)
    .replace(/-+$/g, "");

  return base || "friend";
}

/**
 * Candidates in order of niceness: first name, then the full name, then
 * numbered variants. "Dan Tucker" prefers /lists/dan over /lists/dan-tucker.
 */
export async function uniqueHandle(
  name: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const full = handleFromName(name);
  const first = handleFromName(name.split(/\s+/)[0] ?? "");

  const candidates = first && first !== full ? [first, full] : [full];

  for (const candidate of candidates) {
    if (!RESERVED_HANDLES.has(candidate) && !(await taken(candidate))) {
      return candidate;
    }
  }

  const base = candidates[candidates.length - 1];
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!RESERVED_HANDLES.has(candidate) && !(await taken(candidate))) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a handle");
}

// No 0/O/1/l/I: these get read aloud and typed in from a phone screen.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 7;

/** A short share code. ~56^7 ≈ 1.7e12 combinations, so collisions are rare. */
export function generateShortCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** Rare, but a collision must never silently overwrite someone's list. */
export async function uniqueShortCode(
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateShortCode();
    if (!(await taken(candidate))) return candidate;
  }
  throw new Error("Could not allocate a short code");
}

export { RESERVED_HANDLES };
