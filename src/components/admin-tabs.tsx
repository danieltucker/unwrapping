"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export type AdminTab = {
  /** The route segment under /admin. */
  segment: string;
  href: string;
  label: string;
  /** Something waiting on an admin, such as open reports. Hidden at zero. */
  badge?: number;
};

/** The tab strip under /admin's heading. Client-side only to know which tab is open. */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav aria-label="Admin sections" className="mb-8 border-b border-ink-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.segment === segment;
          return (
            <li key={tab.segment}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 focus-ring ${
                  active
                    ? "border-violet text-ink"
                    : "border-transparent text-ink-62 hover:border-ink-line-strong hover:text-ink"
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className="rounded-pill bg-rose-wash px-2 py-0.5 text-2xs font-semibold text-rose">
                    {tab.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
