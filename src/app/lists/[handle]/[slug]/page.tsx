import { notFound } from "next/navigation";
import Link from "next/link";

import { GiftGrid } from "@/components/gift-grid";
import { EyeOffIcon } from "@/components/ui";
import { formatPrice, site } from "@/config/site";
import { getPublicList } from "@/lib/claims";
import { visibility } from "@/lib/visibility";
import { formatEventDate } from "@/lib/date";
import * as routes from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/lists/[handle]/[slug]">) {
  const { handle, slug } = await params;
  const view = await getPublicList(handle, slug);
  if (!view) return {};

  return {
    title: view.list.name,
    description: view.list.note ?? `A gift list on ${site.name}.`,
  };
}

export default async function PublicListPage({
  params,
}: PageProps<"/lists/[handle]/[slug]">) {
  const { handle, slug } = await params;
  const view = await getPublicList(handle, slug);
  if (!view) notFound();

  const { list, items, stats, viewerIsOwner, ownerHandle } = view;
  // Guests get offered an account after reserving; people who have one don't.
  const signedIn = (await getCurrentUser()) !== null;
  // Every promise on this page comes from one place, and matches this list.
  const promise = visibility(list.surpriseMode);

  return (
    <div className="flex flex-1 flex-col">
      {viewerIsOwner ? (
        <p className="flex items-center gap-3 border-b border-violet-edge bg-violet-wash px-[22px] py-3 text-xs leading-[1.55] text-ink/80 sm:px-8">
          <EyeOffIcon size={17} className="shrink-0 text-violet" />
          <span>
            <strong className="font-semibold">
              You&rsquo;re previewing your own list.
            </strong>{" "}
            {list.surpriseMode
              ? "Every gift looks free to you because claims are hidden from you — that isn’t what your guests see."
              : "Surprise is off for this list, so you see the same statuses your guests do. Reserving is theirs to do."}{" "}
            <Link
              href={routes.manageList(list, ownerHandle)}
              className="font-semibold text-violet"
            >
              Back to editing
            </Link>
          </span>
        </p>
      ) : null}

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[344px_1fr]">
        {/* The context rail becomes the page header on narrow screens. */}
        <aside className="flex flex-col gap-[22px] bg-ink px-[22px] py-8 sm:px-[30px] lg:sticky lg:top-0 lg:h-screen lg:py-9">
          <div>
            <div className="mb-4 flex items-center gap-[9px]">
              <span className="text-xl">{list.emoji}</span>
              {list.eventDate ? (
                <span className="text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
                  {formatEventDate(list.eventDate)}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-[2.375rem] leading-[1.02] tracking-[-1.4px] text-paper lg:text-[2.875rem]">
              {list.name}
            </h1>
          </div>

          {list.note ? (
            <p className="text-sm leading-[1.8] text-paper-88">{list.note}</p>
          ) : null}

          <dl className="flex flex-col gap-px overflow-hidden rounded-[12px]">
            <Stat label="Still free" value={`${stats.free} of ${stats.total}`} />
            <Stat
              label="Price range"
              value={
                stats.minCents === null
                  ? "—"
                  : `${formatPrice(stats.minCents)} – ${formatPrice(stats.maxCents ?? stats.minCents)}`
              }
            />
            <Stat label="The owner can see" value={promise.ownerSees} highlight />
          </dl>

          <div className="flex flex-col gap-[10px]">
            <p className="text-2xs font-semibold uppercase tracking-[1.5px] text-paper/64">
              The coloured band means
            </p>
            {/* Lighter variants, legible against ink. */}
            <Legend color="#8A72FF" label="Most wanted" />
            <Legend color="#E85A93" label="Chip in together" />
            <Legend color="#3FBFA1" label="Already taken care of" />
          </div>

          <div className="mt-auto flex gap-[11px] border-t border-paper-line pt-6">
            <EyeOffIcon size={17} className="mt-px shrink-0 text-paper/70" />
            <p className="text-xs leading-[1.7] text-paper/84">{promise.footer}</p>
          </div>
        </aside>

        <main className="bg-paper px-[22px] py-7 sm:px-7">
          {items.length === 0 ? (
            <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-16 text-center text-sm text-ink-72">
              Nothing has been added to this list yet.
            </p>
          ) : (
            <GiftGrid
              items={items}
              handle={handle}
              listKey={slug}
              claimRule={list.claimRule}
              viewerIsOwner={viewerIsOwner}
              signedIn={signedIn}
              surpriseMode={list.surpriseMode}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between bg-paper-fill px-[15px] py-[13px] text-sm">
      <dt className="font-medium text-paper/84">{label}</dt>
      <dd className={`font-semibold ${highlight ? "text-champagne" : "text-paper"}`}>
        {value}
      </dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <p className="flex items-center gap-[10px] text-xs font-medium text-paper-88">
      <span
        className="h-1 w-[18px] rounded-pill"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </p>
  );
}
