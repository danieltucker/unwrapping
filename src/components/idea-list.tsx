import { IdeaCard } from "@/components/idea-card";
import type { ClaimRule } from "@/db/schema";
import type { PublicItem } from "@/lib/claims";

/**
 * The ideas, under the presents and behind their own heading.
 *
 * They are kept apart because they answer a different question. Everything
 * above is a specific thing with a specific price that one person buys; this
 * is where someone who would rather choose for themselves comes to find out
 * what sort of thing would be welcome. Mixed into the grid they would read as
 * gifts that had lost their price.
 *
 * Deliberately a server component with no filters or sorting of its own: there
 * is nothing here to sort by, and a second row of chips under the first would
 * suggest the two sections were the same kind of list.
 */
export function IdeaList({
  items,
  handle,
  listKey,
  claimRule,
  viewerIsOwner,
  signedIn,
  surpriseMode,
  /** True when the ideas are all this list has; it changes the framing. */
  alone,
}: {
  items: PublicItem[];
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  viewerIsOwner: boolean;
  signedIn: boolean;
  surpriseMode: boolean;
  alone: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className={alone ? undefined : "mt-9 border-t border-ink-line pt-7"}>
      <h2 className="text-lg font-semibold tracking-[-.2px]">
        {alone ? "Ideas" : "Ideas, if you’d rather pick yourself"}
      </h2>
      <p className="mb-[18px] mt-1 max-w-[42rem] text-sm leading-[1.65] text-ink-72">
        Not specific presents, so nothing here gets used up: take one on and it
        stays for everyone else. The count tells you how many people have already
        gone that way.
      </p>

      <ul className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <IdeaCard
            key={item.id}
            item={item}
            handle={handle}
            listKey={listKey}
            claimRule={claimRule}
            viewerIsOwner={viewerIsOwner}
            signedIn={signedIn}
            surpriseMode={surpriseMode}
          />
        ))}
      </ul>
    </section>
  );
}
