import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  BoxIcon,
  ButtonLink,
  EyeOffIcon,
  LinkIcon,
  PencilIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui";
import { formatPrice, listUrl, occasions, site } from "@/config/site";
import { origin } from "@/lib/origin";
import * as routes from "@/lib/routes";

/**
 * Screen 01: the landing page. Its whole job is to turn a first-time visitor
 * into a list, so every section ends up pointing at /new.
 *
 * It is also the only page search engines are allowed to index (a gift list is
 * nobody's business but its guests'), which is why the explaining happens here
 * rather than on an about page: the occasions, what can go on a list, and the
 * questions people ask before trusting a party to a website they don't know.
 *
 * The hero is two full-bleed panels rather than a centred column: the left
 * makes the pitch, the right shows the product keeping its promise. Widths are
 * capped by the content (a 32.5rem headline, a 29rem paragraph) instead of by a
 * page shell, so the ink panel can run to the edge of the window.
 */

export const metadata: Metadata = {
  // The one page where the title should carry the words people search for
  // rather than the tagline. Absolute, so it escapes the layout's template.
  title: { absolute: `${site.name}: ${site.searchTitle}` },
  description: site.description,
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[120rem] flex-1">
      <Hero />
      <HowItWorks />
      <Occasions />
      <WhatGoesOn />
      <Questions />
      <ClosingCta />
      <StructuredData />
    </main>
  );
}

/**
 * Shared section chrome: the heading, the optional line under it, and the
 * rhythm between them. Six sections can't drift apart by a few pixels if they
 * all come from here.
 */
function Section({
  id,
  heading,
  intro,
  children,
  tone = "paper",
}: {
  id?: string;
  heading: string;
  intro?: ReactNode;
  children: ReactNode;
  tone?: "paper" | "ink";
}) {
  const ink = tone === "ink";

  return (
    <section
      id={id}
      className={`scroll-mt-16 border-t px-[1.375rem] py-12 sm:px-8 lg:px-10 ${
        ink ? "border-ink bg-ink text-paper" : "border-ink-line"
      }`}
    >
      <div className="mb-8 max-w-[38rem]">
        <h2
          className={`font-display text-[2rem] leading-[1.1] tracking-[-0.025em] sm:text-[2.375rem] ${
            ink ? "text-paper" : ""
          }`}
        >
          {heading}
        </h2>
        {intro ? (
          <p
            className={`mt-3 text-base leading-[1.7] ${
              ink ? "text-paper-72" : "text-ink-76"
            }`}
          >
            {intro}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Hero() {
  return (
    <section className="grid items-stretch lg:grid-cols-[1.06fr_1fr]">
      <div className="px-[1.375rem] py-14 sm:px-8 lg:px-10 lg:pb-[3.75rem] lg:pt-[4.125rem]">
        {/* Pine dot, because the claim is about availability, not action. */}
        <p className="mb-[1.625rem] inline-flex items-center gap-2 rounded-pill border border-ink-line-strong px-[13px] py-1.5 text-xs font-medium text-ink-76">
          <span className="h-1.5 w-1.5 rounded-pill bg-pine" aria-hidden="true" />
          Free for lists of any size
        </p>

        <h1 className="mb-[1.375rem] max-w-[32.5rem] font-display text-[2.75rem] leading-[1.02] tracking-[-0.032em] sm:text-[3.875rem]">
          {site.tagline}
        </h1>

        <p className="mb-[1.875rem] max-w-[29rem] text-base leading-[1.75] text-ink/78">
          {site.summary}
        </p>

        <div className="mb-[1.125rem] flex flex-wrap items-center gap-3">
          <ButtonLink href={routes.newList}>
            Start a list, it&rsquo;s free
          </ButtonLink>
          {/* The design pairs the primary with "See an example". There is no
              demo list to point at yet, so the second button goes to the
              instructions directly below rather than nowhere. */}
          <ButtonLink href="#how-it-works" variant="outline">
            See how it works
          </ButtonLink>
        </div>

        <p className="text-sm text-ink-66">
          No card needed. Takes about two minutes.
        </p>

        <dl className="mt-[2.875rem] flex flex-wrap gap-x-[1.875rem] gap-y-5 border-t border-ink-line pt-[1.625rem]">
          <Stat figure="2 min" label="to a shareable list" />
          <Stat figure="Any shop" label="links fill themselves in" />
          <Stat figure="Zero" label="spoilers for you" />
        </dl>
      </div>

      <ListPreview />
    </section>
  );
}

function Stat({ figure, label }: { figure: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-[1.875rem]">{figure}</span>
        <span className="mt-0.5 block text-xs font-medium text-ink/68">
          {label}
        </span>
      </dd>
    </div>
  );
}

/**
 * The ink half: a list as a guest would see it, with the promise underneath.
 * Everything here is illustration; it is the only list in the product that
 * nobody owns, so it is written out literally rather than queried.
 */
function ListPreview() {
  return (
    <div className="relative flex flex-col justify-center gap-[1.125rem] overflow-hidden bg-ink px-[1.375rem] py-[2.875rem] sm:px-8 lg:px-10">
      {/* The only ornament in the design: two hairline circles bleeding off. */}
      <span
        className="pointer-events-none absolute -right-[150px] -top-[140px] h-[420px] w-[420px] rounded-pill border border-paper/12"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -bottom-[120px] -left-[110px] h-[300px] w-[300px] rounded-pill border border-paper/10"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[26rem] overflow-hidden rounded-card bg-paper shadow-float">
        <div className="flex items-center gap-2.5 border-b border-ink-line px-4 py-[13px]">
          <span aria-hidden="true">🎂</span>
          <span className="text-sm font-semibold">Maya turns 30</span>
          <span className="ml-auto text-xs font-medium text-ink-62">
            {listUrl("maya-30")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3.5">
          <PreviewGift
            emoji="☕"
            title="Pour-over set"
            priceCents={6800}
            band="bg-violet"
          />
          <PreviewGift
            emoji="🫖"
            title="Espresso pot"
            priceCents={5200}
            band="bg-pine"
            claimed
          />
        </div>
      </div>

      <p className="relative mx-auto flex w-full max-w-[26rem] items-center gap-[11px] rounded-[12px] border border-paper-line bg-paper-fill px-4 py-3.5 text-sm leading-[1.6] text-paper/90">
        <EyeOffIcon className="shrink-0 text-champagne" />
        <span>
          <strong className="font-semibold text-champagne">
            The surprise stays intact.
          </strong>{" "}
          Guests see what&rsquo;s already taken. You only ever see a count.
        </span>
      </p>
    </div>
  );
}

/**
 * A gift the way the public list draws one: photo area, the 4px status band
 * that carries the state, then the title. Real cards use a photo; these stand
 * in with the list's own emoji vocabulary rather than an empty-photo tile,
 * which would advertise the one state nobody wants.
 */
function PreviewGift({
  emoji,
  title,
  priceCents,
  band,
  claimed = false,
}: {
  emoji: string;
  title: string;
  priceCents: number;
  band: string;
  claimed?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-ink-line ${
        claimed ? "bg-ink/[.03]" : ""
      }`}
    >
      <div
        className="flex h-[112px] items-center justify-center bg-ink/[.035] text-[2rem]"
        aria-hidden="true"
      >
        {emoji}
      </div>
      <div className={`h-[3px] ${band}`} aria-hidden="true" />
      <div className="px-[11px] py-2.5">
        <p
          className={`mb-[3px] text-xs font-semibold ${
            claimed ? "text-ink/58" : ""
          }`}
        >
          {title}
        </p>
        {claimed ? (
          <p className="text-xs font-semibold text-pine">&#10003; Claimed</p>
        ) : (
          <p className="text-xs font-semibold text-ink/68">
            {formatPrice(priceCents)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The instructions. Four steps rather than three, because the first thing an
 * owner actually does is name the occasion, and the heading is visible now: a
 * screen-reader-only "How it works" left the busiest section of the page
 * looking like three unexplained paragraphs to everyone else.
 */
function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      heading="How it works"
      intro="Four steps, and only the first needs you at a keyboard. Nothing to install, and nobody has to make an account to use the list you send them."
    >
      <ol className="grid gap-[1.875rem] sm:grid-cols-2 lg:grid-cols-4">
        <Step number="01" title="Name the occasion">
          &ldquo;Maya turns 30&rdquo;, &ldquo;Our wedding&rdquo;, whatever you
          call it out loud. Add the date if there is one. You can start without
          signing up and save the list afterwards.
        </Step>
        <Step number="02" title="Paste links as you shop">
          Photo, title and price arrive on their own. Or write an item in by
          hand: a jar of good olive oil doesn&rsquo;t need a URL. Say why you
          want something, and star the one you&rsquo;d pick first.
        </Step>
        <Step number="03" title="Send one link">
          You get a short link and a QR code. Text it, put it in the invitation,
          or stick it on the fridge. Guests open it and see the list. No
          account, no app, no password.
        </Step>
        <Step number="04" title="Nobody doubles up">
          A claimed gift greys out for everyone else, instantly. Expensive
          things can be split between several people. You see how many gifts are
          taken, never which, and never by whom.
        </Step>
      </ol>
    </Section>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="max-w-[34rem]">
      <p className="mb-2.5 font-display text-2xl text-ink/30" aria-hidden="true">
        {number}
      </p>
      <h3 className="mb-[7px] text-base font-semibold">{title}</h3>
      <p className="text-sm leading-[1.7] text-ink-76">{children}</p>
    </li>
  );
}

/**
 * The occasions, as links rather than decoration: each starts a list with the
 * name already in the box, which is the shortest path there is from "this is
 * for me" to a real list. The words are also how people search for this.
 */
function Occasions() {
  return (
    <Section
      heading="One list, any occasion"
      intro="Unwrap doesn’t mind what you’re celebrating. Pick the nearest one to start with the name filled in, or write your own."
    >
      <ul className="flex flex-wrap gap-2.5">
        {occasions.map((occasion) => (
          <li key={occasion.label}>
            <Link
              href={`${routes.newList}?for=${encodeURIComponent(occasion.prefill)}`}
              className="inline-flex items-center gap-2 rounded-pill border border-ink-line-strong bg-surface px-4 py-2.5 text-sm font-semibold transition-colors duration-150 hover:border-violet hover:bg-violet-wash"
            >
              <span aria-hidden="true">{occasion.emoji}</span>
              {occasion.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-[42rem] text-sm leading-[1.7] text-ink-66">
        It works just as well for the occasions with no ceremony attached: a new
        baby, a kid&rsquo;s party, moving in together, a big birthday someone
        else is organising, Mother&rsquo;s Day, Father&rsquo;s Day, a leaving
        do, or a travel fund you&rsquo;d rather have than more things.
      </p>
    </Section>
  );
}

/** What can actually go on a list, since "wishlist" makes people think links only. */
function WhatGoesOn() {
  return (
    <Section
      heading="What can go on a list"
      intro="Gifts, and also the things that are awkward to ask for out loud: money, one expensive present split between people, and the address it all has to arrive at."
    >
      <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        <Feature icon={<LinkIcon size={18} />} title="Anything with a link">
          Paste a product URL from any shop and the photo, title and price fill
          themselves in. Unflattering photo, or no price on the page? Fix it in
          a second. Guests reach the shop straight from the card.
        </Feature>
        <Feature icon={<PencilIcon size={18} />} title="Things with no link">
          Write it in by hand and give it an emoji. Good olive oil, a day of
          babysitting, help stripping the wallpaper, a plant from the market.
        </Feature>
        <Feature icon={<WalletIcon size={18} />} title="Money, asked for nicely">
          Add a cash gift with an amount in mind and guests chip in what they
          want. They see how you&rsquo;d like it sent. Unwrap never touches the
          money and takes no cut.
        </Feature>
        <Feature icon={<UsersIcon size={18} />} title="One big gift, split">
          Put a goal on a gift and several people can go in together, each for
          what they can afford. Everyone sees how close it is, so the last one
          in knows what&rsquo;s left without having to ask around.
        </Feature>
        <Feature icon={<BoxIcon size={18} />} title="Where to send it">
          Add a delivery address once and it reaches only the guests who have
          claimed something. Nobody has to ask you for it, which is usually how
          a surprise gets spoiled.
        </Feature>
        <Feature icon={<EyeOffIcon size={18} />} title="A surprise, or not">
          A birthday keeps the blindfold on: you see a count and nothing else.
          For a wedding registry, turn surprise off and you&rsquo;ll see
          what&rsquo;s taken. Who took it stays private either way.
        </Feature>
      </ul>
    </Section>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="max-w-[30rem]">
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-control border border-violet-edge bg-violet-wash text-violet">
        {icon}
      </span>
      <h3 className="mb-[7px] text-base font-semibold">{title}</h3>
      <p className="text-sm leading-[1.7] text-ink-76">{children}</p>
    </li>
  );
}

/**
 * The questions people ask before trusting a party to a website they have
 * never heard of. Data rather than markup, because the same answers are handed
 * to search engines as FAQPage below, and two copies would drift apart.
 *
 * Nothing here may promise something the product doesn't do yet. Email
 * invitations and card payments are not built; see README.
 */
const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: "Do my guests need an account?",
    answer:
      "No. They open your link, see the list, and reserve what they’re buying. No password, no app, no email address. Signing in is optional, and only exists so that a guest’s reservations follow them to another device.",
  },
  {
    question: "Will I find out who bought what?",
    answer:
      "Not on a surprise list. You see how many gifts are taken and how much has been chipped in, never which gifts or which people. It isn’t a setting we hope you don’t change: the server refuses to hand you your own list’s claims.",
  },
  {
    question: "What if we want to see what has been taken, like a wedding registry?",
    answer:
      "Turn surprise off when you create the list, or later in its settings. Then you can see which gifts are taken and what is still needed. Who took each one stays private in both modes.",
  },
  {
    question: "Which shops can I add gifts from?",
    answer:
      "Any site with a product page. Paste the link and we read the photo, title and price off the page itself. When a shop hides its price or offers only a bad photo, edit the gift yourself. Gifts with no link at all get written in by hand.",
  },
  {
    question: "Can several people share one expensive gift?",
    answer:
      "Yes. Put a goal on a gift and guests chip in whatever they want towards it. Everyone sees how far it has got, so nobody has to run the collection by group chat.",
  },
  {
    question: "Can I ask for money instead of things?",
    answer:
      "Yes, add a cash gift: a honeymoon, a new kitchen, or a fund with no particular plan. Guests who chip in see the payment details you have given. The money goes straight to you, and Unwrap takes no cut.",
  },
  {
    question: "How do I share the list?",
    answer:
      "You get a short link that is easy to read out, and a QR code you can print. Paste it into a message, a group chat, or the invitation itself. Anyone who has the link can open the list.",
  },
  {
    question: "Can I change the list after I have shared it?",
    answer:
      "Yes. Add gifts, reorder them, fix prices, move the date, all without breaking the link you sent. Gifts that guests have already claimed keep their claims.",
  },
  {
    question: "Is it really free?",
    answer:
      "Yes. Any number of gifts, any number of guests, no card and no trial. There is nothing to cancel afterwards.",
  },
];

function Questions() {
  return (
    <Section id="questions" heading="Questions people ask first">
      <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {QUESTIONS.map((entry) => (
          <div key={entry.question} className="max-w-[34rem]">
            <dt className="mb-[7px] text-base font-semibold">{entry.question}</dt>
            <dd className="text-sm leading-[1.7] text-ink-76">{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** The bottom of the page is the last chance to ask, so it asks plainly. */
function ClosingCta() {
  return (
    <Section
      heading="Start your list"
      intro="Name it, paste a couple of links, and send it to one person to see how it feels. Nothing is listed publicly, and nothing is final."
      tone="ink"
    >
      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink href={routes.newList}>
          Start a list, it&rsquo;s free
        </ButtonLink>
        <p className="text-sm text-paper-72">
          Free, no card, about two minutes.
        </p>
      </div>
    </Section>
  );
}

/**
 * Schema.org data for the two things this page is: a piece of software, and a
 * set of answers. The FAQ half is what earns an expanded search result, and it
 * is generated from QUESTIONS so it cannot claim anything the page doesn't say.
 */
function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: site.name,
        url: `${origin}/`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Any web browser",
        description: site.description,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: site.currency,
        },
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
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
      }}
    />
  );
}
