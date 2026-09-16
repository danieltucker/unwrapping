import type { Metadata } from "next";

import { CreateListForm } from "@/components/create-list-form";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Name your list" };

export default function NewListPage() {
  return (
    <main className="mx-auto w-full max-w-[620px] px-[22px] py-10 sm:px-7">
      <Card>
        <header className="flex items-center justify-between bg-ink px-7 py-[22px]">
          <div>
            <p className="mb-[7px] text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
              Step 1 of 2
            </p>
            <h1 className="font-display text-[1.875rem] leading-[1.1] tracking-[-.8px] text-paper">
              Name your list
            </h1>
          </div>
          <div className="flex items-center gap-[5px]" aria-hidden="true">
            <span className="h-[3px] w-[26px] rounded-pill bg-champagne" />
            <span className="h-[3px] w-[26px] rounded-pill bg-paper/28" />
          </div>
        </header>
        <CreateListForm today={new Date().toISOString().slice(0, 10)} />
      </Card>
    </main>
  );
}
