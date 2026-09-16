import type { Metadata } from "next";
import Link from "next/link";

import { AddGiftForm } from "@/components/add-gift-form";
import { Card } from "@/components/ui";
import { requireOwnedList } from "@/lib/list-access";
import * as routes from "@/lib/routes";

export const metadata: Metadata = { title: "Add a gift" };

export default async function AddGiftPage({
  params,
}: PageProps<"/lists/[handle]/[slug]/manage/add">) {
  const { handle, slug } = await params;
  const { list, ownerHandle } = await requireOwnedList(handle, slug);

  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-10">
      <Link
        href={routes.manageList(list, ownerHandle)}
        className="mb-4 inline-block text-xs font-semibold text-violet hover:text-violet-hover"
      >
        ← {list.emoji} {list.name}
      </Link>
      <Card>
        <AddGiftForm
          handle={handle}
          listKey={slug}
          addPath={routes.addGift(list, ownerHandle)}
        />
      </Card>
    </main>
  );
}
