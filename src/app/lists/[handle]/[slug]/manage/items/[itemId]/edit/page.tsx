import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditGiftForm } from "@/components/edit-gift-form";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { items } from "@/db/schema";
import { requireOwnedList } from "@/lib/list-access";
import * as routes from "@/lib/routes";

export default async function EditItemPage({
  params,
}: PageProps<"/lists/[handle]/[slug]/manage/items/[itemId]/edit">) {
  const { handle, slug, itemId } = await params;
  const { list, ownerHandle } = await requireOwnedList(handle, slug);

  const item = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.listId, list.id)))
    .get();

  if (!item) notFound();

  return (
    <main className="mx-auto w-full max-w-[520px] px-[22px] py-10">
      <Link
        href={routes.manageList(list, ownerHandle)}
        className="mb-4 inline-block text-xs font-semibold text-violet hover:text-violet-hover"
      >
        ← {list.emoji} {list.name}
      </Link>
      <Card>
        <header className="border-b border-ink-line px-[26px] py-5">
          <h1 className="font-display text-[1.6875rem] leading-[1.1] tracking-[-.7px]">
            Edit this gift
          </h1>
        </header>
        <EditGiftForm item={item} handle={handle} listKey={slug} />
      </Card>
    </main>
  );
}
