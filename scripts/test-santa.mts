/**
 * Checks for the Secret Santa draw.
 *
 *   node scripts/test-santa.mts
 *
 * A draw that hands someone their own name, or a couple each other, is the
 * one bug this feature can't recover from quietly: by the time anyone notices,
 * people have looked. So the rules are checked over many seeds, not one.
 */
import { drawNames, pairKey, type RandomInt } from "../src/lib/santa-draw.ts";

let failures = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

/** Small, repeatable PRNG (mulberry32), so a failure can be rerun exactly. */
function seeded(seed: number): RandomInt {
  let state = seed >>> 0;
  return (max) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * max);
  };
}

const people = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function valid(
  ids: string[],
  exclusions: Set<string>,
  draw: Map<string, string> | null,
): boolean {
  if (!draw || draw.size !== ids.length) return false;
  const receivers = new Set(draw.values());
  if (receivers.size !== ids.length) return false;
  return ids.every((giver) => {
    const receiver = draw.get(giver);
    return (
      receiver !== undefined &&
      receiver !== giver &&
      ids.includes(receiver) &&
      !exclusions.has(pairKey(giver, receiver))
    );
  });
}

// --- Basic rules, over many seeds -------------------------------------------
for (const n of [2, 3, 4, 7, 20, 100]) {
  const ids = people(n);
  let allValid = true;
  for (let seed = 1; seed <= 200; seed += 1) {
    if (!valid(ids, new Set(), drawNames(ids, new Set(), seeded(seed)))) {
      allValid = false;
      break;
    }
  }
  check(`${n} people: nobody draws themselves, everyone drawn once`, allValid);
}

check("one person can't be drawn", drawNames(["solo"], new Set(), seeded(1)) === null);
check("nobody can't be drawn", drawNames([], new Set(), seeded(1)) === null);

// --- Exclusions ---------------------------------------------------------------
{
  // Two couples: each must draw from the other couple.
  const ids = ["ann", "bob", "cat", "dan"];
  const exclusions = new Set([pairKey("ann", "bob"), pairKey("cat", "dan")]);
  let allValid = true;
  for (let seed = 1; seed <= 200; seed += 1) {
    if (!valid(ids, exclusions, drawNames(ids, exclusions, seeded(seed)))) allValid = false;
  }
  check("couples never draw each other", allValid);
}

{
  // pairKey is order-free, so an exclusion added either way round holds.
  check("pairKey ignores order", pairKey("x", "y") === pairKey("y", "x"));
}

{
  // Three people have two draws, a→b→c→a and its reverse, and both put a and
  // b next to each other. Excluding them leaves nothing.
  const ids = ["a", "b", "c"];
  const exclusions = new Set([pairKey("a", "b")]);
  check(
    "three people with one couple has no valid draw",
    drawNames(ids, exclusions, seeded(3)) === null,
  );
}

{
  // Someone excluded from everybody can't take part.
  const ids = people(5);
  const exclusions = new Set(ids.slice(1).map((other) => pairKey("p0", other)));
  check("someone excluded from everyone: no draw", drawNames(ids, exclusions, seeded(7)) === null);
}

{
  // Tight but possible: 8 people in 4 couples, and each person also excluded
  // from the next couple along. Valid draws are rare enough that shuffling
  // may give up, which exercises the search.
  const ids = people(8);
  const exclusions = new Set<string>();
  for (let couple = 0; couple < 4; couple += 1) {
    const [a, b] = [ids[couple * 2], ids[couple * 2 + 1]];
    const [c, d] = [ids[((couple + 1) % 4) * 2], ids[((couple + 1) % 4) * 2 + 1]];
    exclusions.add(pairKey(a, b));
    exclusions.add(pairKey(a, c));
    exclusions.add(pairKey(a, d));
    exclusions.add(pairKey(b, c));
    exclusions.add(pairKey(b, d));
  }
  let allValid = true;
  for (let seed = 1; seed <= 50; seed += 1) {
    if (!valid(ids, exclusions, drawNames(ids, exclusions, seeded(seed)))) allValid = false;
  }
  check("tight exclusions still find a valid draw", allValid);
}

// --- Fairness: every valid draw of four people comes up ----------------------
{
  // Four people have 9 derangements. Over enough draws each should appear,
  // and none should dominate.
  const ids = people(4);
  const counts = new Map<string, number>();
  const random = seeded(42);
  const runs = 9000;
  for (let i = 0; i < runs; i += 1) {
    const draw = drawNames(ids, new Set(), random)!;
    const key = ids.map((id) => draw.get(id)).join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const values = [...counts.values()];
  check("all 9 draws of four people occur", counts.size === 9, counts.size);
  check(
    "no draw of four people is more than 20% off even",
    values.every((count) => Math.abs(count - runs / 9) < (runs / 9) * 0.2),
    values,
  );
}

console.log(failures === 0 ? "\nAll passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
