/**
 * Emoji suggestions derived from the list name as the owner types.
 * There is deliberately no occasion-type selector — the name is the input.
 *
 * Debounce the caller by ~300ms, and once the owner picks an emoji explicitly,
 * stop updating: their choice is sticky.
 */

type Vocabulary = { keywords: string[]; emoji: string[] };

// First match wins, so put the specific entries above the general ones.
const VOCABULARY: Vocabulary[] = [
  {
    keywords: ["wedding", "marry", "marries", "married", "bride", "groom"],
    emoji: ["💍", "🥂", "🤍", "🎁", "🕊️"],
  },
  {
    keywords: ["engagement", "engaged", "proposal"],
    emoji: ["💍", "💐", "🥂", "✨", "🎁"],
  },
  {
    keywords: ["baby", "shower", "newborn", "expecting", "bump"],
    emoji: ["🍼", "👶", "🧸", "🌙", "🎁"],
  },
  {
    keywords: ["christmas", "xmas", "santa", "yule"],
    emoji: ["🎄", "🎁", "⭐", "🦌", "🕯️"],
  },
  { keywords: ["hanukkah", "chanukah"], emoji: ["🕎", "🕯️", "✨", "🎁", "⭐"] },
  { keywords: ["diwali"], emoji: ["🪔", "✨", "🎆", "🎁", "🌸"] },
  { keywords: ["easter"], emoji: ["🐣", "🌷", "🐰", "🍫", "🎁"] },
  { keywords: ["halloween", "spooky"], emoji: ["🎃", "👻", "🕸️", "🦇", "🍬"] },
  {
    keywords: ["housewarming", "new home", "new house", "moving", "apartment"],
    emoji: ["🏡", "🔑", "🪴", "🛋️", "🎁"],
  },
  {
    keywords: ["graduation", "graduates", "graduating", "degree"],
    emoji: ["🎓", "📚", "🎉", "🥂", "✨"],
  },
  {
    keywords: ["anniversary", "years together"],
    emoji: ["❤️", "🥂", "💐", "🎁", "✨"],
  },
  {
    keywords: ["retirement", "retires", "retiring"],
    emoji: ["🏖️", "🎉", "🥂", "🎁", "✨"],
  },
  {
    keywords: ["honeymoon", "travel", "trip", "holiday", "vacation"],
    emoji: ["✈️", "🌍", "🧳", "🏖️", "🗺️"],
  },
  {
    keywords: ["birthday", "turns", "bday", "b-day", "born"],
    emoji: ["🎂", "🥳", "🍾", "🎁", "✨"],
  },
];

const FALLBACK = ["🎁", "🎉", "✨", "🥳", "🎂"];

/** Up to five suggestions for a list name. Always returns something. */
export function suggestEmoji(listName: string, limit = 5): string[] {
  const haystack = listName.toLowerCase();

  for (const entry of VOCABULARY) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword))) {
      return entry.emoji.slice(0, limit);
    }
  }

  return FALLBACK.slice(0, limit);
}

/**
 * The phrase that matched, for the "Suggested from …" label in the UI.
 * Null when nothing matched and the fallback set is being shown.
 */
export function matchedPhrase(listName: string): string | null {
  const haystack = listName.toLowerCase();

  for (const entry of VOCABULARY) {
    const hit = entry.keywords.find((keyword) => haystack.includes(keyword));
    if (!hit) continue;

    // "Maya turns 30" → "turns 30" reads better than "turns".
    const index = haystack.indexOf(hit);
    const trailing = listName.slice(index + hit.length).match(/^\s+\S+/)?.[0];
    return (listName.slice(index, index + hit.length) + (trailing ?? "")).trim();
  }

  return null;
}
