import type { ClaimRule } from "@/db/schema";

/**
 * Who may claim a gift, and the one line of consequence copy each option
 * carries. Type-only import of ClaimRule, so a client form can use this list
 * without pulling the database schema into the browser bundle.
 */
export const CLAIM_RULE_OPTIONS: {
  value: ClaimRule;
  title: string;
  detail: string;
}[] = [
  {
    value: "anonymous",
    title: "Anyone with the link, anonymously",
    detail: "No sign-up. Guests see what's taken; nobody sees who took it.",
  },
  {
    value: "firstName",
    title: "Ask for a first name",
    detail: "Guests can coordinate with each other. Still hidden from you.",
  },
  {
    value: "account",
    title: "Require an account",
    detail: "Best for big lists where duplicates get expensive.",
  },
];

/** Anything unrecognised falls back to the most permissive rule, as on create. */
export function parseClaimRule(value: FormDataEntryValue | null): ClaimRule {
  const candidate = String(value ?? "");
  return CLAIM_RULE_OPTIONS.some((option) => option.value === candidate)
    ? (candidate as ClaimRule)
    : "anonymous";
}
