/**
 * The picture at the top of a card on the public list.
 *
 * Shared by the two kinds of card so a gift and an idea sitting in the same
 * column agree on height and on what stands in when there is no photo. The
 * fallback wording is the caller's, because "no photo" is a gap on a present
 * and simply how things are on an idea.
 */
export function CardPhoto({
  image,
  emoji,
  fallback,
  height = "h-[250px]",
  dimmed = false,
}: {
  image: string | null;
  emoji: string | null;
  fallback: string;
  /**
   * A product photo is the reason to look at a gift card, so it gets the room.
   * An idea is usually a single emoji, and the same height under one leaves a
   * card that is mostly nothing.
   */
  height?: string;
  /** Greys the picture out under a gift nobody needs to buy any more. */
  dimmed?: boolean;
}) {
  return (
    <div className={`relative bg-ink/[.035] ${height}`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : emoji ? (
        <span className="flex h-full items-center justify-center text-[5rem] leading-none">
          {emoji}
        </span>
      ) : (
        <span className="flex h-full items-center justify-center px-6 text-center text-xs text-ink-62">
          {fallback}
        </span>
      )}
      {dimmed ? (
        <span className="pointer-events-none absolute inset-0 bg-paper/50" />
      ) : null}
    </div>
  );
}
