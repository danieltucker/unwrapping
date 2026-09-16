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
        ) : null}
      </div>
      <div>
        <p className="mb-1 text-base font-semibold leading-[1.3]">{item.title}</p>
        <p className="text-sm font-medium text-ink-72">
          {item.priceCents !== null ? formatPrice(item.priceCents) : "No price"}
          {item.sourceDomain ? ` · ${item.sourceDomain}` : ""}
        </p>
      </div>
    </div>
  );
}
