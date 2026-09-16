import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";

import { SharePanel } from "@/components/share-panel";
import { Card } from "@/components/ui";
import { weeksUntil } from "@/lib/date";
import { requireOwnedList } from "@/lib/list-access";
import * as routes from "@/lib/routes";

export const metadata: Metadata = { title: "Share it" };

export default async function SharePage({
  params,
}: PageProps<"/lists/[handle]/[slug]/manage/share">) {
  const { handle, slug } = await params;
  const { list, ownerHandle } = await requireOwnedList(handle, slug);

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  // The short link is the one worth pasting; the canonical URL is where it lands.
  const short = routes.shortLink(list);
  const shareUrl = `${protocol}://${host}${short ?? routes.publicList(list, ownerHandle)}`;
  const canonical = `${host}${routes.publicList(list, ownerHandle)}`;

  const qr = await QRCode.toString(shareUrl, {
    type: "svg",
    margin: 0,
    color: { dark: "#17112B", light: "#FFFFFF00" },
  });

  const weeks = weeksUntil(list.eventDate);

  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-10">
      <Card>
        <header className="bg-ink px-[26px] py-[22px]">
          <p className="mb-[7px] text-2xs font-semibold uppercase tracking-[1.6px] text-champagne">
            Step 2 of 2
          </p>
          <h1 className="font-display text-[1.875rem] leading-[1.1] tracking-[-.8px] text-paper">
            Share it
          </h1>
        </header>

        <div className="p-[26px]">
          <div className="mb-[22px]">
            <SharePanel shareUrl={shareUrl} canonical={canonical} qrSvg={qr} />
          </div>

          {weeks !== null && weeks >= 4 ? (
            <div className="mb-[22px] rounded-[12px] border border-pine/20 bg-pine-wash p-4">
              <p className="mb-[5px] text-xs font-semibold text-pine-dark">
                {weeks} weeks to go, good timing
              </p>
              <p className="text-xs leading-[1.6] text-ink/80">
                Lists shared a month or more ahead get about twice as many gifts
                claimed.
              </p>
            </div>
          ) : null}

          <Link
            href={routes.manageList(list, ownerHandle)}
            className="block rounded-pill bg-violet py-[13px] text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
          >
            Go to my list
          </Link>
        </div>
      </Card>
    </main>
  );
}
