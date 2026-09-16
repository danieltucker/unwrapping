import { ChipInDialog } from "@/components/chip-in-dialog";
import { FundingBar } from "@/components/funding";
import { fundingLine, isFullyFunded } from "@/lib/funding";
import {
  BoughtButton,
  ReleaseButton,
  ReserveDialog,
} from "@/components/reserve-dialog";
import { formatPrice } from "@/config/site";
import type { PublicItem } from "@/lib/claims";
import type { ClaimRule } from "@/db/schema";
import { visibility } from "@/lib/visibility";

/**
 * Status is never carried by colour alone: every coloured band is paired with a
 * text pill saying the same thing.
 */
const BANDS = {
  claimed: "bg-pine",
  group: "bg-rose",
  wanted: "bg-violet",
  plain: "bg-ink/12",
} as const;

export function GiftCard({
  item,
  handle,
  listKey,
  claimRule,
  emphasis,
  viewerIsOwner,
  signedIn,
  surpriseMode,
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  emphasis: "filled" | "outline";
  viewerIsOwner: boolean;
  signedIn: boolean;
  surpriseMode: boolean;
}) {
  const takenByAnother = item.unitsFree === 0 && !item.claimedByViewer;
  // A group gift that has met its goal needs nothing further, so it reads the
  // same way a claimed gift does: pine, and no button.
  const funded = item.isGroupGift && isFullyFunded(item.raisedCents, item.goalCents);
  const settled = takenByAnother || funded;

  const band = settled
    ? BANDS.claimed
    : item.isGroupGift
      ? BANDS.group
      : item.isMostWanted
        ? BANDS.wanted
        : BANDS.plain;

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-ink-line bg-surface">
      <div className="relative h-[250px] bg-ink/[.035]">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-6 text-center text-xs text-ink-62">
            No photo for this one
          </span>
        )}
        {settled ? (
          <span className="pointer-events-none absolute inset-0 bg-paper/50" />
        ) : null}
      </div>

      <div className={`h-1 ${band}`} aria-hidden="true" />

      <div className="flex flex-1 flex-col p-[17px]">
        <Pill item={item} takenByAnother={takenByAnother} funded={funded} />

        <div className="mb-[7px] flex items-baseline justify-between gap-3">
          <h3
            className={`text-lg font-semibold leading-[1.25] tracking-[-.2px] ${
              settled ? "text-ink/62" : ""
            }`}
          >
            {item.title}
          </h3>
          {item.priceCents !== null ? (
            <span
              className={`whitespace-nowrap font-display text-[1.375rem] ${
                settled ? "text-ink/55" : ""
              }`}
            >
              {formatPrice(item.priceCents)}
            </span>
          ) : null}
        </div>

        {item.isGroupGift ? (
          <div className="mb-[10px]">
            <FundingBar
              raisedCents={item.raisedCents}
              goalCents={item.goalCents}
              className="mb-[6px]"
            />
            <p className="text-xs font-medium text-ink-72">
              {fundingLine(item.raisedCents, item.goalCents)}
              {item.yourContributionCents > 0
                ? ` · you put in ${formatPrice(item.yourContributionCents)}`
                : null}
            </p>
          </div>
        ) : null}

        <p className="mb-[14px] flex-1 text-sm leading-[1.65] text-ink-76">
          <Body
            item={item}
            takenByAnother={takenByAnother}
            funded={funded}
            surpriseMode={surpriseMode}
          />
        </p>

        {item.href ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mb-3 text-xs font-medium text-violet hover:text-violet-hover"
          >
            {item.sourceDomain} ↗
          </a>
        ) : (
          <p className="mb-3 text-xs font-medium text-ink-66">
            Added by hand · no link
          </p>
        )}

        <Action
          item={item}
          handle={handle}
          listKey={listKey}
          claimRule={claimRule}
          emphasis={emphasis}
          viewerIsOwner={viewerIsOwner}
          signedIn={signedIn}
          settled={settled}
          surpriseMode={surpriseMode}
        />
      </div>
    </li>
  );
}

function Body({
  item,
  takenByAnother,
  funded,
  surpriseMode,
}: {
  item: PublicItem;
  takenByAnother: boolean;
  funded: boolean;
  surpriseMode: boolean;
}) {
  if (takenByAnother) return <>{visibility(surpriseMode).taken}</>;
  if (funded) {
    return <>Fully funded. Nothing more is needed — and the owner only sees a total.</>;
  }
  if (item.reason) return <>{item.reason}</>;
  if (item.isGroupGift) return <>Any amount helps and nothing is wasted.</>;
  return null;
}

function Pill({
  item,
  takenByAnother,
  funded,
}: {
  item: PublicItem;
  takenByAnother: boolean;
  funded: boolean;
}) {
  const base =
    "mb-[10px] self-start rounded-pill px-[10px] py-[3px] text-2xs font-semibold";

  if (takenByAnother) {
    return <span className={`${base} bg-pine/10 text-pine-dark`}>✓ Taken care of</span>;
  }
  if (funded) {
    return <span className={`${base} bg-pine/10 text-pine-dark`}>✓ Fully funded</span>;
  }
  if (item.claimedByViewer) {
    return (
      <span className={`${base} bg-pine/10 text-pine-dark`}>
        {item.boughtByViewer ? "✓ You bought this" : "You reserved this"}
      </span>
    );
  }
  if (item.isGroupGift) {
    return (
      <span className={`${base} bg-rose/10 text-rose-dark`}>
        {item.contributorCount > 0
          ? `Chip in · ${item.contributorCount} ${
              item.contributorCount === 1 ? "person" : "people"
            } so far`
          : "Chip in together"}
      </span>
    );
  }
  if (item.quantity > 1) {
    return (
      <span className={`${base} bg-ink/[.06] text-ink-72`}>
        {item.unitsFree} of {item.quantity} still free
      </span>
    );
  }
  if (item.isMostWanted) {
    return <span className={`${base} bg-violet/10 text-violet-hover`}>Most wanted</span>;
  }
  return null;
}

function Action({
  item,
  handle,
  listKey,
  claimRule,
  emphasis,
  viewerIsOwner,
  signedIn,
  settled,
  surpriseMode,
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  emphasis: "filled" | "outline";
  viewerIsOwner: boolean;
  signedIn: boolean;
  settled: boolean;
  surpriseMode: boolean;
}) {
  // The owner previewing must not be able to claim from their own list, and
  // is told plainly that this view is not the truth.
  if (viewerIsOwner) {
    return (
      <p className="rounded-pill bg-ink/[.04] py-3 text-center text-xs font-medium text-ink-62">
        Guests reserve from here
      </p>
    );
  }

  // A claimed or fully funded gift shows no button at all: the state is the
  // affordance.
  if (settled) return null;

  // The viewer's own reservation: tick it off, or hand it back. Both sit on the
  // card so nobody has to remember the reservations page exists.
  if (item.claimedByViewer) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <BoughtButton
          itemId={item.id}
          handle={handle}
          listKey={listKey}
          bought={item.boughtByViewer}
          size="sm"
          className=""
        />
        <ReleaseButton
          itemId={item.id}
          handle={handle}
          listKey={listKey}
          size="sm"
          className=""
        />
      </div>
    );
  }

  if (item.isGroupGift) {
    return (
      <ChipInDialog
        item={item}
        handle={handle}
        listKey={listKey}
        signedIn={signedIn}
      />
    );
  }

  return (
    <ReserveDialog
      item={item}
      handle={handle}
      listKey={listKey}
      needsFirstName={claimRule === "firstName"}
      emphasis={emphasis}
      signedIn={signedIn}
      surpriseMode={surpriseMode}
    />
  );
}
