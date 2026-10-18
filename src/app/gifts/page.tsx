import type { Metadata } from "next";

import { BrowseBanner, CategoryChips, MakeOneCta } from "@/components/gift-browse";
import { GuideGrid, GuideTile } from "@/components/guide-tile";
import { site } from "@/config/site";
import { allCategories, publishedGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Gift lists for every kind of person",
  description: `Gift ideas picked by people who know: for gamers, campers, cooks and more. Buy straight from a list or copy it to start your own on ${site.name}.`,
  alternates: { canonical: "/gifts" },
};

/**
 * Every published gift guide, most copied first, with the categories along
 * the top. One of the few pages search engines are let into; see robots.ts.
 */
export default async function GiftGuidesPage() {
  const [categories, popular, newest] = await Promise.all([
    allCategories(),
    publishedGuides({ order: "popular", limit: 12 }),
    publishedGuides({ order: "newest", limit: 18 }),
  ]);

  // "Just added" is only worth a section for what the popular grid didn't show.
  const shown = new Set(popular.map((guide) => guide.id));
  const fresh = newest.filter((guide) => !shown.has(guide.id)).slice(0, 6);

  return (
    <main className="w-full flex-1">
      <BrowseBanner
        eyebrow="Gift lists"
        title="Gift ideas for every kind of person"
        intro="Lists of presents picked by people who know: what to get a gamer, a camper, a cook. Buy straight from one, add a gift to your own list, or copy the whole thing and make it yours."
      />

      <div className="mx-auto max-w-[72rem] px-[1.375rem] py-10 sm:px-8 lg:px-10">
        <CategoryChips categories={categories} />

        {popular.length === 0 ? (
          <p className="mt-8 rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center text-sm text-ink-72">
            No gift lists have been published yet. Yours could be the first.
          </p>
        ) : (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold tracking-[-.2px]">Popular gift lists</h2>
            <GuideGrid>
              {popular.map((guide) => (
                <GuideTile key={guide.id} guide={guide} />
              ))}
            </GuideGrid>
          </section>
        )}

        {fresh.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold tracking-[-.2px]">Just added</h2>
            <GuideGrid>
              {fresh.map((guide) => (
                <GuideTile key={guide.id} guide={guide} />
              ))}
            </GuideGrid>
          </section>
        ) : null}

        <MakeOneCta />
      </div>
    </main>
  );
}
