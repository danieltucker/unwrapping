import type { Metadata } from "next";
import Link from "next/link";

import { exchangeMeta } from "@/components/santa-header";
import { ButtonLink } from "@/components/ui";
import { site } from "@/config/site";
import * as routes from "@/lib/routes";
import { myExchanges } from "@/lib/secret-santa";

export const metadata: Metadata = {
  title: "Secret Santa",
  description: `Draw names for a Secret Santa in a minute. Share one link in the group chat, everyone joins with their name, and nobody needs an email address or an app. Free on ${site.name}.`,
  // The layout keeps everything under /secret-santa out of search results;
  // this page is the one that belongs in them, and has to say so.
  robots: { index: true, follow: true },
  alternates: { canonical: routes.secretSanta },
};

const STEPS = [
  {
    title: "Start one and share the link",
    body: "Name it, set a budget and a date, and drop the invite link into the family group chat.",
  },
  {
    title: "Everyone joins with their name",
    body: "No account, no email address, no app. Each person gets a private link of their own.",
  },
  {
    title: "Draw names",
    body: "When everyone’s in, press draw. Each person opens their link to see who they’re buying for, and their wishlist.",
  },
];

export default async function SecretSantaPage({ searchParams }: PageProps<"/secret-santa">) {
  const [exchanges, { link }] = await Promise.all([myExchanges(), searchParams]);

  return (
    <main className="w-full flex-1">
      <section className="bg-ink px-[1.375rem] py-12 text-paper sm:px-8 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[52rem]">
          <p className="mb-3 text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
            Secret Santa
          </p>
          <h1 className="mb-4 max-w-[40rem] font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em] sm:text-[3.25rem]">
            Draw names without the hat
          </h1>
          <p className="mb-7 max-w-[38rem] text-base leading-[1.7] text-paper-72">
            One link in the group chat, everyone joins with their name, and each person
            finds out who they&rsquo;re buying for. Nobody else can see it, not even
            whoever organised it.
          </p>
          <ButtonLink href={routes.newSecretSanta}>Start a Secret Santa</ButtonLink>
        </div>
      </section>

      <div className="mx-auto max-w-[52rem] px-[1.375rem] py-10 sm:px-8">
        {link === "expired" ? (
          <p
            role="alert"
            className="mb-8 rounded-card border border-amber/25 bg-amber-wash px-5 py-4 text-sm leading-relaxed text-amber-dark"
          >
            <strong className="font-semibold">That private link doesn&rsquo;t work any more.</strong>{" "}
            It may have been replaced, or its person may have left. Ask whoever organised
            your Secret Santa for a new one.
          </p>
        ) : null}

        {exchanges.length > 0 ? (
          <section className="mb-12">
            <h2 className="mb-4 text-lg font-semibold tracking-[-.2px]">Your Secret Santas</h2>
            <ul className="flex flex-col gap-2.5">
              {exchanges.map(({ exchange, organizing, participating, people }) => (
                <li key={exchange.id}>
                  <Link
                    href={
                      organizing
                        ? routes.santaManage(exchange.code)
                        : routes.santaMine(exchange.code)
                    }
                    className="flex items-center gap-4 rounded-card border border-ink-line bg-surface px-5 py-4 transition-colors duration-150 hover:bg-ink/[.02]"
                  >
                    <span className="text-xl">{exchange.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold">{exchange.name}</span>
                      <span className="block text-xs text-ink-72">
                        {[
                          organizing ? (participating ? "Organising and taking part" : "Organising") : null,
                          `${people} ${people === 1 ? "person" : "people"}`,
                          exchange.status === "drawn" ? "Names drawn" : "Open to join",
                          ...exchangeMeta(exchange),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-violet">
                      {organizing ? "Manage →" : "Open →"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-[-.2px]">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-card border border-ink-line bg-surface p-5">
                <p className="mb-2 font-display text-[1.875rem] leading-none text-violet">
                  {index + 1}
                </p>
                <p className="mb-1 text-sm font-semibold">{step.title}</p>
                <p className="text-sm leading-relaxed text-ink-72">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-card border border-violet-edge bg-violet-wash p-5">
            <p className="mb-1 text-base font-semibold">Who can see who drew whom?</p>
            <p className="text-sm leading-relaxed text-ink-76">
              Only the person who drew. The organiser sees who has joined and who has
              looked, never what they saw. If someone loses their link the organiser can
              make a new one, and everyone in the group is shown that it happened.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
