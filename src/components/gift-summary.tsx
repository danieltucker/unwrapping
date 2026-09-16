import { formatPrice } from "@/config/site";
import type { PublicItem } from "@/lib/claims";

/** The gift as it appears at the top of a reserve or chip-in dialog. */
export function GiftSummary({ item }: { item: PublicItem }) {
  return (
    <div className="mb-[22px] flex gap-[15px]">
      <div className="h-[88px] w-[72px] shrink-0 overflow-hidden rounded-[9px] bg-ink/[.05]">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        ) : item.emoji ? (
          <span className="flex h-full items-center justify-center text-[2rem] leading-none">
            {item.emoji}
          </span>
        ) : null}
      </div>
      <div className="pr-10">
        <p className="mb-1 text-base font-semibold leading-[1.3]">{item.title}</p>
        <p className="text-sm font-medium text-ink-72">
          {item.kind === "cash"
            ? item.goalCents !== null
              ? `${formatPrice(item.goalCents)} target`
              : "Cash gift"
            : item.priceCents !== null
              ? formatPrice(item.priceCents)
              : "No price"}
          {item.sourceDomain ? ` · ${item.sourceDomain}` : ""}
        </p>
      </div>
    </div>
  );
}
