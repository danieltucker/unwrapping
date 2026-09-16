import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui";
import { site } from "@/config/site";
import { db } from "@/db";
import { lists } from "@/db/schema";

/** Step 2 of the create flow: the share screen. Fuller treatment still to come. */
export default async function SharePage({ params }: PageProps<"/lists/[slug]/share">) {
  const { slug } = await params;

  const list = await db.select().from(lists).where(eq(lists.slug, slug)).get();
  if (!list) notFound();

  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-10">
      <Card>
        <header className="bg-ink px-[26px] py-[22px]">
          <p className="mb-[7px] text-[10.5px] font-semibold uppercase tracking-[1.6px] text-champagne">
            Step 2 of 2
          </p>
          <h1 className="font-display text-[30px] leading-[1.1] tracking-[-.8px] text-paper">
            Share it
          </h1>
        </header>

        <div className="p-[26px]">
          <p className="mb-[7px] text-[11px] font-semibold uppercase tracking-[.9px] text-ink-66">
            Your link
          </p>
          <div className="mb-[9px] flex items-center gap-[10px] rounded-control border border-ink-line-strong bg-surface px-[13px] py-[11px]">
            <span className="flex-1 font-mono text-[13.5px] font-medium text-ink/82">
              {site.domain}/<strong className="text-violet">{list.slug}</strong>
            </span>
          </div>
          <p className="text-[12px] text-ink-66">
            {list.emoji} {list.name} is saved. Adding gifts comes next.
          </p>
        </div>
      </Card>
    </main>
  );
}
