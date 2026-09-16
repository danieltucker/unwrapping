/** Public list URLs are the product's whole distribution model, so slugs stay short and typable. */

const MAX_LENGTH = 40;

// Slugs that would collide with app routes.
const RESERVED = new Set([
  "api",
  "sign-in",
  "sign-up",
  "sign-out",
  "lists",
  "list",
  "new",
  "settings",
  "reserved",
  "preview",
  "about",
  "pricing",
  "help",
  "_next",
]);

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    // Strip diacritics and anything that isn't a letter, digit or space.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, MAX_LENGTH)
    .replace(/^-+|-+$/g, "");

  return base || "list";
}

/**
 * Finds a free slug, appending -2, -3, … on collision.
 * `exists` is injected so this stays testable and free of database imports.
 */
export async function uniqueSlug(
  input: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(input);
  let candidate = base;
  let suffix = 1;

  while (RESERVED.has(candidate) || (await exists(candidate))) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}
