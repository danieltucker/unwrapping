import type { ReactNode } from "react";

import { ButtonLink, EyeOffIcon } from "@/components/ui";
import { formatPrice, listUrl, site } from "@/config/site";
import * as routes from "@/lib/routes";

/**
 * Screen 01: the landing page. Its whole job is to turn a first-time visitor
 * into a list, so there is exactly one destination: /new.
 *
 * The hero is two full-bleed panels rather than a centred column: the left
 * makes the pitch, the right shows the product keeping its promise. Widths are
 * capped by the content (a 32.5rem headline, a 28rem paragraph) instead of by a
 * page shell, so the ink panel can run to the edge of the window.
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[120rem] flex-1">
      <Hero />
      <HowItWorks />
    </main>
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

        <p className="mb-[1.875rem] max-w-[28.125rem] text-base leading-[1.75] text-ink/78">
          {site.description}
        </p>

        <div className="mb-[1.125rem] flex flex-wrap items-center gap-3">
          <ButtonLink href={routes.newList}>
            Start a list &mdash; it&rsquo;s free
          </ButtonLink>
          {/* The design pairs the primary with "See an example". There is no
              demo list to point at yet, so the second button goes to the
              explanation directly below rather than nowhere. */}
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

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-t border-ink-line px-[1.375rem] py-11 sm:px-8 lg:px-10"
    >
      <h2 className="sr-only">How it works</h2>
      <ol className="grid gap-[1.875rem] sm:grid-cols-2 lg:grid-cols-3">
        <Step number="01" title="Paste links as you shop">
          Photo, title and price arrive on their own. Or write an item in by
          hand &mdash; a jar of good olive oil doesn&rsquo;t need a URL.
        </Step>
        <Step number="02" title="Send one link">
          No accounts for guests, no app. Works from a text message, an
          invitation, or a QR code on the fridge.
        </Step>
        <Step number="03" title="Nobody doubles up">
          Claimed gifts grey out for everyone else, instantly. Expensive things
          can be split between several people.
        </Step>
      </ol>
    </section>
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
