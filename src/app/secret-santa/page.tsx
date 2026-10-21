import type { Metadata } from "next";
import Link from "next/link";

import { exchangeMeta } from "@/components/santa-header";
import { ButtonLink } from "@/components/ui";
import { site } from "@/config/site";
import { origin } from "@/lib/origin";
import * as routes from "@/lib/routes";
import { myExchanges } from "@/lib/secret-santa";

const TITLE = "Free Secret Santa generator: draw names online";
const DESCRIPTION = `Draw names for a Secret Santa in a minute. Share one link in the group chat, everyone joins with their name, and nobody needs an email address or an app. Free on ${site.name}.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // The layout keeps everything under /secret-santa out of search results;
  // this page is the one that belongs in them, and has to say so.
  robots: { index: true, follow: true },
  alternates: { canonical: routes.secretSanta },
  openGraph: {
    type: "website",
    title: `Secret Santa on ${site.name}`,
    description: DESCRIPTION,
    url: routes.secretSanta,
  },
};

const STEPS = [
  {
    title: "Start one and share the link",
    body: "Name it, set a budget and a date, and drop the invite link into the family group chat.",
  },
  {
    title: "Everyone joins with their name",
    body: "No account, no email address, no app. Each person gets a private link of their own, and can make a wishlist right there.",
  },
  {
    title: "Draw names and reveal",
    body: "When everyone’s in, press draw. Each person reveals who they’re buying for, sees that person’s wishlist, and can send them anonymous questions.",
  },
];

/**
 * Data rather than markup, for the same reason as the homepage's: the answers
 * are also handed to search engines, so one copy keeps them from drifting.
 * Only promise what exists — see "Landing-page copy" in the README.
 */
const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: "Does everyone need an account?",
    answer:
      "Only whoever organises it, so the draw button can’t be lost with a cleared browser. Everyone else joins with just their name.",
  },
  {
    question: "Can the organiser see who got whom?",
    answer:
      "No. The organiser sees who has joined and who has looked, never what they saw. Each person sees their own name and nobody else’s.",
  },
  {
    question: "Do you email or text anyone?",
    answer:
      "No. You share the invite link wherever your group already talks, and each person keeps their own private link. We never ask for an email address or phone number to take part.",
  },
  {
    question: "What if someone loses their link?",
    answer:
      "The organiser can make them a new one, and the old one stops working. Everyone in the group is shown that it happened, because whoever holds the new link could open that person’s page.",
  },
  {
    question: "Can couples avoid drawing each other?",
    answer:
      "Yes. The organiser can keep any pair apart before drawing. If the pairs make a draw impossible, it says so rather than guessing.",
  },
  {
    question: "Someone joined late or dropped out. Now what?",
    answer:
      "The organiser resets the draw, adjusts who’s in, and draws again. Anyone who had already looked is told their person may have changed.",
  },
  {
    question: "Can I ask my person what they want without giving myself away?",
    answer:
      "Yes. Each pair has an anonymous thread: you see their name, they see “Your Santa”. Either of you can report a message to the site’s operator.",
  },
  {
    question: "How much does it cost?",
    answer: `Nothing. ${site.name} is free, and so is every Secret Santa on it.`,
  },
];

export default async function SecretSantaPage({ searchParams }: PageProps<"/secret-santa">) {
  const [exchanges, { link }] = await Promise.all([myExchanges(), searchParams]);

  return (
    <main className="w-full flex-1">
      <StructuredData />

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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <ButtonLink href={routes.newSecretSanta}>Create a Secret Santa</ButtonLink>
            <a
              href="#how-it-works"
              className="text-sm font-semibold text-paper underline-offset-2 hover:underline"
            >
              How it works
            </a>
          </div>
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
          <section className="mb-12" aria-labelledby="yours">
            <h2 id="yours" className="mb-4 text-lg font-semibold tracking-[-.2px]">
              Your Secret Santas
            </h2>
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
                    <span className="text-xl" aria-hidden="true">
                      {exchange.emoji}
                    </span>
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
                    <span className="text-xs font-semibold text-violet" aria-hidden="true">
                      {organizing ? "Manage →" : "Open →"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="how-it-works" className="scroll-mt-6" aria-labelledby="how">
          <h2 id="how" className="mb-4 text-lg font-semibold tracking-[-.2px]">
            How it works
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-card border border-ink-line bg-surface p-5">
                <p className="mb-2 font-display text-[1.875rem] leading-none text-violet" aria-hidden="true">
                  {index + 1}
                </p>
                <h3 className="mb-1 text-sm font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-72">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="mb-5 text-lg font-semibold tracking-[-.2px]">
            Questions people ask
          </h2>
          <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {QUESTIONS.map((entry) => (
              <div key={entry.question}>
                <dt className="mb-[7px] text-base font-semibold">{entry.question}</dt>
                <dd className="text-sm leading-[1.7] text-ink-76">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 rounded-card border border-violet-edge bg-violet-wash p-6 text-center">
          <p className="mb-1 text-base font-semibold">Ready when your group is</p>
          <p className="mb-4 text-sm text-ink-76">Free, no app, and about a minute to set up.</p>
          <ButtonLink href={routes.newSecretSanta}>Create a Secret Santa</ButtonLink>
        </section>
      </div>
    </main>
  );
}

/**
 * The FAQ as FAQPage and the three steps as HowTo, built from the constants
 * above so the structured data can't claim anything the page doesn't say.
 */
function StructuredData() {
  const url = `${origin}${routes.secretSanta}`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { "@type": "WebSite", name: site.name, url: `${origin}/` },
      },
      {
        "@type": "HowTo",
        name: "How to draw names for a Secret Santa online",
        totalTime: "PT2M",
        estimatedCost: { "@type": "MonetaryAmount", currency: site.currency, value: "0" },
        step: STEPS.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.title,
          text: step.body,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: QUESTIONS.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: { "@type": "Answer", text: entry.answer },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Built from our own constants, so there is no untrusted input here. The
      // escape is for the one character that could close the tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}
