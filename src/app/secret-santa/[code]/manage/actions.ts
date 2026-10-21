"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { santaExchanges, santaExclusions, santaParticipants } from "@/db/schema";
import { track } from "@/lib/analytics";
import { origin } from "@/lib/origin";
import { santaInvite, santaManage, santaMine, santaPrivateLink, secretSanta } from "@/lib/routes";
import { santaPaused } from "@/lib/santa-flag";
import {
  addParticipant,
  MIN_PARTICIPANTS,
  newPrivateToken,
  organizedExchangeOrNull,
  parseExchangeFields,
  parsePersonName,
  resetDraw,
  runDraw,
  type ResolvedExchange,
  type SantaState,
} from "@/lib/secret-santa";

/**
 * The organiser's controls. Each one finds the exchange again from its code
 * and checks the signed-in account organised it: these are public endpoints,
 * and a hidden input is a suggestion, not a fact.
 */

const NOT_ORGANIZER =
  "We couldn't confirm you organised this — your sign-in may have run out. Reload the page and try again.";

const DRAWN =
  "Names have already been drawn. Reset the draw first, and everyone will get a new name.";

/** The exchange if this account organised it, or the sentence to answer with. */
async function organized(formData: FormData): Promise<ResolvedExchange | { error: string }> {
  // Every organiser control changes something, so none is open while paused.
  const paused = santaPaused();
  if (paused) return { error: paused };
  return (
    (await organizedExchangeOrNull(String(formData.get("code") ?? ""))) ?? { error: NOT_ORGANIZER }
  );
}

/** One of this exchange's participants, or null if the id belongs elsewhere. */
async function participantIn(exchangeId: string, participantId: string) {
  return (
    (await db
      .select()
      .from(santaParticipants)
      .where(
        and(
          eq(santaParticipants.id, participantId),
          eq(santaParticipants.exchangeId, exchangeId),
        ),
      )
      .get()) ?? null
  );
}

function refresh(code: string) {
  revalidatePath(santaManage(code));
  revalidatePath(santaMine(code));
  revalidatePath(santaInvite(code));
}

export async function updateExchange(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;

  const parsed = parseExchangeFields(formData);
  if ("error" in parsed) return parsed;

  await db
    .update(santaExchanges)
    .set(parsed.fields)
    .where(eq(santaExchanges.id, resolved.exchange.id));

  refresh(resolved.exchange.code);
  return { ok: true, message: "Saved." };
}

/**
 * Adds someone who isn't going to open the invite link themselves — a
 * grandparent, a child. Their private link is handed back here, once, for the
 * organiser to pass on.
 */
export async function addPerson(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;

  const parsed = parsePersonName(formData);
  if ("error" in parsed) return parsed;

  const result = addParticipant(resolved.exchange.id, parsed.name, null);
  if (result.outcome === "closed") return { error: DRAWN };
  if (result.outcome === "full") return { error: "This Secret Santa is full." };
  if (result.outcome === "name-taken") {
    return { error: "Someone with that name is already in. Add an initial." };
  }
  if (result.outcome !== "joined") return { error: "They're already in." };
  await track("santa_member_joined");

  refresh(resolved.exchange.code);
  return {
    ok: true,
    message: `${parsed.name} is in. Send them this link — it’s theirs, and it won’t be shown again.`,
    link: `${origin}${santaPrivateLink(result.token)}`,
  };
}

export async function removeParticipant(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;
  if (resolved.exchange.status !== "open") return { error: DRAWN };

  const participant = await participantIn(
    resolved.exchange.id,
    String(formData.get("participantId") ?? ""),
  );
  if (!participant) return { error: "They've already left." };

  // Their exclusions go with them; see the cascades on santa_exclusions.
  await db.delete(santaParticipants).where(eq(santaParticipants.id, participant.id));

  refresh(resolved.exchange.code);
  return { ok: true };
}

/**
 * Replaces someone's private link when they've lost it. The old one stops
 * working at once.
 *
 * Whoever holds the new link can open that person's page, the organiser
 * included, and nothing can prevent that. So it is never done quietly: the
 * time is recorded, and every participant's page says whose link was reset.
 */
export async function resetPrivateLink(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;

  const participant = await participantIn(
    resolved.exchange.id,
    String(formData.get("participantId") ?? ""),
  );
  if (!participant) return { error: "They're not in this Secret Santa any more." };

  const { token, tokenHash } = newPrivateToken();
  await db
    .update(santaParticipants)
    .set({ tokenHash, linkResetAt: new Date() })
    .where(eq(santaParticipants.id, participant.id));

  refresh(resolved.exchange.code);
  return {
    ok: true,
    message: `Send this to ${participant.name}. Their old link has stopped working, and everyone in the group can see it was replaced.`,
    link: `${origin}${santaPrivateLink(token)}`,
  };
}

export async function addExclusion(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;
  if (resolved.exchange.status !== "open") return { error: DRAWN };

  const firstId = String(formData.get("firstId") ?? "");
  const secondId = String(formData.get("secondId") ?? "");
  if (!firstId || !secondId) return { error: "Pick two people." };
  if (firstId === secondId) return { error: "Pick two different people." };

  const [first, second] = await Promise.all([
    participantIn(resolved.exchange.id, firstId),
    participantIn(resolved.exchange.id, secondId),
  ]);
  if (!first || !second) return { error: "One of them has left. Reload and try again." };

  // Stored in sorted order, so the same pair the other way round is a duplicate.
  const [a, b] = [first.id, second.id].sort();
  await db
    .insert(santaExclusions)
    .values({ exchangeId: resolved.exchange.id, firstId: a, secondId: b })
    .onConflictDoNothing();

  refresh(resolved.exchange.code);
  return { ok: true };
}

export async function removeExclusion(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;
  if (resolved.exchange.status !== "open") return { error: DRAWN };

  await db
    .delete(santaExclusions)
    .where(
      and(
        eq(santaExclusions.id, String(formData.get("exclusionId") ?? "")),
        eq(santaExclusions.exchangeId, resolved.exchange.id),
      ),
    );

  refresh(resolved.exchange.code);
  return { ok: true };
}

const DRAW_MESSAGES = {
  "not-open": "Names have already been drawn.",
  "too-few": `It takes at least ${MIN_PARTICIPANTS} people to draw names.`,
  impossible:
    "There's no way to draw names that keeps everyone apart who should be. Remove a “keep apart” pair and try again.",
  predictable:
    "Those “keep apart” pairs leave someone with only one person they could draw, so their match wouldn't be a secret — not even from you. Remove a pair and try again.",
} as const;

export async function drawExchange(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;

  const outcome = runDraw(resolved.exchange.id);
  if (outcome !== "drawn") return { error: DRAW_MESSAGES[outcome] };
  await track("santa_draw_run");

  refresh(resolved.exchange.code);
  return { ok: true };
}

export async function resetExchangeDraw(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;
  if (resolved.exchange.status !== "drawn") return { ok: true };

  resetDraw(resolved.exchange.id);

  refresh(resolved.exchange.code);
  return { ok: true };
}

export async function deleteExchange(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const resolved = await organized(formData);
  if ("error" in resolved) return resolved;

  // Participants, exclusions and the draw all cascade with it.
  await db.delete(santaExchanges).where(eq(santaExchanges.id, resolved.exchange.id));

  revalidatePath(secretSanta);
  redirect(secretSanta);
}
