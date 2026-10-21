import type { Metadata } from "next";
import Link from "next/link";

import { createExchange } from "@/app/secret-santa/new/actions";
import { SantaExchangeForm } from "@/components/santa-exchange-form";
import { ButtonLink, Card } from "@/components/ui";
import * as routes from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Start a Secret Santa" };

export default async function NewSecretSantaPage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-[620px] px-[22px] py-10 sm:px-7">
      <Card>
        <header className="bg-ink px-7 py-[22px]">
          <p className="mb-[7px] text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
            Secret Santa
          </p>
          <h1 className="font-display text-[1.875rem] leading-[1.1] tracking-[-.8px] text-paper">
            Start a Secret Santa
          </h1>
        </header>

        <div className="p-7">
          {user ? (
            <SantaExchangeForm
              action={createExchange}
              creating
              today={new Date().toISOString().slice(0, 10)}
            />
          ) : (
            /* Everyone else joins without one. The organiser needs an account
               because the draw button lives on their dashboard, and a cleared
               cookie mustn't strand a whole family's Secret Santa. */
            <>
              <p className="mb-2 text-base font-semibold">Organisers need an account</p>
              <p className="mb-5 text-sm leading-relaxed text-ink-76">
                It&rsquo;s where your dashboard lives, so you can always get back to it to
                draw names. Everyone you invite joins with just their name.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <ButtonLink href={routes.signUp}>Create an account</ButtonLink>
                <Link
                  href={routes.signIn}
                  className="text-sm font-semibold text-ink-72 underline-offset-2 hover:underline"
                >
                  I already have one
                </Link>
              </div>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
