import type { Metadata } from "next";
import Link from "next/link";

import { AddGiftForm } from "@/components/add-gift-form";
import { Card } from "@/components/ui";
import { requireOwnedList } from "@/lib/list-access";

export const metadata: Metadata = { title: "Add a gift" };

export default async function AddGiftPage({
  params,
}: PageProps<"/lists/[slug]/add">) {
  const { slug } = await params;
  const list = await requireOwnedList(slug);

  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-10">
      <Link
        href={`/lists/${slug}`}
        className="mb-4 inline-block text-[12.5px] font-semibold text-violet hover:text-violet-hover"
      >
        ← {list.emoji} {list.name}
      </Link>
      <Card>
        <AddGiftForm slug={slug} />
      </Card>
    </main>
  );
}
