import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrowseBanner, CategoryChips, MakeOneCta } from "@/components/gift-browse";
import { GuideGrid, GuideTile } from "@/components/guide-tile";
import { PriceFilterBar } from "@/components/price-filter-bar";
import { site } from "@/config/site";
import { allCategories, categoryBySlug, publishedGuides } from "@/lib/guides";
import { isPriceFilterActive, parsePriceFilter } from "@/lib/price";
import { priceFilterEnabled } from "@/lib/price-filter-flag";
import * as routes from "@/lib/routes";
import { parseShelfSort, shelfSortControl } from "@/lib/sort";
import { giftSortEnabled } from "@/lib/sort-flag";

/** As many guides as one shelf shows. */
const SHELF_SIZE = 60;

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
    // A filtered or sorted shelf is the same shelf: every ?min=&max=&sort=
    // points search engines back here rather than competing with it.
    alternates: { canonical: routes.giftCategory(category.slug) },
  };
}

/**
 * One shelf of /gifts: every published guide filed under this category.
 *
 * The price filter keeps a guide when at least one of its presents is in the
 * range, and the tile says how many, so someone shopping to a budget lands on
 * lists that have something for them. Filtered on the server from the
 * address, like a list's own filter; see PriceFilterBar.
 *
 * ?sort= orders the shelf: most popular by default, or by price, newest or
 * name. The price sorts go by each list's cheapest present in the range; see
 * publishedGuides, which sorts before it cuts the shelf to SHELF_SIZE.
 */
export default async function GiftCategoryPage({
  params,
  searchParams,
}: PageProps<"/gifts/[category]">) {
  const category = await categoryBySlug((await params).category);
  if (!category) notFound();

  const query = await searchParams;
  const price = priceFilterEnabled() ? parsePriceFilter(query) : null;
  const filtering = price !== null && isPriceFilterActive(price);
  // Null while GIFT_SORT is off: popular first, as it always was.
  const sort = giftSortEnabled() ? parseShelfSort(query) : null;
  const order = sort ?? "popular";

  const [categories, everything, guides] = await Promise.all([
    allCategories(),
    publishedGuides({ categoryId: category.id, limit: SHELF_SIZE, order }),
    // The unfiltered shelf is the "of N" in the count; only read twice when
    // there is a filter to compare it with.
    filtering
      ? publishedGuides({ categoryId: category.id, limit: SHELF_SIZE, price, order })
      : null,
  ]);
  const shown = guides ?? everything;
  const path = routes.giftCategory(category.slug);
  const sortControl = sort && everything.length > 1 ? shelfSortControl(sort) : null;

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

        {(price || sortControl) && everything.length > 0 ? (
          <div className="mt-8">
            <PriceFilterBar
              path={path}
              filter={price}
              sort={sortControl}
              shown={shown.length}
              total={everything.length}
              noun={["gift list", "gift lists"]}
            />
          </div>
        ) : null}

        {everything.length === 0 ? (
          <p className="mt-8 rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center text-sm text-ink-72">
            Nothing on this shelf yet. Make the first {category.name.toLowerCase()} gift list.
          </p>
        ) : shown.length === 0 ? (
          <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-14 text-center text-sm text-ink-72">
            None of these lists has a gift in that price range yet. Try a wider one, or clear the filter.
          </p>
        ) : (
          <div className={price || sortControl ? undefined : "mt-8"}>
            <GuideGrid>
              {shown.map((guide) => (
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
