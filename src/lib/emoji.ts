/**
 * Emoji suggestions derived from the list name as the owner types.
 * There is deliberately no occasion-type selector; the name is the input.
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

/**
 * The same idea one level down, for a single gift rather than the occasion.
 * A gift written in by hand usually has no photo, so this is what the card
 * shows instead. Cash is first because it is the case with no picture at all.
 */
const GIFT_VOCABULARY: Vocabulary[] = [
  {
    keywords: ["cash", "money", "contribution", "fund", "towards", "voucher", "gift card"],
    emoji: ["💸", "💰", "🧧", "🎫", "🪙"],
  },
  { keywords: ["coffee", "espresso", "cafetiere", "barista"], emoji: ["☕", "🫖", "🧋"] },
  { keywords: ["tea", "kettle", "teapot"], emoji: ["🫖", "☕", "🍵"] },
  { keywords: ["book", "novel", "reading", "cookbook"], emoji: ["📚", "📖", "📕"] },
  { keywords: ["headphone", "speaker", "vinyl", "record", "music"], emoji: ["🎧", "🔊", "🎵"] },
  { keywords: ["camera", "lens", "photo"], emoji: ["📷", "🎞️", "🖼️"] },
  { keywords: ["plant", "seed", "garden", "pot"], emoji: ["🪴", "🌱", "🌷"] },
  { keywords: ["candle", "lamp", "light"], emoji: ["🕯️", "💡", "🪔"] },
  { keywords: ["pan", "knife", "kitchen", "cook", "bake", "oven"], emoji: ["🍳", "🔪", "🧑‍🍳"] },
  { keywords: ["wine", "whisky", "gin", "beer", "glass"], emoji: ["🍷", "🥃", "🍺"] },
  { keywords: ["blanket", "towel", "bedding", "cushion", "throw"], emoji: ["🛏️", "🧺", "🛋️"] },
  { keywords: ["jumper", "shirt", "coat", "dress", "socks", "clothes"], emoji: ["👕", "🧥", "🧦"] },
  { keywords: ["shoe", "boot", "trainer", "sneaker"], emoji: ["👟", "🥾", "👞"] },
  { keywords: ["bag", "rucksack", "luggage", "suitcase"], emoji: ["🎒", "🧳", "👜"] },
  { keywords: ["bike", "cycle", "helmet"], emoji: ["🚲", "🪖", "🛞"] },
  { keywords: ["game", "console", "puzzle", "lego", "toy"], emoji: ["🎮", "🧩", "🧸"] },
  { keywords: ["ticket", "concert", "gig", "theatre", "trip", "flight"], emoji: ["🎟️", "✈️", "🗺️"] },
  { keywords: ["watch", "jewel", "ring", "necklace"], emoji: ["⌚", "💍", "📿"] },
  { keywords: ["tool", "drill", "diy"], emoji: ["🔧", "🪚", "🧰"] },
  { keywords: ["art", "paint", "print", "poster"], emoji: ["🎨", "🖼️", "🖌️"] },
];

const GIFT_FALLBACK = ["🎁", "✨", "⭐", "💝", "🛍️"];

/** Up to five suggestions for one gift's title. Always returns something. */
export function suggestGiftEmoji(title: string, limit = 5): string[] {
  const haystack = title.toLowerCase();

  for (const entry of GIFT_VOCABULARY) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword))) {
      // Short lists are topped up so the row is never a lonely single button.
      return [...new Set([...entry.emoji, ...GIFT_FALLBACK])].slice(0, limit);
    }
  }

  return GIFT_FALLBACK.slice(0, limit);
}

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

/**
 * Accepts a stored emoji from a form: one pictograph, plus the variation
 * selectors, skin tones and zero-width joiners a real emoji is built from.
 * A pasted word fails the first character and comes back null.
 */
const ONE_EMOJI =
  /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]{0,7}$/u;

export function parseGiftEmoji(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return ONE_EMOJI.test(value) ? value : null;
}
