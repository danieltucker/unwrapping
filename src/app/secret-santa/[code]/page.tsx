import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { joinExchange } from "@/app/secret-santa/[code]/actions";
import { SantaJoinForm } from "@/components/santa-controls";
import { SantaCardHeader, SantaNote } from "@/components/santa-header";
import { Card } from "@/components/ui";
import { formatPrice, site } from "@/config/site";
import * as routes from "@/lib/routes";
import { currentParticipant, exchangeParticipants, resolveExchange } from "@/lib/secret-santa";
import { getCurrentUser } from "@/lib/session";

/**
 * What the link says when it's pasted: the group, how many are in, and the
 * budget. No names — not the organiser's, not anyone who has joined — because
 * an invite travels further than the group it was meant for.
 */
export async function generateMetadata({
  params,
}: PageProps<"/secret-santa/[code]">): Promise<Metadata> {
  const resolved = await resolveExchange((await params).code);
  if (!resolved) return { title: "Secret Santa" };

  const { exchange } = resolved;
  const people = (await exchangeParticipants(exchange.id)).length;
  const budget = exchange.budgetCents !== null ? `, ${formatPrice(exchange.budgetCents)} each` : "";
  const description = `A Secret Santa with ${people} ${people === 1 ? "person" : "people"} in so far${budget}. Join with just your name on ${site.name}.`;
  const title = `Join ${exchange.emoji} ${exchange.name}`;

  return {
    title,
    description,
    openGraph: { type: "website", title, description, siteName: site.name },
  };
}

/**
 * The invite link. Anyone holding it may join while names are still to be
 * drawn; somebody who has already joined in this browser is sent straight on
 * to their own page, so this page is only ever shown to people who aren't in.
 */
export default async function SantaInvitePage({ params }: PageProps<"/secret-santa/[code]">) {
  const { code } = await params;
  const resolved = await resolveExchange(code);
  if (!resolved) notFound();

  const { exchange } = resolved;
  if (await currentParticipant(exchange)) redirect(routes.santaMine(code));

  const [people, user] = await Promise.all([exchangeParticipants(exchange.id), getCurrentUser()]);
  const organizing = user?.id === exchange.organizerId;

  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-10">
      <Card>
        <SantaCardHeader exchange={exchange} eyebrow="You're invited to a Secret Santa">
          <p className="mt-3 text-xs font-semibold text-paper-88">
            {people.length} {people.length === 1 ? "person" : "people"} in so far
          </p>
        </SantaCardHeader>

        <div className="flex flex-col gap-5 p-[26px]">
          <SantaNote note={exchange.note} />

          {exchange.status === "open" ? (
            <>
              <p className="text-sm leading-relaxed text-ink-76">
                Join with your name and you&rsquo;ll get a private link of your own. When
                names are drawn, that&rsquo;s where you find out who you&rsquo;re buying
                for. Nobody else can see it, not even the organiser.
              </p>
              <SantaJoinForm action={joinExchange} code={code} defaultName={user?.name ?? ""} />
            </>
          ) : (
            <p
              role="status"
              className="rounded-control border border-amber/25 bg-amber-wash px-4 py-3 text-sm leading-relaxed text-amber-dark"
            >
              Names have already been drawn, so nobody else can join. If you should be in
              it, ask the organiser to reset the draw. If you&rsquo;ve already joined,
              open the private link you were given.
            </p>
          )}

          {organizing ? (
            <Link
              href={routes.santaManage(code)}
              className="text-sm font-semibold text-violet underline-offset-2 hover:underline"
            >
              Back to your dashboard →
            </Link>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
