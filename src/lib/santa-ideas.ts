/**
 * Somewhere to start when the person you drew has no wishlist. Pure, so it can
 * be read anywhere.
 *
 * Prompts rather than products: nothing here knows the person, and a list of
 * things to buy would be a guess dressed up as advice. Each set fits inside
 * its budget, so a $10 Santa isn't nudged toward a weekend away.
 */

type Tier = { upTo: number | null; prompts: string[] };

const TIERS: Tier[] = [
  {
    upTo: 1500,
    prompts: [
      "A fancy version of a snack they already love",
      "Good socks in a colour they'd never pick for themselves",
      "A paperback by an author they've mentioned",
      "Something for their desk: a plant, a mug, a notebook",
      "A small thing from their hometown",
    ],
  },
  {
    upTo: 3000,
    prompts: [
      "An upgrade to something they use every day",
      "A candle, tea or coffee from a small local shop",
      "A game the whole family could play on the day",
      "A cookbook for the dish they always make",
      "Something cosy: slippers, a scarf, a throw",
    ],
  },
  {
    upTo: 6000,
    prompts: [
      "Tickets to something: a film, a match, a local show",
      "A better tool for a hobby they already have",
      "A framed print of a place they love",
      "A class or workshop they'd never book for themselves",
      "Headphones, a speaker or a charger that isn't fraying",
    ],
  },
  {
    upTo: null,
    prompts: [
      "An experience you could do together",
      "The nice version of something they've been putting off buying",
      "A subscription for the next few months",
      "Something handmade by someone local",
      "A gift card for the shop they always end up in, with a note",
    ],
  },
];

/** The prompts for a budget in cents. No budget gets the middle set. */
export function ideaPrompts(budgetCents: number | null): string[] {
  if (budgetCents === null) return TIERS[1].prompts;
  return (TIERS.find((tier) => tier.upTo === null || budgetCents <= tier.upTo) ?? TIERS[3]).prompts;
}
