import { santaOgImage, santaOgSize } from "@/components/santa-og-card";
import { formatPrice, site } from "@/config/site";
import { formatShortDate } from "@/lib/date";
import { exchangeParticipants, resolveExchange } from "@/lib/secret-santa";

/**
 * The preview of an invite link, which is what the group chat actually shows.
 * The group's name, how many are in and the budget: enough to know it's the
 * right one. Never a person's name — the link travels further than the group.
 */
export const alt = `A Secret Santa on ${site.name}`;
export const size = santaOgSize;
export const contentType = "image/png";
// The count changes as people join; a cached picture would go stale.
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const resolved = await resolveExchange((await params).code);
  if (!resolved) {
    return santaOgImage({
      eyebrow: "Secret Santa",
      title: "This Secret Santa isn't here any more",
      facts: [],
      footer: "Ask whoever sent the link for a new one.",
    });
  }

  const { exchange } = resolved;
  const people = (await exchangeParticipants(exchange.id)).length;
  return santaOgImage({
    eyebrow: "Secret Santa",
    title: `${exchange.emoji} ${exchange.name}`,
    facts: [
      `${people} ${people === 1 ? "person" : "people"} in`,
      exchange.budgetCents !== null ? `${formatPrice(exchange.budgetCents)} each` : null,
      exchange.exchangeDate ? formatShortDate(exchange.exchangeDate) : null,
    ].filter((fact): fact is string => fact !== null),
    footer:
      exchange.status === "open"
        ? "Tap to join with just your name."
        : "Names have been drawn. Open your private link to see yours.",
  });
}
