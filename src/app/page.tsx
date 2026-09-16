import Link from "next/link";

import { site } from "@/config/site";

/**
 * Placeholder for screen 01. The full landing page is still to be built —
 * this exists so the create flow is reachable.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-[22px] py-16">
      <h1 className="mb-5 font-display text-[3.25rem] leading-[1.02] tracking-[-2px]">
        {site.tagline}
      </h1>
      <p className="mb-8 text-base leading-[1.75] text-ink/78">
        {site.description}
      </p>
      <Link
        href="/new"
        className="self-start rounded-pill bg-violet px-6 py-[14px] text-base font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
      >
        Start a list — it&rsquo;s free
      </Link>
    </main>
  );
}
