import { ReleaseButton, ReserveDialog } from "@/components/reserve-dialog";
import { formatPrice } from "@/config/site";
import type { PublicItem } from "@/lib/claims";
import type { ClaimRule } from "@/db/schema";

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
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  emphasis: "filled" | "outline";
  viewerIsOwner: boolean;
  signedIn: boolean;
}) {
  const takenByAnother = item.unitsFree === 0 && !item.claimedByViewer;
  const band = takenByAnother
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
        {takenByAnother ? (
          <span className="pointer-events-none absolute inset-0 bg-paper/50" />
        ) : null}
      </div>

      <div className={`h-1 ${band}`} aria-hidden="true" />

      <div className="flex flex-1 flex-col p-[17px]">
        <Pill item={item} takenByAnother={takenByAnother} />

        <div className="mb-[7px] flex items-baseline justify-between gap-3">
          <h3
            className={`text-lg font-semibold leading-[1.25] tracking-[-.2px] ${
              takenByAnother ? "text-ink/62" : ""
            }`}
          >
            {item.title}
          </h3>
          {item.priceCents !== null ? (
            <span
              className={`whitespace-nowrap font-display text-[1.375rem] ${
                takenByAnother ? "text-ink/55" : ""
              }`}
            >
              {formatPrice(item.priceCents)}
            </span>
          ) : null}
        </div>

        {item.isGroupGift && item.goalCents ? (
          <div className="mb-2">
            <div
              className="h-1.5 overflow-hidden rounded-pill bg-ink/[.08]"
              role="progressbar"
              aria-valuenow={item.raisedCents}
              aria-valuemin={0}
              aria-valuemax={item.goalCents}
              aria-label="Amount raised so far"
            >
              <div
                className="h-full rounded-pill bg-rose"
                style={{
                  width: `${Math.min(
                    Math.round((item.raisedCents / item.goalCents) * 100),
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <p className="mb-[14px] flex-1 text-sm leading-[1.65] text-ink-76">
          {takenByAnother
            ? "Already taken care of. The owner doesn't know — don't spoil it."
            : (item.reason ?? "")}
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
          takenByAnother={takenByAnother}
        />
      </div>
    </li>
  );
}

function Pill({
  item,
  takenByAnother,
}: {
  item: PublicItem;
  takenByAnother: boolean;
}) {
  const base =
    "mb-[10px] self-start rounded-pill px-[10px] py-[3px] text-2xs font-semibold";

  if (takenByAnother) {
    return <span className={`${base} bg-pine/10 text-pine-dark`}>✓ Taken care of</span>;
  }
  if (item.claimedByViewer) {
    return <span className={`${base} bg-pine/10 text-pine-dark`}>You reserved this</span>;
  }
  if (item.isGroupGift) {
    return <span className={`${base} bg-rose/10 text-rose-dark`}>Chip in together</span>;
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
  takenByAnother,
}: {
  item: PublicItem;
  handle: string;
  listKey: string;
  claimRule: ClaimRule;
  emphasis: "filled" | "outline";
  viewerIsOwner: boolean;
  signedIn: boolean;
  takenByAnother: boolean;
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

  // A claimed gift shows no button at all: the state is the affordance.
  if (takenByAnother) return null;

  if (item.claimedByViewer) {
    return <ReleaseButton itemId={item.id} handle={handle} listKey={listKey} />;
  }

  if (item.isGroupGift) {
    return (
      <p className="rounded-pill bg-rose/10 py-3 text-center text-xs font-medium text-rose-dark">
        Chipping in comes later
      </p>
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
    />
  );
}
