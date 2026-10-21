import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addExclusion,
  addPerson,
  deleteExchange,
  drawExchange,
  removeExclusion,
  removeParticipant,
  resetExchangeDraw,
  resetPrivateLink,
  updateExchange,
} from "@/app/secret-santa/[code]/manage/actions";
import { CopyButton } from "@/components/copy-button";
import {
  AddPersonForm,
  ExclusionForm,
  SantaButton,
  SantaConfirm,
} from "@/components/santa-controls";
import { SantaExchangeForm } from "@/components/santa-exchange-form";
import { exchangeMeta, SantaCardHeader } from "@/components/santa-header";
import { Card, CapsLabel } from "@/components/ui";
import { formatShortDate, toDateInput } from "@/lib/date";
import { displayHost, origin } from "@/lib/origin";
import * as routes from "@/lib/routes";
import {
  currentParticipant,
  exchangeExclusions,
  exchangeParticipants,
  hasSeenCurrentDraw,
  MIN_PARTICIPANTS,
  organizedExchangeOrNull,
} from "@/lib/secret-santa";

export const metadata: Metadata = { title: "Secret Santa dashboard" };

/**
 * The organiser's screen: who's in, who to keep apart, and the draw. Never who
 * drew whom — nothing on this page reads santa_assignments, and it mustn't
 * start to. What it can say is whether each person has looked.
 */
export default async function SantaManagePage({
  params,
  searchParams,
}: PageProps<"/secret-santa/[code]/manage">) {
  const [{ code }, { started }] = await Promise.all([params, searchParams]);
  const resolved = await organizedExchangeOrNull(code);
  // A 404 rather than a 403: a wrong guess shouldn't confirm the code exists.
  if (!resolved) notFound();

  const { exchange } = resolved;
  const [people, exclusions, mine] = await Promise.all([
    exchangeParticipants(exchange.id),
    exchangeExclusions(exchange.id),
    currentParticipant(exchange),
  ]);

  const open = exchange.status === "open";
  const nameOf = new Map(people.map((person) => [person.id, person.name]));
  const looked = people.filter((person) => hasSeenCurrentDraw(exchange, person.seenDraw)).length;
  const inviteUrl = `${origin}${routes.santaInvite(code)}`;
  const fields = { code };
  const invitation = [
    `Join our Secret Santa, ${exchange.emoji} ${exchange.name}!`,
    ...exchangeMeta(exchange),
    `Add your name here: ${inviteUrl}`,
  ].join("\n");
  const shareLink =
    "rounded-pill border border-ink-line-strong bg-surface px-[15px] py-2 text-xs font-semibold transition-colors duration-150 hover:bg-ink/[.03] focus-ring";

  return (
    <main className="mx-auto w-full max-w-[640px] px-[22px] py-10">
      {started ? (
        <p className="mb-5 rounded-card border border-pine/20 bg-pine-wash px-5 py-4 text-sm leading-relaxed text-pine-dark">
          <strong className="font-semibold">It&rsquo;s ready.</strong> Copy the invite link
          below into your group chat. Once everyone&rsquo;s in, come back here to draw
          names.
        </p>
      ) : null}

      <Card>
        <SantaCardHeader exchange={exchange} eyebrow="Secret Santa · you're organising">
          <p className="mt-3 text-xs font-semibold text-paper-88">
            {open
              ? `Open to join · ${people.length} ${people.length === 1 ? "person" : "people"} in`
              : `Names drawn ${exchange.drawnAt ? formatShortDate(exchange.drawnAt) : ""} · ${looked} of ${people.length} have looked`}
          </p>
        </SantaCardHeader>

        <div className="flex flex-col gap-8 p-[26px]">
          {/* The invite link. */}
          {open ? (
            <section aria-labelledby="invite">
              <h2 id="invite">
                <CapsLabel className="mb-[7px]">Invite link</CapsLabel>
              </h2>
              <div className="mb-[9px] flex items-center gap-[10px] rounded-control border border-ink-line-strong bg-surface px-[13px] py-[11px]">
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-ink/82">
                  {displayHost}
                  {routes.santaInvite(code)}
                </span>
                <CopyButton value={inviteUrl} label="Copy link" />
              </div>
              {/* The phone's own messaging and mail apps, with the words filled
                  in. Nothing is sent from here: the organiser sends it, to
                  whoever they choose, from their own account. */}
              <div className="mb-[9px] flex flex-wrap gap-2">
                <a
                  href={`sms:?&body=${encodeURIComponent(invitation)}`}
                  className={shareLink}
                >
                  Share by text
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Join our Secret Santa: ${exchange.name}`)}&body=${encodeURIComponent(invitation)}`}
                  className={shareLink}
                >
                  Share by email
                </a>
              </div>
              <p className="text-xs leading-[1.6] text-ink-66">
                Or paste it into your group chat. Anyone with it can join until you draw
                names.
              </p>
            </section>
          ) : null}

          {/* The draw. */}
          <section
            aria-labelledby="draw"
            className="rounded-card border border-violet-edge bg-violet-wash p-5"
          >
            {open ? (
              <>
                <h2 id="draw" className="mb-1 text-base font-semibold">
                  Draw names
                </h2>
                <p className="mb-4 text-sm leading-relaxed text-ink-76">
                  {people.length < MIN_PARTICIPANTS
                    ? `It takes at least ${MIN_PARTICIPANTS} people. ${people.length} so far.`
                    : `Everyone in? Once names are drawn nobody else can join, and each person finds out who they've got from their own page.`}
                </p>
                {people.length >= MIN_PARTICIPANTS ? (
                  <SantaConfirm
                    action={drawExchange}
                    fields={fields}
                    label="Draw names"
                    prompt={`Draw names for all ${people.length} people now? Joining closes. You won't see who got whom.`}
                    confirmLabel="Draw"
                    busyLabel="Drawing…"
                    tone="violet"
                    trigger="button"
                    align="left"
                  />
                ) : null}
              </>
            ) : (
              <>
                <h2 id="draw" className="mb-1 text-base font-semibold">
                  Names are drawn
                </h2>
                <p className="mb-4 text-sm leading-relaxed text-ink-76">
                  {looked} of {people.length} have looked at theirs. Nudge the others to
                  open their private links. If someone needs to join or leave, reset the
                  draw.
                </p>
                <SantaConfirm
                  action={resetExchangeDraw}
                  fields={fields}
                  label="Reset the draw"
                  prompt={
                    looked > 0
                      ? `${looked} ${looked === 1 ? "person has" : "people have"} already looked. Resetting reopens joining, and everyone gets a new name when you draw again. Those who looked will be told their name changed.`
                      : "Resetting reopens joining, and everyone gets a new name when you draw again."
                  }
                  confirmLabel="Reset"
                  busyLabel="Resetting…"
                  align="left"
                />
              </>
            )}
            {mine ? (
              <Link
                href={routes.santaMine(code)}
                className="mt-4 inline-block text-sm font-semibold text-violet underline-offset-2 hover:underline"
              >
                Your own page →
              </Link>
            ) : null}
          </section>

          {/* Who's in. */}
          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-[-.2px]">
              Who&rsquo;s in · {people.length}
            </h2>
            {people.length === 0 ? (
              <p className="rounded-card border border-dashed border-ink-line-strong px-6 py-8 text-center text-sm text-ink-72">
                Nobody yet. Share the invite link to get started.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {people.map((person) => {
                  const notes = [
                    person.hasAccount ? "Has an account" : null,
                    person.hasWishlist ? "Wishlist linked" : "No wishlist yet",
                    !open
                      ? hasSeenCurrentDraw(exchange, person.seenDraw)
                        ? "Has looked"
                        : "Hasn't looked yet"
                      : null,
                    person.linkResetAt ? `Link replaced ${formatShortDate(person.linkResetAt)}` : null,
                  ].filter(Boolean);

                  return (
                    <li
                      key={person.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-control border border-ink-line bg-surface px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {person.name}
                          {mine?.id === person.id ? (
                            <span className="ml-2 text-xs font-medium text-ink-62">you</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-ink-66">{notes.join(" · ")}</p>
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <SantaConfirm
                          action={resetPrivateLink}
                          fields={{ ...fields, participantId: person.id }}
                          label="New link"
                          prompt={`For when ${person.name} has lost theirs. Their old link stops working, and everyone in the group is shown that you replaced it.`}
                          confirmLabel="Make a new link"
                          busyLabel="Making…"
                          tone="violet"
                        />
                        {open ? (
                          <SantaConfirm
                            action={removeParticipant}
                            fields={{ ...fields, participantId: person.id }}
                            label="Remove"
                            prompt={`Take ${person.name} out of this Secret Santa?`}
                            confirmLabel="Remove"
                            busyLabel="Removing…"
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {open ? (
              <div className="mt-4">
                <p className="mb-1 text-sm font-semibold">Add someone yourself</p>
                <p className="mb-2 text-xs leading-[1.6] text-ink-66">
                  For anyone who won&rsquo;t open the invite link, like a grandparent or a
                  child. You&rsquo;ll get their private link to pass on.
                </p>
                <AddPersonForm action={addPerson} code={code} />
              </div>
            ) : null}
          </section>

          {/* Pairs kept apart. */}
          {open || exclusions.length > 0 ? (
            <section>
              <h2 className="mb-1 text-lg font-semibold tracking-[-.2px]">Keep apart</h2>
              <p className="mb-3 text-sm leading-relaxed text-ink-76">
                People who shouldn&rsquo;t draw each other, like couples who&rsquo;d buy for
                each other anyway.
              </p>
              {exclusions.length > 0 ? (
                <ul className="mb-3 flex flex-col gap-2">
                  {exclusions.map((pair) => (
                    <li
                      key={pair.id}
                      className="flex items-center justify-between gap-3 rounded-control border border-ink-line bg-surface px-4 py-2.5"
                    >
                      <span className="text-sm font-medium">
                        {nameOf.get(pair.firstId)} &amp; {nameOf.get(pair.secondId)}
                      </span>
                      {open ? (
                        <SantaButton
                          action={removeExclusion}
                          fields={{ ...fields, exclusionId: pair.id }}
                          label="Remove"
                          busyLabel="Removing…"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {open && people.length >= 2 ? (
                <ExclusionForm
                  action={addExclusion}
                  code={code}
                  people={people.map(({ id, name }) => ({ id, name }))}
                />
              ) : null}
            </section>
          ) : null}

          {/* The details. */}
          <section>
            <details className="group rounded-card border border-ink-line bg-surface">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
                Edit name, budget, date and note
                <span className="ml-2 text-ink-62 group-open:hidden">+</span>
              </summary>
              <div className="border-t border-ink-line px-5 py-5">
                <SantaExchangeForm
                  action={updateExchange}
                  code={code}
                  details={{
                    name: exchange.name,
                    emoji: exchange.emoji,
                    budget: exchange.budgetCents !== null ? String(exchange.budgetCents / 100) : "",
                    exchangeDate: toDateInput(exchange.exchangeDate),
                    note: exchange.note ?? "",
                  }}
                />
              </div>
            </details>
          </section>

          <section className="flex flex-wrap items-start justify-between gap-4 border-t border-ink-line pt-5">
            <p className="max-w-[20rem] text-xs leading-[1.6] text-ink-66">
              You can&rsquo;t see who drew whom. Nobody can, except each person for
              themselves.
            </p>
            <SantaConfirm
              action={deleteExchange}
              fields={fields}
              label="Delete this Secret Santa"
              prompt="Everyone's private links stop working and the draw is gone for good."
              confirmLabel="Delete it"
              busyLabel="Deleting…"
            />
          </section>
        </div>
      </Card>
    </main>
  );
}
