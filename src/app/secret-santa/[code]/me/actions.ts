"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { lists, santaParticipants } from "@/db/schema";
import { santaManage, santaMine, secretSanta } from "@/lib/routes";
import {
  currentParticipant,
  listFromLink,
  resolveExchange,
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

/**
 * "Show me who I've got". A button rather than something that happens on
 * load, so the moment is theirs, and so a link preview or a prefetch can't
 * mark the draw as seen before they have seen it.
 */
export async function revealDraw(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const found = await me(formData);
  if (!found) return { error: NOT_IN };
  if (found.exchange.status !== "drawn") {
    return { error: "Names haven't been drawn yet. Check back once they are." };
  }

  await db
    .update(santaParticipants)
    .set({ viewedAt: new Date() })
    .where(eq(santaParticipants.id, found.participant.id));

  revalidatePath(santaMine(found.exchange.code));
  revalidatePath(santaManage(found.exchange.code));
  return { ok: true };
}

/**
 * Points their Santa at a wishlist: one of their own lists, picked from the
 * menu, or any Unwrap wishlist link pasted in. "none" takes it off.
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

  await db
    .update(santaParticipants)
    .set({ wishlistId })
    .where(eq(santaParticipants.id, found.participant.id));

  revalidatePath(santaMine(found.exchange.code));
  revalidatePath(santaManage(found.exchange.code));
  return { ok: true, message: wishlistId ? "Linked. Your Santa will see it." : "Removed." };
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

  revalidatePath(santaMine(found.exchange.code));
  revalidatePath(santaManage(found.exchange.code));
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
