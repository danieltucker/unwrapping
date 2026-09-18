import { CardPhoto } from "@/components/card-photo";
import { BoughtButton, ReleaseButton, ReserveDialog } from "@/components/reserve-dialog";
import { formatPrice } from "@/config/site";
import type { ClaimRule } from "@/db/schema";
import type { PublicItem } from "@/lib/claims";
import { isStillOpen } from "@/lib/funding";

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
 *
 * An idea may also carry presents of its own — needles and wool under
 * "knitting" — and those are the opposite again: ordinary gifts, each with a
 * price and a shop, each used up by the one person who buys it. They are listed
 * under the idea rather than in the grid because the idea is the reason they
 * make sense together; a tyre patch on its own says nothing.
 */
export function IdeaCard({
  item,
  suggestions,
  handle,
  listKey,
  claimRule,
  viewerIsOwner,
  signedIn,
  surpriseMode,
}: {
  item: PublicItem;
  /** Presents the owner hung under this idea. Ordinary gifts, in list order. */
  suggestions: PublicItem[];
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

        {suggestions.length > 0 ? (
          <Suggestions
            suggestions={suggestions}
            handle={handle}
            listKey={listKey}
            claimRule={claimRule}
            viewerIsOwner={viewerIsOwner}
            signedIn={signedIn}
            surpriseMode={surpriseMode}
          />
        ) : null}

        <Action
          item={item}
          hasSuggestions={suggestions.length > 0}
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

/**
 * The presents hanging under an idea.
 *
 * Each one is an ordinary gift and is treated like one: it has a price, it
 * links out to a shop, and the first guest to take it takes it. That is the
 * whole reason they are worth listing separately from the idea above them —
 * "needles" is something a guest can actually go and buy, where "knitting" is
 * only a direction.
 *
 * Deliberately a list of rows rather than small cards. They are suggestions
 * inside something else, and giving them the full card treatment made them
 * compete with the real grid above for the same attention.
 */
function Suggestions({
  suggestions,
  handle,
  listKey,
  claimRule,
  viewerIsOwner,
  signedIn,
  surpriseMode,
}: {
  suggestions: PublicItem[];
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  viewerIsOwner: boolean;
  signedIn: boolean;
  surpriseMode: boolean;
}) {
  const free = suggestions.filter(isStillOpen).length;

  return (
    <div className="mb-[14px] border-t border-ink-line pt-[13px]">
      <p className="mb-[9px] text-2xs font-semibold uppercase tracking-[1.3px] text-ink-62">
        {/* The count is about what is left to buy, so it is only worth saying
            when some of it has gone. */}
        {free === suggestions.length
          ? suggestions.length === 1
            ? "One that fits"
            : `${suggestions.length} that fit`
          : `${free} of ${suggestions.length} still free`}
      </p>

      <ul className="flex flex-col gap-[7px]">
        {suggestions.map((suggestion) => (
          <SuggestionRow
            key={suggestion.id}
            item={suggestion}
            handle={handle}
            listKey={listKey}
            claimRule={claimRule}
            viewerIsOwner={viewerIsOwner}
            signedIn={signedIn}
            surpriseMode={surpriseMode}
          />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
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
  const open = isStillOpen(item);
  // Taken by somebody else: still worth showing, because "that one is handled"
  // is useful to the next guest, but it is no longer an offer.
  const gone = !open && !item.claimedByViewer;

  return (
    <li
      className={`flex items-center gap-[10px] rounded-[9px] border px-[9px] py-2 ${
        item.claimedByViewer
          ? "border-pine/25 bg-pine/[.06]"
          : gone
            ? "border-ink-line bg-ink/[.03]"
            : "border-ink-line bg-surface"
      }`}
    >
      <span
        className={`flex h-[38px] w-[32px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-ink/[.05] ${
          gone ? "opacity-55" : ""
        }`}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        ) : item.emoji ? (
          <span className="text-base leading-none">{item.emoji}</span>
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold leading-[1.35]">
          {/* The link is the title itself, the way it is on a gift card. */}
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline-offset-2 hover:underline focus-ring"
            >
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </span>
        <span className="block text-2xs leading-[1.4] text-ink-62">
          {item.claimedByViewer
            ? item.boughtByViewer
              ? "✓ You got this one"
              : "You're getting this"
            : gone
              ? "Taken care of"
              : [
                  item.priceCents === null ? null : formatPrice(item.priceCents),
                  item.sourceDomain,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No price listed"}
        </span>
      </span>

      {viewerIsOwner || gone ? null : item.claimedByViewer ? (
        <ReleaseButton
          itemId={item.id}
          handle={handle}
          listKey={listKey}
          size="sm"
          className="shrink-0"
        />
      ) : (
        <ReserveDialog
          item={item}
          handle={handle}
          listKey={listKey}
          needsFirstName={claimRule === "firstName"}
          emphasis="outline"
          signedIn={signedIn}
          surpriseMode={surpriseMode}
          size="sm"
        />
      )}
    </li>
  );
}

function Action({
  item,
  hasSuggestions,
  handle,
  listKey,
  claimRule,
  viewerIsOwner,
  signedIn,
  surpriseMode,
}: {
  item: PublicItem;
  /** Changes what this button is *for*, not what it does. */
  hasSuggestions: boolean;
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
    <>
      {/* With presents listed above it, this button has stopped being the only
          thing to do here and become the way past them: none of these, I'll
          find my own. Saying so is what keeps the rows above from reading as
          the only choices on offer. */}
      {hasSuggestions ? (
        <p className="mb-[9px] text-center text-2xs leading-[1.5] text-ink-62">
          Or go your own way with it
        </p>
      ) : null}
      <ReserveDialog
        item={item}
        handle={handle}
        listKey={listKey}
        needsFirstName={claimRule === "firstName"}
        emphasis="outline"
        signedIn={signedIn}
        surpriseMode={surpriseMode}
      />
    </>
  );
}
