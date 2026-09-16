import Link from "next/link";

import { FundingBar } from "@/components/funding";
import { fundingLine, isFullyFunded } from "@/lib/funding";
import { formatPrice } from "@/config/site";
import type { GuestContribution } from "@/lib/contributions";

/**
 * A group gift this person has put money toward.
 *
 * There is no release button here on purpose: nothing has been charged, so
 * there is nothing to hand back. What matters is how far the gift has got.
 */
export function ContributionRow({
  contribution,
  eventLine,
  chippedOn,
}: {
  contribution: GuestContribution;
  eventLine: string;
  chippedOn: string;
}) {
  const funded = isFullyFunded(contribution.raisedCents, contribution.goalCents);

  return (
    <li className="flex gap-4 rounded-[12px] border border-ink-line bg-surface p-[18px]">
      <div className="h-20 w-[66px] shrink-0 overflow-hidden rounded-[8px] bg-ink/[.05]">
        {contribution.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contribution.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={contribution.listPath}
          className="mb-[6px] flex items-center gap-2 text-2xs font-semibold uppercase tracking-[1.3px] text-ink-62 hover:text-ink-76"
        >
          <span className="text-sm">{contribution.listEmoji}</span>
          {eventLine}
        </Link>

        <p className="mb-[9px] text-base font-semibold">
          {contribution.title}
          <span className="font-normal text-ink-72">
            {", you chipped in "}
            {formatPrice(contribution.yourAmountCents)}
          </span>
        </p>

        <FundingBar
          raisedCents={contribution.raisedCents}
          goalCents={contribution.goalCents}
          className="mb-[7px] max-w-[280px]"
        />

        <p className="mb-[5px] text-xs font-medium text-rose-dark">
          {fundingLine(contribution.raisedCents, contribution.goalCents)}
          {contribution.goalCents
            ? funded
              ? " · nothing more is needed"
              : " · charged only when the goal is met"
            : null}
        </p>

        <p className="text-xs text-ink-72">
          Last chipped in on {chippedOn}
          {contribution.href ? (
            <>
              {" · "}
              <a
                href={contribution.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-violet hover:text-violet-hover"
              >
                {contribution.sourceDomain} ↗
              </a>
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}
