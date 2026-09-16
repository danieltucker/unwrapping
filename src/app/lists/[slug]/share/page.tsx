import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";

import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui";
import { requireOwnedList } from "@/lib/list-access";
import { weeksUntil } from "@/lib/date";

export const metadata: Metadata = { title: "Share it" };

/** Absolute URL of the public list, built from the request so it works in dev too. */
async function publicUrl(slug: string) {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/${slug}`;
}

export default async function SharePage({
  params,
}: PageProps<"/lists/[slug]/share">) {
  const { slug } = await params;
  const list = await requireOwnedList(slug);

  const url = await publicUrl(slug);
  const qr = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    color: { dark: "#17112B", light: "#FFFFFF00" },
  });

  const weeks = weeksUntil(list.eventDate);

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
          <div className="mb-[22px] flex items-center gap-[10px] rounded-control border border-ink-line-strong bg-surface px-[13px] py-[11px]">
            <span className="flex-1 truncate font-mono text-[13.5px] font-medium text-ink/82">
              {url.replace(/^https?:\/\//, "").replace(`/${slug}`, "/")}
              <strong className="text-violet">{slug}</strong>
            </span>
            <CopyButton value={url} />
          </div>

          <div className="mb-[22px] grid grid-cols-2 gap-[10px]">
            <div className="rounded-[12px] border border-ink-line bg-surface p-4 text-center">
              <div
                className="mx-auto mb-[10px] h-[52px] w-[52px] [&>svg]:h-full [&>svg]:w-full"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="text-[12.5px] font-semibold">QR code</p>
            </div>
            <div className="flex flex-col justify-center gap-2 rounded-[12px] border border-ink-line bg-surface p-4">
              <p className="text-[12.5px] font-semibold text-ink-62">
                Invite by email
              </p>
              <p className="text-[11.5px] leading-[1.5] text-ink-62">
                Coming later — send the link yourself for now.
              </p>
            </div>
          </div>

          {weeks !== null && weeks >= 4 ? (
            <div className="mb-[22px] rounded-[12px] border border-pine/20 bg-pine-wash p-4">
              <p className="mb-[5px] text-[12.5px] font-semibold text-pine-dark">
                {weeks} weeks to go — good timing
              </p>
              <p className="text-[12.5px] leading-[1.6] text-ink/80">
                Lists shared a month or more ahead get about twice as many gifts
                claimed.
              </p>
            </div>
          ) : null}

          <Link
            href={`/lists/${slug}`}
            className="block rounded-pill bg-violet py-[13px] text-center text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
          >
            Go to my list
          </Link>
        </div>
      </Card>
    </main>
  );
}
