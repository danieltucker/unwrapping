/**
 * What a list promises its guests about what the owner can see.
 *
 * Written once, because the promise shown on the card, in the reserve dialog
 * and on the context rail has to be the same promise, and the true one for
 * this list. Surprise is per list: a birthday keeps the blindfold, a wedding
 * registry usually doesn't.
 *
 * Who took what is private in both modes. Only *what* is taken changes hands.
 */
export type Visibility = {
  /** The rail's "The owner can see" value. */
  ownerSees: string;
  /** The line a guest reads with their finger over "reserve". */
  reserving: string;
  /**
   * The same line for an idea, which is a different promise: an idea is never
   * taken off the list, so the reassurance is about the other guests seeing a
   * count rather than about the gift disappearing for them.
   */
  takingOnIdea: string;
  /** What a card says under a gift someone else has taken. */
  taken: string;
  /** The rail's closing reassurance. */
  footer: string;
};

export function visibility(surpriseMode: boolean): Visibility {
  if (surpriseMode) {
    return {
      ownerSees: "Nothing",
      reserving:
        "It'll show as taken to other guests. The list owner sees nothing. Nothing is charged, and you can release it any time.",
      takingOnIdea:
        "This is an idea rather than one present, so it stays on the list for everyone else. Other guests just see how many people are covering it, and the list owner sees nothing. You can change your mind any time.",
      taken: "Already taken care of. The owner doesn't know, so don't spoil it.",
      footer:
        "Reserving costs you nothing. It only stops two people buying the same thing.",
    };
  }

  return {
    ownerSees: "What's taken, not who",
    reserving:
      "It'll show as taken to other guests. This list isn't a surprise: the owner can see that this gift is taken, but never that it was you. Nothing is charged, and you can release it any time.",
    takingOnIdea:
      "This is an idea rather than one present, so it stays on the list for everyone else. Other guests see how many people are covering it, and this list isn't a surprise, so the owner sees that count too — never that you are in it. You can change your mind any time.",
    taken: "Already taken care of.",
    footer:
      "Reserving costs you nothing. It stops two people buying the same thing, and lets the owner see what's still needed, never who took what.",
  };
}
