"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { lists, santaParticipants } from "@/db/schema";
import { track } from "@/lib/analytics";
import { insertList } from "@/lib/create-list";
import { santaManage, santaMine, secretSanta } from "@/lib/routes";
import {
  currentParticipant,
  hasSeenCurrentDraw,
  listFromLink,
  MAX_MESSAGE,
  postMessage,
  reportMessage,
  resolveExchange,
  revealMatch as markRevealed,
  type PostOutcome,
  type SantaState,
} from "@/lib/secret-santa";
import { clearSantaToken, getCurrentUser, readSantaToken } from "@/lib/session";

/**
 * A participant's own controls. The participant is always found from this
 * browser's cookie or account, never from an id in the form, so nobody can
 * act as anyone but themselves.
 */

const NOT_IN =
  "We couldn't tell who you are in this Secret Santa. Open your private link again and retry.";

async function me(formData: FormData) {
  const resolved = await resolveExchange(String(formData.get("code") ?? ""));
  if (!resolved) return null;
  const participant = await currentParticipant(resolved.exchange);
  return participant ? { ...resolved, participant } : null;
}

function refresh(code: string) {
  revalidatePath(santaMine(code));
  revalidatePath(santaManage(code));
}

/**
 * "Show me who I've got". A button rather than something that happens on
 * load, so the moment is theirs, and so a link preview or a prefetch can't
 * mark the draw as seen before they have seen it.
 */
export async function revealMatch(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };
  if (found.exchange.status !== "drawn") {
    return { error: "Names haven't been drawn yet. Check back once they are." };
  }

  // Counted once per draw, however many times the button is pressed.
  if (!hasSeenCurrentDraw(found.exchange, found.participant.seenDraw)) {
    await track("santa_reveal_opened");
  }
  await markRevealed(found.participant);

  refresh(found.exchange.code);
  // Lands on the name itself, which takes focus: the moment the page changes
  // under a screen reader, it should say who rather than nothing.
  redirect(`${santaMine(found.exchange.code)}?revealed=1#match`);
}

const NOT_A_SURPRISE =
  "That list shows its owner what's been reserved, so your Santa's pick wouldn't be a surprise. Turn surprise back on in the list's settings, or make a new list here.";

/**
 * Points their Santa at a wishlist: one of their own lists, picked from the
 * menu, or any Unwrap wishlist link pasted in. "none" takes it off.
 *
 * Only a surprise list. A Santa reserves from it like any guest, and the
 * surprise setting is what keeps that reservation from its owner.
 */
export async function setWishlist(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };

  const picked = String(formData.get("listId") ?? "");
  const pasted = String(formData.get("link") ?? "").trim();

  let wishlistId: string | null = null;
  if (picked === "none") {
    wishlistId = null;
  } else if (picked) {
    // Only their own lists are in the menu; check it's still one of them.
    const user = await getCurrentUser();
    const own = user
      ? await db
          .select({ id: lists.id })
          .from(lists)
          .where(and(eq(lists.id, picked), eq(lists.ownerId, user.id), eq(lists.kind, "personal")))
          .get()
      : null;
    if (!own) return { error: "That list isn't one of yours any more." };
    wishlistId = own.id;
  } else if (pasted) {
    wishlistId = await listFromLink(pasted);
    if (!wishlistId) {
      return { error: "That doesn't look like a link to an Unwrap wishlist. Copy it from the list's Share button." };
    }
  } else {
    return { error: "Pick a list, or paste a link to one." };
  }

  if (wishlistId) {
    const list = await db
      .select({ surpriseMode: lists.surpriseMode })
      .from(lists)
      .where(eq(lists.id, wishlistId))
      .get();
    if (!list?.surpriseMode) return { error: NOT_A_SURPRISE };
  }

  await db
    .update(santaParticipants)
    .set({ wishlistId })
    .where(eq(santaParticipants.id, found.participant.id));

  refresh(found.exchange.code);
  return { ok: true, message: wishlistId ? "Linked. Your Santa will see it." : "Removed." };
}

/**
 * Starts a wishlist from this page and links it, so a participant who has
 * never used Unwrap can add gifts and ideas without going anywhere else.
 *
 * Made the way /new makes one — an account's if they're signed in, otherwise
 * a draft held by this browser — and always a surprise, anonymous list.
 */
export async function createWishlist(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };
  if (found.participant.wishlistId) return { ok: true };

  const { list } = await insertList({
    name: `${found.participant.name}'s wishlist`.slice(0, 80),
    emoji: "🎅",
    eventDate: found.exchange.exchangeDate,
    note: null,
    claimRule: "anonymous",
    surpriseMode: true,
  });

  await db
    .update(santaParticipants)
    .set({ wishlistId: list.id })
    .where(eq(santaParticipants.id, found.participant.id));

  refresh(found.exchange.code);
  return { ok: true };
}

const POST_MESSAGES: Record<Exclude<PostOutcome, "sent">, string> = {
  "not-drawn": "Names haven't been drawn yet, so there's nobody to write to.",
  "not-revealed": "See who you've got first.",
  empty: "Write something first.",
  "too-long": `Keep it under ${MAX_MESSAGE} characters.`,
  "too-fast": "That's a lot of messages at once. Give it a few minutes.",
  "too-many": "That's all the messages for today. Pick it up again tomorrow.",
};

/**
 * Sends into one of the two anonymous threads: "receiver" is the person this
 * participant drew, "santa" is whoever drew them.
 */
export async function sendMessage(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };

  const to = formData.get("to") === "santa" ? "santa" : "receiver";
  const outcome = await postMessage(
    found.participant,
    found.exchange,
    to,
    String(formData.get("body") ?? ""),
  );
  if (outcome !== "sent") return { error: POST_MESSAGES[outcome] };

  refresh(found.exchange.code);
  return { ok: true };
}

export async function reportSantaMessage(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };

  const outcome = await reportMessage(found.participant, String(formData.get("messageId") ?? ""));
  if (outcome === "missing") return { error: "That message isn't here any more." };
  if (outcome === "own") return { error: "That's your own message." };
  if (outcome === "too-many") return { error: "You've reported a lot today. Try again tomorrow." };

  refresh(found.exchange.code);
  return { ok: true, message: "Reported. The site's operator will take a look." };
}

/**
 * Ties this participant to the signed-in account, so signing in anywhere
 * brings them back. Only ever on request: the browser might hold somebody
 * else's link, and that person must not be quietly moved onto this account.
 */
export async function keepWithAccount(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };

  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first, then come back to this page." };
  if (found.participant.userId === user.id) return { ok: true };

  const other = await db
    .select({ id: santaParticipants.id })
    .from(santaParticipants)
    .where(
      and(
        eq(santaParticipants.exchangeId, found.exchange.id),
        eq(santaParticipants.userId, user.id),
      ),
    )
    .get();
  if (other) {
    return { error: "Your account is already someone else in this Secret Santa." };
  }

  await db
    .update(santaParticipants)
    .set({ userId: user.id })
    .where(eq(santaParticipants.id, found.participant.id));

  refresh(found.exchange.code);
  return { ok: true, message: "Done. Sign in on any browser to get back here." };
}

export async function leaveExchange(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };
  if (found.exchange.status !== "open") {
    return {
      error: `Names have already been drawn, so leaving would leave someone without a Santa. Ask ${found.organizerName} to reset the draw.`,
    };
  }

  await db.delete(santaParticipants).where(eq(santaParticipants.id, found.participant.id));
  if (await readSantaToken(found.exchange.code)) await clearSantaToken(found.exchange.code);

  revalidatePath(santaManage(found.exchange.code));
  redirect(secretSanta);
}
