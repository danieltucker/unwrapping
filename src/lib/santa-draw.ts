/**
 * Drawing names for a Secret Santa. Pure — no database, no framework — so
 * `node scripts/test-santa.mts` can pin it down.
 *
 * A draw is a permutation in which nobody gets themselves and no excluded pair
 * gets each other. Two passes:
 *
 * 1. Shuffle and check, up to a fixed number of tries. Every valid draw is
 *    equally likely to come out of this, which matters more than it sounds:
 *    a draw that favours some pairings can be worked out by anyone who has
 *    seen a few years of the family's results. Without exclusions about one
 *    shuffle in e is valid, so this nearly always finishes in a handful.
 *
 * 2. If that keeps failing, the exclusions are tight enough that valid draws
 *    are rare, or there are none. A backtracking search settles which, always
 *    trying the person with the fewest choices left first. Its result is
 *    still random, just not perfectly even, which is the price of a family
 *    where almost everybody is excluded from almost everybody else.
 */

/** One shuffle in e succeeds with no exclusions, so this many is overwhelming. */
const SHUFFLE_TRIES = 2000;
/** Steps before the search gives up. A real family never gets close. */
const SEARCH_BUDGET = 200_000;

/** A random whole number in [0, max). Injected so tests can be repeatable. */
export type RandomInt = (max: number) => number;

/** The key an excluded pair is stored under, whichever way round it was given. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function shuffle<T>(values: readonly T[], randomInt: RandomInt): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Giver → receiver for every id, or null when no draw satisfies the
 * exclusions. `exclusions` holds pairKey()s.
 */
export function drawNames(
  ids: readonly string[],
  exclusions: ReadonlySet<string>,
  randomInt: RandomInt,
): Map<string, string> | null {
  if (ids.length < 2) return null;

  const allowed = (giver: string, receiver: string) =>
    giver !== receiver && !exclusions.has(pairKey(giver, receiver));

  for (let attempt = 0; attempt < SHUFFLE_TRIES; attempt += 1) {
    const receivers = shuffle(ids, randomInt);
    if (ids.every((giver, i) => allowed(giver, receivers[i]))) {
      return new Map(ids.map((giver, i) => [giver, receivers[i]]));
    }
  }

  return search(ids, allowed, randomInt);
}

function search(
  ids: readonly string[],
  allowed: (giver: string, receiver: string) => boolean,
  randomInt: RandomInt,
): Map<string, string> | null {
  const options = new Map(
    ids.map((giver) => [giver, shuffle(ids.filter((r) => allowed(giver, r)), randomInt)]),
  );
  // Someone nobody may draw, or who may draw nobody, settles it at once.
  if ([...options.values()].some((list) => list.length === 0)) return null;
  for (const receiver of ids) {
    if (!ids.some((giver) => allowed(giver, receiver))) return null;
  }

  const result = new Map<string, string>();
  const taken = new Set<string>();
  let steps = 0;

  const step = (): boolean => {
    if (result.size === ids.length) return true;
    if ((steps += 1) > SEARCH_BUDGET) return false;

    // The giver with the fewest receivers still free goes next.
    let giver: string | null = null;
    let fewest = Infinity;
    for (const candidate of ids) {
      if (result.has(candidate)) continue;
      const free = options.get(candidate)!.filter((r) => !taken.has(r)).length;
      if (free < fewest) {
        fewest = free;
        giver = candidate;
      }
    }
    if (giver === null || fewest === 0) return false;

    for (const receiver of options.get(giver)!) {
      if (taken.has(receiver)) continue;
      result.set(giver, receiver);
      taken.add(receiver);
      if (step()) return true;
      result.delete(giver);
      taken.delete(receiver);
    }
    return false;
  };

  return step() ? result : null;
}
