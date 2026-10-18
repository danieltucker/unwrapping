import type { Metadata } from "next";

import { CreateGuideForm } from "@/components/create-guide-form";
import { ButtonLink, Card } from "@/components/ui";
import { allCategories } from "@/lib/guides";
import * as routes from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Make a gift list",
  robots: { index: false, follow: true },
};

/**
 * Starting a gift guide. Signed-out visitors are told why an account comes
 * first rather than bounced to a sign-in form with no explanation; see
 * createGiftGuide.
 */
export default async function NewGiftGuidePage() {
  const user = await getCurrentUser();
  const categories = user ? await allCategories() : [];

  return (
    <main className="mx-auto w-full max-w-[620px] px-[22px] py-10 sm:px-7">
      <Card>
        <header className="bg-ink px-7 py-[22px]">
          <p className="mb-[7px] text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
            A gift list for anyone
          </p>
          <h1 className="font-display text-[1.875rem] leading-[1.1] tracking-[-.8px] text-paper">
            Share what makes a great gift
          </h1>
        </header>

        {user ? (
          <>
            <p className="px-7 pt-6 text-sm leading-[1.7] text-ink-76">
              Not a wishlist for yourself: a list of the presents you&rsquo;d
              recommend for a kind of person. Anyone can browse it, buy from it,
              or copy it to start a list of their own.
            </p>
            <CreateGuideForm
              categories={categories.map(({ id, name, emoji }) => ({ id, name, emoji }))}
            />
          </>
        ) : (
          <div className="p-7">
            <p className="mb-5 text-sm leading-[1.7] text-ink-76">
              Gift lists go on a public page with your name on them, so they
              need an account. It&rsquo;s free and takes a minute. Wishlists
              for yourself still don&rsquo;t.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href={routes.signUp}>Create an account</ButtonLink>
              <ButtonLink href={routes.signIn} variant="outline">
                Sign in
              </ButtonLink>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
