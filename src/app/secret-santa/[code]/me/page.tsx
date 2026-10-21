import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  keepWithAccount,
  leaveExchange,
  revealDraw,
  setWishlist,
} from "@/app/secret-santa/[code]/me/actions";
import { CopyButton } from "@/components/copy-button";
import {
  LinkHandoff,
  SantaButton,
  SantaConfirm,
  WishlistForm,
} from "@/components/santa-controls";
import { SantaCardHeader, SantaNote } from "@/components/santa-header";
import { ButtonLink, Card, CapsLabel } from "@/components/ui";
import { formatPrice } from "@/config/site";
import { formatShortDate } from "@/lib/date";
import { origin } from "@/lib/origin";
import * as routes from "@/lib/routes";
import {
  assignmentFor,
  currentParticipant,
  exchangeParticipants,
  hasSeenCurrentDraw,
  ownWishlists,
  resolveExchange,
  wishlistFor,
} from "@/lib/secret-santa";
import { getCurrentUser, readSantaToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your Secret Santa",
  robots: { index: false, follow: false },
};

/**
 * One participant's page: who they drew, once they ask to see it, and the
 * wishlist they're offering whoever drew them. Found by this browser's cookie
 * for the exchange, or by the signed-in account; anyone else is sent to the
 * invite page.
 */
export default async function SantaMinePage({
  params,
  searchParams,
}: PageProps<"/secret-santa/[code]/me">) {
  const [{ code }, { joined }] = await Promise.all([params, searchParams]);
  const resolved = await resolveExchange(code);
  if (!resolved) notFound();

  const { exchange, organizerName } = resolved;
  const participant = await currentParticipant(exchange);
  if (!participant) redirect(routes.santaInvite(code));

  const [user, token, people, wishlist] = await Promise.all([
    getCurrentUser(),
    readSantaToken(code),
    exchangeParticipants(exchange.id),
    wishlistFor(participant.wishlistId),
  ]);

  const seen = hasSeenCurrentDraw(exchange, participant.viewedAt);
  // Only fetched once they've asked to see it, so the name is never in the
  // page for a reveal they haven't made.
  const assignment = seen ? await assignmentFor(participant.id) : null;
  const ownLists = user ? await ownWishlists(user.id) : [];
  // The token is only known while it's in this browser's cookie; someone here
  // through their account alone has no link to be shown.
  const privateLink = token ? `${origin}${routes.santaPrivateLink(token)}` : null;
  const resets = people.filter((person) => person.linkResetAt !== null);
  const fields = { code };

  return (
    <main className="mx-auto w-full max-w-[520px] px-[22px] py-10">
      <Card>
        <SantaCardHeader exchange={exchange} eyebrow={`Secret Santa · ${participant.name}`} />

        <div className="flex flex-col gap-6 p-[26px]">
          {participant.linkResetAt ? (
            <p className="rounded-control border border-amber/25 bg-amber-wash px-4 py-3 text-xs leading-[1.6] text-amber-dark">
              {organizerName} replaced your private link on{" "}
              {formatShortDate(participant.linkResetAt)}. If you didn&rsquo;t ask them to,
              whoever had the new link could have opened this page.
            </p>
          ) : null}

          {/* The draw itself. */}
          <section>
            {exchange.status === "open" ? (
              <>
                <p className="mb-1 text-base font-semibold">You&rsquo;re in</p>
                <p className="text-sm leading-relaxed text-ink-76">
                  Names haven&rsquo;t been drawn yet. {organizerName} will draw once
                  everyone has joined; come back to this page then to see who you&rsquo;ve
                  got.
                </p>
              </>
            ) : seen && assignment ? (
              <div className="rounded-card border border-violet-edge bg-violet-wash p-5 text-center">
                <CapsLabel className="mb-2">You&rsquo;re buying for</CapsLabel>
                <p className="font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em]">
                  {assignment.name}
                </p>
                {exchange.budgetCents !== null ? (
                  <p className="mt-2 text-sm text-ink-76">
                    Up to {formatPrice(exchange.budgetCents)}
                  </p>
                ) : null}
                <div className="mt-4">
                  {assignment.wishlist ? (
                    <ButtonLink href={assignment.wishlist.href}>
                      {assignment.wishlist.emoji} See {assignment.name}&rsquo;s wishlist
                    </ButtonLink>
                  ) : (
                    <p className="text-xs leading-[1.6] text-ink-66">
                      {assignment.name} hasn&rsquo;t linked a wishlist yet. Check back
                      closer to the day.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-card border border-ink-line bg-surface p-5 text-center">
                {participant.viewedAt ? (
                  <p className="mb-3 text-xs leading-[1.6] text-amber-dark">
                    Names were drawn again since you last looked, so the person you
                    saw before may not be yours any more.
                  </p>
                ) : null}
                <p className="mb-1 text-base font-semibold">Names have been drawn</p>
                <p className="mb-4 text-sm leading-relaxed text-ink-76">
                  Make sure nobody&rsquo;s looking over your shoulder.
                </p>
                <div className="flex justify-center">
                  <SantaButton
                    action={revealDraw}
                    fields={fields}
                    label="Show me who I’ve got"
                    busyLabel="Drawing back the curtain…"
                    variant="primary"
                    size="md"
                  />
                </div>
              </div>
            )}
          </section>

          <SantaNote note={exchange.note} />

          {/* What their own Santa will see. */}
          <section>
            <p className="mb-1 text-base font-semibold">Your wishlist</p>
            {wishlist ? (
              <div className="mb-3 flex items-center gap-3 rounded-control border border-ink-line bg-surface px-4 py-3">
                <span className="text-xl">{wishlist.emoji}</span>
                <Link href={wishlist.href} className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {wishlist.name}
                </Link>
                <SantaButton
                  action={setWishlist}
                  fields={{ ...fields, listId: "none" }}
                  label="Remove"
                  busyLabel="Removing…"
                />
              </div>
            ) : (
              <p className="mb-3 text-sm leading-relaxed text-ink-76">
                Whoever draws you sees it here. They can reserve from it like any guest,
                so you won&rsquo;t know what they picked.{" "}
                <Link href={routes.newList} className="font-semibold text-violet underline-offset-2 hover:underline">
                  Make a wishlist
                </Link>{" "}
                if you don&rsquo;t have one, then come back and link it.
              </p>
            )}
            {wishlist ? null : (
              <WishlistForm action={setWishlist} code={code} ownLists={ownLists} />
            )}
          </section>

          {/* Getting back here. */}
          <section>
            <p className="mb-1 text-base font-semibold">Getting back here</p>
            {privateLink ? (
              <>
                <p className="mb-3 text-sm leading-relaxed text-ink-76">
                  This browser will remember you. On another phone or computer, open your
                  private link. Keep it to yourself: anyone who opens it can see who you
                  drew.
                </p>
                {joined ? (
                  <LinkHandoff
                    link={privateLink}
                    message="Save this now — send it to yourself, or bookmark it."
                  />
                ) : (
                  <div className="flex items-center gap-[10px] rounded-control border border-ink-line-strong bg-surface px-[13px] py-[11px]">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-ink/82">
                      Your private link
                    </span>
                    <CopyButton value={privateLink} label="Copy link" />
                  </div>
                )}
              </>
            ) : null}

            {participant.userId && participant.userId === user?.id ? (
              <p className="mt-3 text-xs leading-[1.6] text-ink-66">
                This is kept with your account, so signing in on any browser brings you
                back here.
              </p>
            ) : user && !participant.userId ? (
              <div className="mt-3">
                <SantaButton
                  action={keepWithAccount}
                  fields={fields}
                  label={`Keep this with my account (${user.name})`}
                  busyLabel="Saving…"
                />
              </div>
            ) : !user ? (
              <p className="mt-3 text-xs leading-[1.6] text-ink-66">
                Have an Unwrap account?{" "}
                <Link href={routes.signIn} className="font-semibold text-violet underline-offset-2 hover:underline">
                  Sign in
                </Link>
                , then come back here to keep this with it.
              </p>
            ) : null}
          </section>

          {/* Everyone in it, and every link the organiser has replaced. */}
          <section>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-[.9px] text-ink-66">
              Who&rsquo;s in · {people.length}
            </p>
            <p className="text-sm leading-relaxed text-ink-76">
              {people.map((person) => person.name).join(", ")}
            </p>
            {resets.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {resets.map((person) => (
                  <li key={person.id} className="text-xs text-ink-66">
                    {person.name}&rsquo;s link was replaced by {organizerName} on{" "}
                    {formatShortDate(person.linkResetAt!)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {exchange.status === "open" ? (
            <div className="border-t border-ink-line pt-5">
              <SantaConfirm
                action={leaveExchange}
                fields={fields}
                label="Leave this Secret Santa"
                prompt="You'll be taken out before names are drawn. You can join again from the invite link."
                confirmLabel="Leave"
                busyLabel="Leaving…"
                align="left"
              />
            </div>
          ) : null}

          {user?.id === exchange.organizerId ? (
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
