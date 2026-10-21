"use server";

import { redirect } from "next/navigation";

import { db } from "@/db";
import { track } from "@/lib/analytics";
import { santaExchanges } from "@/db/schema";
import { santaManage } from "@/lib/routes";
import {
  addParticipant,
  MAX_PERSON_NAME,
  parseExchangeFields,
  startedTooManyToday,
  uniqueExchangeCode,
  type SantaState,
} from "@/lib/secret-santa";
import { santaPaused } from "@/lib/santa-flag";
import { getCurrentUser } from "@/lib/session";

export async function createExchange(
  _previous: SantaState,
  formData: FormData,
): Promise<SantaState> {
  // The dashboard is the only way back to the draw button, so it hangs off an
  // account rather than a cookie that a cleared browser would lose.
  const paused = santaPaused();
  if (paused) return { error: paused };

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Your sign-in has run out. Sign in again to start a Secret Santa." };
  }

  const parsed = parseExchangeFields(formData);
  if ("error" in parsed) return parsed;

  if (await startedTooManyToday(user.id)) {
    return { error: "That's a lot of Secret Santas for one day. Try again tomorrow." };
  }

  const code = await uniqueExchangeCode();
  const exchange = await db
    .insert(santaExchanges)
    .values({ organizerId: user.id, code, ...parsed.fields })
    .returning({ id: santaExchanges.id })
    .get();

  await track("santa_group_created");

  // Organisers usually take part. They join under their account name, which
  // they can't change here; someone organising for the office can untick it.
  if (formData.get("takingPart") === "on") {
    addParticipant(exchange.id, user.name.slice(0, MAX_PERSON_NAME), user.id);
    await track("santa_member_joined");
  }

  // redirect() throws a control-flow exception, so it must sit outside try/catch.
  redirect(`${santaManage(code)}?started=1`);
}
