import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";
import { db } from "@/db";
import { items, lists } from "@/db/schema";
import { getCurrentUser, readDraftToken } from "@/lib/session";

export const metadata: Metadata = { title: "Save your list" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/");

  // "You've added four gifts already": the reason to bother signing up.
  const draftToken = await readDraftToken();
  let giftCount = 0;

  if (draftToken) {
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .innerJoin(lists, eq(lists.id, items.listId))
      .where(eq(lists.draftToken, draftToken))
      .get();
    giftCount = row?.count ?? 0;
  }

  return (
    <main className="mx-auto w-full max-w-[560px] px-[22px] py-10">
      <Card>
        <SignUpForm giftCount={giftCount} />
      </Card>
      <p className="mt-4 text-center text-xs leading-[1.6] text-ink-62">
        We don&rsquo;t email you unless you ask us to.
      </p>
    </main>
  );
}
