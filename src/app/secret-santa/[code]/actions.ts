"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { track } from "@/lib/analytics";
import { santaManage, santaMine } from "@/lib/routes";
import { santaPaused } from "@/lib/santa-flag";
import {
  addParticipant,
  currentParticipant,
  parsePersonName,
  resolveExchange,
  type SantaState,
} from "@/lib/secret-santa";
import { getCurrentUser, setSantaToken } from "@/lib/session";

const JOIN_MESSAGES = {
  closed:
    "Names have already been drawn, so nobody else can join. Ask the organiser to reset the draw if you should be in it.",
  full: "This Secret Santa is full.",
  "name-taken":
    "Someone with that name has already joined. Add an initial so you can be told apart.",
} as const;

/**
 * Joins the exchange behind the invite link. The person gets a private link of
 * their own, held in a cookie for this exchange, and is taken straight to
 * their page, where it is shown to them to keep.
 */
export async function joinExchange(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  const paused = santaPaused();
  if (paused) return { error: paused };

  const code = String(formData.get("code") ?? "");
  const resolved = await resolveExchange(code);
  if (!resolved) return { error: "This Secret Santa isn't here any more." };

  // A browser that is already someone here goes to their page, rather than
  // quietly becoming a second person.
  if (await currentParticipant(resolved.exchange)) redirect(santaMine(code));

  const parsed = parsePersonName(formData);
  if ("error" in parsed) return parsed;

  const user = await getCurrentUser();
  const result = addParticipant(resolved.exchange.id, parsed.name, user?.id ?? null);

  if (result.outcome === "already-in") redirect(santaMine(code));
  if (result.outcome !== "joined") return { error: JOIN_MESSAGES[result.outcome] };

  await track("santa_member_joined");
  await setSantaToken(code, result.token);
  revalidatePath(santaManage(code));
  redirect(`${santaMine(code)}?joined=1`);
}
