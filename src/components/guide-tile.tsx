import Link from "next/link";

import { SuggestionTracker } from "@/components/tracking";
import type { GuideSummary } from "@/lib/guides";
import { trackingEnabled } from "@/lib/tracking-flag";

/**
 * One gift guide on a browse page: /gifts, a category's shelf, the homepage.
 *
 * The three photos are the pitch. A name like "For the PC gamer" says who it
 * is for; a keyboard, a headset and a desk mat say whether it's any good.
 */
export function GuideTile({
  guide,
  showCategory = true,
  surface,
}: {
  guide: GuideSummary;
  /** Off on a category's own page, where every tile would say the same thing. */
  showCategory?: boolean;
  /** Which browse page this is, for suggestion_impression and suggestion_click. */
  surface: "home" | "gifts" | "category";
}) {
  const slots = [0, 1, 2].map((index) => guide.previews[index] ?? null);

  return (
    <li>
      {trackingEnabled() ? <SuggestionTracker listId={guide.id} surface={surface} /> : null}
      <Link
        href={guide.href}
        className="group flex h-full flex-col overflow-hidden rounded-card border border-ink-line bg-surface transition-colors duration-150 hover:border-violet-edge focus-ring"
      >
        <div className="grid h-[150px] grid-cols-3 gap-px bg-ink-line" aria-hidden="true">
          {slots.map((preview, index) => (
            <span
              key={index}
              className="flex items-center justify-center overflow-hidden bg-ink/[.03]"
            >
              {preview?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="text-[2.25rem] leading-none">
                  {preview?.emoji ?? (index === 0 ? guide.emoji : "")}
                </span>
              )}
            </span>
          ))}
        </div>

        <div className="flex flex-1 flex-col p-[17px]">
          {showCategory && guide.category ? (
            <p className="mb-[6px] text-2xs font-semibold uppercase tracking-[1.3px] text-violet">
              {guide.category.name}
            </p>
          ) : null}
          <h3 className="mb-[6px] text-lg font-semibold leading-[1.25] tracking-[-.2px] group-hover:underline">
            <span className="mr-2">{guide.emoji}</span>
            {guide.name}
          </h3>
          {guide.description ? (
            <p className="mb-3 line-clamp-2 flex-1 text-sm leading-[1.6] text-ink-76">
              {guide.description}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <p className="text-xs font-medium text-ink-62">
            {guide.giftCount} {guide.giftCount === 1 ? "idea" : "ideas"} · by {guide.ownerName}
            {guide.copyCount > 0
              ? ` · copied ${guide.copyCount} ${guide.copyCount === 1 ? "time" : "times"}`
              : ""}
          </p>
        </div>
      </Link>
    </li>
  );
}

/** The grid the tiles sit in, so every browse page lays them out the same way. */
export function GuideGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
  );
}
