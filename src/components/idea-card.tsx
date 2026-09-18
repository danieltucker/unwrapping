import { CardPhoto } from "@/components/card-photo";
import { BoughtButton, ReleaseButton, ReserveDialog } from "@/components/reserve-dialog";
import type { ClaimRule } from "@/db/schema";
import type { PublicItem } from "@/lib/claims";

/**
 * An idea on the public list: "knitting", "Xbox games".
 *
 * A gift card is about one object and the race to be the person who buys it.
 * This is the opposite. An idea is a direction, so it is never taken, never
 * greys out and never runs out; yarn and needles are both knitting. What a
 * guest gets from it instead is a count, so nobody has to guess whether three
 * other people already went this way.
 *
 * It is a separate component rather than a branch inside GiftCard because
 * almost nothing survives that difference: no price, no shop, no funding bar,
 * no taken state, and a different question on the button.
 */
export function IdeaCard({
  item,
  handle,
  listKey,
  claimRule,
  viewerIsOwner,
  signedIn,
  surpriseMode,
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  viewerIsOwner: boolean;
  signedIn: boolean;
  surpriseMode: boolean;
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-ink-line bg-surface">
      <CardPhoto
        image={item.image}
        emoji={item.emoji}
        fallback="Pick whatever you think fits"
        height="h-[160px]"
      />

      {/* Violet when it's the one they'd most like, otherwise the plain band.
          Ideas get no colour of their own: the section they sit in has already
          said what they are, and a fourth band would need a fourth legend. */}
      <div
        className={`h-1 ${item.isMostWanted ? "bg-violet" : "bg-ink/12"}`}
        aria-hidden="true"
      />

      <div className="flex flex-1 flex-col p-[17px]">
        <Pill item={item} />

        <h3 className="mb-[7px] text-lg font-semibold leading-[1.25] tracking-[-.2px]">
          {item.title}
        </h3>

        <p className="mb-[14px] flex-1 text-sm leading-[1.65] text-ink-76">
          {item.reason ?? "Anything along these lines would land well."}
        </p>

        <Action
          item={item}
          handle={handle}
          listKey={listKey}
          claimRule={claimRule}
          viewerIsOwner={viewerIsOwner}
          signedIn={signedIn}
          surpriseMode={surpriseMode}
        />
      </div>
    </li>
  );
}

/**
 * One pill, in the order it matters to the person reading it: what they
 * themselves have done, then how busy the idea already is, then whether the
 * owner singled it out.
 *
 * The count is people, never names, and on a surprise list the owner is handed
 * zero for it — see getPublicList, which is where that is enforced.
 */
function Pill({ item }: { item: PublicItem }) {
  const base =
    "mb-[10px] self-start rounded-pill px-[10px] py-[3px] text-2xs font-semibold";

  if (item.claimedByViewer) {
    return (
      <span className={`${base} bg-pine/10 text-pine-dark`}>
        {item.boughtByViewer ? "✓ You got this one" : "You're getting something"}
      </span>
    );
  }
  if (item.claimedCount > 0) {
    return (
      <span className={`${base} bg-ink/[.06] text-ink-72`}>
        {item.claimedCount} {item.claimedCount === 1 ? "person" : "people"} on this
      </span>
    );
  }
  if (item.isMostWanted) {
    return <span className={`${base} bg-violet/10 text-violet-hover`}>Most wanted</span>;
  }
  return <span className={`${base} bg-ink/[.06] text-ink-72`}>Idea</span>;
}

function Action({
  item,
  handle,
  listKey,
  claimRule,
  viewerIsOwner,
  signedIn,
  surpriseMode,
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  viewerIsOwner: boolean;
  signedIn: boolean;
  surpriseMode: boolean;
}) {
  if (viewerIsOwner) {
    return (
      <p className="rounded-pill bg-ink/[.04] py-3 text-center text-xs font-medium text-ink-62">
        Guests pick from here
      </p>
    );
  }

  // Someone already on this idea gets the same two controls a reserved gift
  // has: tick it off, or step back out and let the count drop.
  if (item.claimedByViewer) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <BoughtButton
          itemId={item.id}
          handle={handle}
          listKey={listKey}
          bought={item.boughtByViewer}
          deliveryAddress={item.deliveryAddress}
          size="sm"
          className=""
        />
        <ReleaseButton
          itemId={item.id}
          handle={handle}
          listKey={listKey}
          label="Take me off"
          size="sm"
          className=""
        />
      </div>
    );
  }

  // Never "filled": the one emphasised button on a screen belongs to a present
  // somebody still has to buy.
  return (
    <ReserveDialog
      item={item}
      handle={handle}
      listKey={listKey}
      needsFirstName={claimRule === "firstName"}
      emphasis="outline"
      signedIn={signedIn}
      surpriseMode={surpriseMode}
    />
  );
}
