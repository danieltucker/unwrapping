/**
 * Checks for handle and short-code generation.
 *
 *   node scripts/test-handles.mts
 *
 * Both end up in URLs people paste and read aloud, so the rules are worth
 * pinning down: no reserved words, no ambiguous characters, no collisions.
 */
import {
  generateShortCode,
  handleFromName,
  uniqueHandle,
  uniqueShortCode,
} from "../src/lib/handle.ts";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`      expected ${JSON.stringify(expected)}`);
    console.log(`      actual   ${JSON.stringify(actual)}`);
  }
}

const never = async () => false;
const takenSet = (...handles: string[]) => {
  const set = new Set(handles);
  return async (candidate: string) => set.has(candidate);
};

// --- Handles from names ---------------------------------------------------
check("full name slugifies", handleFromName("Dan Tucker"), "dan-tucker");
check("punctuation dropped", handleFromName("O'Brien-Smith!"), "o-brien-smith");
check("diacritics folded", handleFromName("Émilie"), "emilie");
check("emoji-only falls back", handleFromName("🎂🎂"), "friend");

// --- Uniqueness -----------------------------------------------------------
check("prefers the first name", await uniqueHandle("Dan Tucker", never), "dan");
check(
  "falls back to full name when taken",
  await uniqueHandle("Dan Tucker", takenSet("dan")),
  "dan-tucker",
);
check(
  "numbers when both are taken",
  await uniqueHandle("Dan Tucker", takenSet("dan", "dan-tucker")),
  "dan-tucker2",
);
check(
  "a reserved word never becomes a handle",
  await uniqueHandle("Lists", never),
  "lists2",
);
check(
  "single name with no collision",
  await uniqueHandle("Prince", never),
  "prince",
);

// --- Short codes ----------------------------------------------------------
const code = generateShortCode();
check("short code length", code.length, 7);
check("no ambiguous characters", /^[23456789a-km-zA-HJ-NP-Z]+$/.test(code), true);

const codes = new Set(Array.from({ length: 5000 }, () => generateShortCode()));
check("5000 codes are effectively unique", codes.size > 4990, true);

let attempts = 0;
const code2 = await uniqueShortCode(async () => {
  attempts += 1;
  return attempts < 3; // first two are "taken"
});
check("retries past collisions", code2.length, 7);
check("retried exactly twice", attempts, 3);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
