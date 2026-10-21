import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  createWishlist,
  keepWithAccount,
  leaveExchange,
  reportSantaMessage,
  revealMatch,
  sendMessage,
  setWishlist,
} from "@/app/secret-santa/[code]/me/actions";
import { AddGiftDialog } from "@/components/add-gift-dialog";
import { CopyButton } from "@/components/copy-button";
import { GiftGrid } from "@/components/gift-grid";
import { IdeaList } from "@/components/idea-list";
import {
  FocusOnMount,
  LinkHandoff,
  SantaButton,
  SantaConfirm,
  WishlistForm,
} from "@/components/santa-controls";
import { SantaCardHeader, SantaNote } from "@/components/santa-header";
import { SantaThread } from "@/components/santa-thread";
import { Card, CapsLabel } from "@/components/ui";
import { formatPrice } from "@/config/site";
import { getPublicList, type PublicItem } from "@/lib/claims";
import { countdown, formatShortDate } from "@/lib/date";
import { resolveList, viewerOwns } from "@/lib/list-access";
import { origin } from "@/lib/origin";
import * as routes from "@/lib/routes";
import { ideaPrompts } from "@/lib/santa-ideas";
import {
  currentParticipant,
  MAX_MESSAGE,
  memberView,
  ownWishlists,
  resolveExchange,
  type Wishlist,
} from "@/lib/secret-santa";
import { getCurrentUser, readSantaToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your Secret Santa",
  robots: { index: false, follow: false },
};

/**
 * One participant's page. Everything it knows about the exchange comes from
 * memberView, which is built not to carry anything about who drew whom beyond
 * their own match; the two wishlists are loaded through the lists' own rules.
 *
 * Found by this browser's cookie for the exchange, or by the signed-in
 * account. Anyone else is sent to the invite page.
 */
export default async function SantaMinePage({
  params,
  searchParams,
}: PageProps<"/secret-santa/[code]/me">) {
  const [{ code }, { joined, revealed }] = await Promise.all([params, searchParams]);
  const resolved = await resolveExchange(code);
  if (!resolved) notFound();

  const participant = await currentParticipant(resolved.exchange);
  if (!participant) redirect(routes.santaInvite(code));

  const [view, user, token] = await Promise.all([
    memberView(resolved, participant),
    getCurrentUser(),
    readSantaToken(code),
  ]);
  const { exchange, match, myWishlist } = view;

  const [ownLists, theirList, mine] = await Promise.all([
    user ? ownWishlists(user.id) : [],
    match?.wishlist?.surpriseMode ? loadList(match.wishlist) : null,
    myWishlist ? loadOwnList(myWishlist) : null,
  ]);

  // The token is only known while it's in this browser's cookie; someone here
  // through their account alone has no link to be shown.
  const privateLink = token ? `${origin}${routes.santaPrivateLink(token)}` : null;
  const resets = view.roster.filter((person) => person.linkResetAt !== null);
  const fields = { code };
  const until = countdown(exchange.exchangeDate);
  const budget = exchange.budgetCents !== null ? formatPrice(exchange.budgetCents) : null;

  return (
    <main className="mx-auto w-full max-w-[860px] px-[22px] py-10">
      <Card>
        <SantaCardHeader exchange={resolved.exchange} eyebrow={`Secret Santa · ${view.me.name}`}>
          {until ? (
            <p className="mt-3 inline-block rounded-pill bg-paper-fill px-3 py-1 text-xs font-semibold text-champagne">
              {until}
            </p>
          ) : null}
        </SantaCardHeader>

        <div className="flex flex-col gap-8 p-[22px] sm:p-[30px]">
          {view.me.linkResetAt ? (
            <p className="rounded-control border border-amber/25 bg-amber-wash px-4 py-3 text-xs leading-[1.6] text-amber-dark">
              {view.organizerName} replaced your private link on{" "}
              {formatShortDate(view.me.linkResetAt)}. If you didn&rsquo;t ask them to,
              whoever had the new link could have opened this page.
            </p>
          ) : null}

          {/* The draw. */}
          <Section title="Your person">
            {!view.drawn ? (
              <p className="text-sm leading-relaxed text-ink-76">
                You&rsquo;re in. Names haven&rsquo;t been drawn yet; {view.organizerName} will
                draw once everyone has joined. Come back here then to see who you&rsquo;ve
                got.
                {budget ? ` The budget is ${budget} each.` : ""}
              </p>
            ) : match ? (
              <div className="rounded-card border border-violet-edge bg-violet-wash p-6 text-center">
                <CapsLabel className="mb-2">You&rsquo;re buying for</CapsLabel>
                <p
                  id="match"
                  tabIndex={-1}
                  className="font-display text-[2.5rem] leading-[1.05] tracking-[-0.03em] outline-none"
                >
                  {match.name}
                </p>
                {revealed ? <FocusOnMount id="match" /> : null}
                <p className="mt-2 text-sm text-ink-76">
                  {budget ? `Spend up to ${budget}` : "No budget was set"}
                  {exchange.exchangeDate ? ` · by ${formatShortDate(exchange.exchangeDate)}` : ""}
                </p>
              </div>
            ) : (
              <div className="rounded-card border border-ink-line bg-surface p-6 text-center">
                {view.me.lookedBeforeRedraw ? (
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
                    action={revealMatch}
                    fields={fields}
                    label="Reveal who I’ve got"
                    busyLabel="Revealing…"
                    variant="primary"
                    size="md"
                  />
                </div>
              </div>
            )}
          </Section>

          {/* What they're buying from. */}
          {match ? (
            <Section title={`${match.name}’s wishlist`}>
              {match.wishlist && theirList ? (
                <TheirList
                  list={theirList}
                  signedIn={user !== null}
                  budgetCents={exchange.budgetCents}
                  name={match.name}
                />
              ) : match.wishlist ? (
                // Linked while it was a surprise list, switched off since.
                <p className="text-sm leading-relaxed text-ink-76">
                  {match.name}&rsquo;s list shows them what&rsquo;s been reserved, so
                  reserving from here would give the game away.{" "}
                  <Link href={match.wishlist.href} className="font-semibold text-violet underline-offset-2 hover:underline">
                    Look at it
                  </Link>{" "}
                  for ideas, and buy without reserving.
                </p>
              ) : (
                <IdeaPrompts name={match.name} budgetCents={exchange.budgetCents} budget={budget} />
              )}
            </Section>
          ) : null}

          {/* The two anonymous threads. */}
          {match && view.threads.withReceiver ? (
            <Section title={`Messages with ${match.name}`}>
              <p className="mb-3 text-xs leading-[1.6] text-ink-66">
                {match.name} sees these as from &ldquo;Your Santa&rdquo;. They won&rsquo;t
                see your name unless you write it.
              </p>
              <SantaThread
                code={code}
                to="receiver"
                otherLabel={match.name}
                messages={view.threads.withReceiver}
                maxLength={MAX_MESSAGE}
                send={sendMessage}
                report={reportSantaMessage}
              />
            </Section>
          ) : null}

          {view.threads.withSanta ? (
            <Section title="Messages with your Santa">
              <SantaThread
                code={code}
                to="santa"
                otherLabel="Your Santa"
                messages={view.threads.withSanta}
                maxLength={MAX_MESSAGE}
                send={sendMessage}
                report={reportSantaMessage}
              />
            </Section>
          ) : null}

          {/* Their own wishlist, editable in place when it's theirs to edit. */}
          <Section title="Your wishlist">
            {myWishlist && mine ? (
              <OwnList wishlist={myWishlist} list={mine} code={code} />
            ) : myWishlist ? (
              <div className="flex items-center gap-3 rounded-control border border-ink-line bg-surface px-4 py-3">
                <span className="text-xl" aria-hidden="true">
                  {myWishlist.emoji}
                </span>
                <Link href={myWishlist.href} className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {myWishlist.name}
                </Link>
                <SantaButton
                  action={setWishlist}
                  fields={{ ...fields, listId: "none" }}
                  label="Unlink"
                  busyLabel="Unlinking…"
                />
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm leading-relaxed text-ink-76">
                  Whoever draws you sees it here and can reserve from it. You won&rsquo;t
                  see what they picked.
                </p>
                <div className="mb-5">
                  <SantaButton
                    action={createWishlist}
                    fields={fields}
                    label="Start a wishlist here"
                    busyLabel="Starting…"
                    variant="primary"
                  />
                </div>
                <p className="mb-2 text-xs font-semibold text-ink-66">Or link one you already have</p>
                <WishlistForm action={setWishlist} code={code} ownLists={ownLists} />
              </>
            )}
          </Section>

          <SantaNote note={exchange.note} />

          {/* Getting back here. */}
          <Section title="Getting back here">
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
          </Section>

          {/* Everyone in it, and every link the organiser has replaced. */}
          <Section title={`Who’s in · ${view.roster.length}`}>
            <ul className="flex flex-wrap gap-2">
              {view.roster.map((person) => (
                <li
                  key={person.name}
                  className="rounded-pill border border-ink-line bg-surface px-3 py-1 text-sm"
                >
                  {person.name}
                </li>
              ))}
            </ul>
            {resets.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1">
                {resets.map((person) => (
                  <li key={person.name} className="text-xs text-ink-66">
                    {person.name}&rsquo;s link was replaced by {view.organizerName} on{" "}
                    {formatShortDate(person.linkResetAt!)}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          {exchange.open ? (
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

          {user?.id === resolved.exchange.organizerId ? (
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-[-.2px]">{title}</h2>
      {children}
    </section>
  );
}

/** A list as this viewer may see it, through the same function as its own page. */
async function loadList(wishlist: Wishlist) {
  const view = await getPublicList(wishlist.handle, wishlist.listKey);
  return view ? { ...view, wishlist } : null;
}

/** The viewer's own linked list, only when it really is theirs to add to. */
async function loadOwnList(wishlist: Wishlist) {
  const resolved = await resolveList(wishlist.handle, wishlist.listKey);
  if (!resolved || !(await viewerOwns(resolved))) return null;
  return getPublicList(wishlist.handle, wishlist.listKey);
}

type LoadedList = NonNullable<Awaited<ReturnType<typeof loadList>>>;

/**
 * The person they drew's list, as any guest would see it, with one difference:
 * reserving never asks for a name, because a name on a gift would tell the rest
 * of the family who drew whom. reserveGift agrees; see isSantaFor.
 */
function TheirList({
  list,
  signedIn,
  budgetCents,
  name,
}: {
  list: LoadedList;
  signedIn: boolean;
  budgetCents: number | null;
  name: string;
}) {
  const { items, wishlist } = list;
  const ideas = items.filter((item) => item.kind === "idea");
  const gifts = items.filter((item) => item.kind !== "idea" && item.parentId === null);
  const suggestions = new Map(
    ideas.map((idea) => [idea.id, items.filter((item) => item.parentId === idea.id)]),
  );
  const priced = gifts.filter((item) => item.priceCents !== null);
  const within =
    budgetCents === null ? null : priced.filter((item) => item.priceCents! <= budgetCents).length;

  if (items.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-ink-line-strong px-4 py-6 text-center text-sm text-ink-72">
        {name} hasn&rsquo;t added anything yet. Check back closer to the day.
      </p>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm leading-relaxed text-ink-76">
        Reserve what you&rsquo;re getting so nobody else buys it too. {name} won&rsquo;t see
        what&rsquo;s reserved, or by whom.
        {within !== null && priced.length > 0
          ? ` ${within} of ${priced.length} priced ${priced.length === 1 ? "gift is" : "gifts are"} within the budget.`
          : ""}{" "}
        <Link href={wishlist.href} className="font-semibold text-violet underline-offset-2 hover:underline">
          Open the full list
        </Link>
      </p>
      {gifts.length > 0 ? (
        <GiftGrid
          items={gifts}
          handle={wishlist.handle}
          listKey={wishlist.listKey}
          claimRule="anonymous"
          viewerIsOwner={false}
          signedIn={signedIn}
          surpriseMode
        />
      ) : null}
      <IdeaList
        items={ideas}
        suggestions={suggestions}
        handle={wishlist.handle}
        listKey={wishlist.listKey}
        claimRule="anonymous"
        viewerIsOwner={false}
        signedIn={signedIn}
        surpriseMode
        alone={gifts.length === 0}
      />
    </>
  );
}

/** Somewhere to start when the person they drew has no list. */
function IdeaPrompts({
  name,
  budgetCents,
  budget,
}: {
  name: string;
  budgetCents: number | null;
  budget: string | null;
}) {
  return (
    <div className="rounded-card border border-ink-line bg-surface p-5">
      <p className="mb-3 text-sm leading-relaxed text-ink-76">
        {name} hasn&rsquo;t linked a wishlist yet. You could ask them in a message below,
        or start from one of these{budget ? `, all doable for ${budget}` : ""}:
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
        {ideaPrompts(budgetCents).map((prompt) => (
          <li key={prompt}>{prompt}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Their own list, with the same add-a-gift panel as the editor: a present from
 * a link, one written in by hand, or an idea. Everything else is a click away
 * in the full editor.
 */
function OwnList({
  wishlist,
  list,
  code,
}: {
  wishlist: Wishlist;
  list: NonNullable<Awaited<ReturnType<typeof getPublicList>>>;
  code: string;
}) {
  const top = list.items.filter((item) => item.parentId === null);
  return (
    <div className="rounded-card border border-ink-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line px-4 py-3">
        <Link href={wishlist.href} className="min-w-0 truncate text-sm font-semibold">
          <span className="mr-2" aria-hidden="true">
            {wishlist.emoji}
          </span>
          {wishlist.name}
        </Link>
        <div className="flex items-center gap-2">
          <AddGiftDialog handle={wishlist.handle} listKey={wishlist.listKey}>
            Add a gift or idea
          </AddGiftDialog>
        </div>
      </div>
      {top.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-72">
          Nothing on it yet. Add a gift from any shop, or an idea like
          &ldquo;knitting&rdquo; for your Santa to run with.
        </p>
      ) : (
        <ul className="divide-y divide-ink-line">
          {top.map((item) => (
            <OwnItem key={item.id} item={item} under={list.items.filter((c) => c.parentId === item.id)} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-line px-4 py-3">
        <Link
          href={wishlist.manageHref}
          className="text-xs font-semibold text-violet underline-offset-2 hover:underline"
        >
          Edit, reorder or remove in the full editor →
        </Link>
        <SantaButton
          action={setWishlist}
          fields={{ code, listId: "none" }}
          label="Unlink"
          busyLabel="Unlinking…"
        />
      </div>
    </div>
  );
}

function OwnItem({ item, under }: { item: PublicItem; under: PublicItem[] }) {
  return (
    <li className="px-4 py-3">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">
          {item.kind === "idea" ? <span className="mr-1.5 text-2xs font-semibold uppercase tracking-[.9px] text-violet">Idea</span> : null}
          {item.title}
        </span>
        {item.priceCents !== null ? (
          <span className="shrink-0 text-xs text-ink-66">{formatPrice(item.priceCents)}</span>
        ) : null}
      </p>
      {under.length > 0 ? (
        <ul className="mt-1 pl-4 text-xs text-ink-72">
          {under.map((child) => (
            <li key={child.id}>· {child.title}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
