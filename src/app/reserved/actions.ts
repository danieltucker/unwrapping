"use server";

import { revalidatePath } from "next/cache";

import { setMarkedBought } from "@/lib/reservations";

export type MarkBoughtState = { error?: string };

export async function markBought(
  _previous: MarkBoughtState,
  formData: FormData,
): Promise<MarkBoughtState> {
  const claimId = String(formData.get("claimId") ?? "");
  const bought = formData.get("bought") === "true";

  // Ownership of the claim is checked inside, against the guest cookie.
  const ok = await setMarkedBought(claimId, bought);
  if (!ok) return { error: "We couldn't find that reservation." };

  revalidatePath("/reserved");
  return {};
}
