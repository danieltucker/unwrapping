import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrowseBanner, CategoryChips, MakeOneCta } from "@/components/gift-browse";
import { GuideGrid, GuideTile } from "@/components/guide-tile";
import { site } from "@/config/site";
import { allCategories, categoryBySlug, publishedGuides } from "@/lib/guides";
import * as routes from "@/lib/routes";

export async function generateMetadata({
  params,
}: PageProps<"/gifts/[category]">): Promise<Metadata> {
  const category = await categoryBySlug((await params).category);
  if (!category) return {};

  return {
    title: `${category.name} gift ideas`,
    description:
      category.description ||
      `Gift lists for ${category.name.toLowerCase()}, picked by people who know, on ${site.name}.`,
    alternates: { canonical: routes.giftCategory(category.slug) },
  };
}

/** One shelf of /gifts: every published guide filed under this category. */
export default async function GiftCategoryPage({ params }: PageProps<"/gifts/[category]">) {
  const category = await categoryBySlug((await params).category);
  if (!category) notFound();

  const [categories, guides] = await Promise.all([
    allCategories(),
    publishedGuides({ categoryId: category.id, limit: 60 }),
  ]);

  return (
    <main className="w-full flex-1">
      <BrowseBanner
        eyebrow={`${category.emoji} Gift lists`}
        title={`${category.name} gift ideas`}
        intro={
          category.description ||
          "Lists of presents picked by people who know. Buy straight from one, or copy it to start a list of your own."
        }
      />

      <div className="mx-auto max-w-[72rem] px-[1.375rem] py-10 sm:px-8 lg:px-10">
        <CategoryChips categories={categories} current={category.slug} />

        {guides.length === 0 ? (
          <p className="mt-8 rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center text-sm text-ink-72">
            Nothing on this shelf yet. Make the first {category.name.toLowerCase()} gift list.
          </p>
        ) : (
          <div className="mt-8">
            <GuideGrid>
              {guides.map((guide) => (
                <GuideTile key={guide.id} guide={guide} showCategory={false} surface="category" />
              ))}
            </GuideGrid>
          </div>
        )}

        <MakeOneCta />
      </div>
    </main>
  );
}
