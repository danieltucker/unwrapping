import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { joinExchange } from "@/app/secret-santa/[code]/actions";
import { SantaJoinForm } from "@/components/santa-controls";
import { SantaCardHeader, SantaNote } from "@/components/santa-header";
import { Card } from "@/components/ui";
import * as routes from "@/lib/routes";
import { currentParticipant, exchangeParticipants, resolveExchange } from "@/lib/secret-santa";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/secret-santa/[code]">) {
  const resolved = await resolveExchange((await params).code);
  if (!resolved) return {};
  return {
    title: `Join ${resolved.exchange.name}`,
    description: `${resolved.organizerName} is drawing names for a Secret Santa. Join with just your name.`,
  };
}

/**
 * The invite link. Anyone holding it may join while names are still to be
 * drawn; somebody who has already joined in this browser is sent straight on
 * to their own page.
 */
export default async function SantaInvitePage({ params }: PageProps<"/secret-santa/[code]">) {
  const { code } = await params;
  const resolved = await resolveExchange(code);
  if (!resolved) notFound();

  const { exchange, organizerName } = resolved;
  if (await currentParticipant(exchange)) redirect(routes.santaMine(code));

  const [people, user] = await Promise.all([exchangeParticipants(exchange.id), getCurrentUser()]);
  const organizing = user?.id === exchange.organizerId;

  return (
    <main className="mx-auto w-full max-w-[460px] px-[22px] py-10">
      <Card>
        <SantaCardHeader exchange={exchange} eyebrow={`Secret Santa · from ${organizerName}`} />

        <div className="flex flex-col gap-5 p-[26px]">
          <SantaNote note={exchange.note} />

          {exchange.status === "open" ? (
            <>
              <p className="text-sm leading-relaxed text-ink-76">
                Join with your name and you&rsquo;ll get a private link of your own. When
                names are drawn, that&rsquo;s where you find out who you&rsquo;re buying
                for. Nobody else can see it, {organizerName} included.
              </p>
              <SantaJoinForm action={joinExchange} code={code} defaultName={user?.name ?? ""} />
            </>
          ) : (
            <p className="rounded-control border border-amber/25 bg-amber-wash px-4 py-3 text-sm leading-relaxed text-amber-dark">
              Names have already been drawn, so nobody else can join. If you should be in
              it, ask {organizerName} to reset the draw. If you&rsquo;ve already joined,
              open the private link you were given.
            </p>
          )}

          {people.length > 0 ? (
            <div>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-[.9px] text-ink-66">
                Already in · {people.length}
              </p>
              <p className="text-sm leading-relaxed text-ink-76">
                {people.map((person) => person.name).join(", ")}
              </p>
            </div>
          ) : null}

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
