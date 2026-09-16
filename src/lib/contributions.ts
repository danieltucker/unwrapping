import "server-only";

import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { contributions, items, lists, users } from "@/db/schema";
import { outboundHref } from "@/lib/outbound";
import { publicList } from "@/lib/routes";
import { viewerScope } from "@/lib/viewer";

/**
 * Group gifts.
 *
 * No money moves yet: a contribution is authorised in the UI and stored as
 * `pending`. The design only captures when the goal is met, so nothing here
 * charges anyone — but the amounts are real and the totals are what both the
 * guest and the owner are shown.
 *
 * The owner sees the total raised and nothing else. Who contributed is held to
 * the same rule as who claimed what: see getPublicList.
 */

/** Floor and ceiling on a single chip-in, so a typo can't land in the totals. */
export const MIN_CONTRIBUTION_CENTS = 100;
export const MAX_CONTRIBUTION_CENTS = 1_000_000;

/** A refunded contribution stops counting toward any total. */
const counted = ne(contributions.status, "refunded");

export type ContributionOutcome =
  | "recorded"
  | "missing"
  | "not-group"
  | "funded"
  | "too-small"
  | "too-large";

/** What an item has raised so far, across everyone. */
export async function raisedForItem(itemId: string): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${contributions.amountCents}), 0)` })
    .from(contributions)
    .where(and(eq(contributions.itemId, itemId), counted))
    .get();

  return row?.total ?? 0;
}

export type ItemFunding = {
  itemId: string;
  raisedCents: number;
  /** How many people have chipped in. A count, never a list of names. */
  contributorCount: number;
};

/** Where every group gift on a list has got to, in one query. */
export async function fundingForList(listId: string): Promise<ItemFunding[]> {
  return db
    .select({
      itemId: contributions.itemId,
      raisedCents: sql<number>`coalesce(sum(${contributions.amountCents}), 0)`,
      contributorCount: sql<number>`count(distinct ${contributions.guestToken})`,
    })
    .from(contributions)
    .innerJoin(items, eq(items.id, contributions.itemId))
    .where(and(eq(items.listId, listId), counted))
    .groupBy(contributions.itemId)
    .all();
}

/** The owner-visible aggregate for a whole list: one number, no breakdown. */
export async function raisedForList(listId: string): Promise<number> {
  const funding = await fundingForList(listId);
  return funding.reduce((total, item) => total + item.raisedCents, 0);
}

/**
 * Records a chip-in.
 *
 * Unlike a claim there is nothing exclusive to win here, so two people
 * contributing at the same moment need no atomic guard — both amounts count.
 * The one thing refused is money toward a goal already met.
 */
export async function contributeToItem(
  itemId: string,
  guestToken: string,
  userId: string | null,
  amountCents: number,
): Promise<ContributionOutcome> {
  if (amountCents < MIN_CONTRIBUTION_CENTS) return "too-small";
  if (amountCents > MAX_CONTRIBUTION_CENTS) return "too-large";

  const item = await db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item) return "missing";
  if (!item.isGroupGift) return "not-group";

  if (item.goalCents !== null && (await raisedForItem(itemId)) >= item.goalCents) {
    return "funded";
  }

  await db.insert(contributions).values({ itemId, guestToken, userId, amountCents });
  return "recorded";
}

export type GuestContribution = {
  itemId: string;
  title: string;
  image: string | null;
  href: string | null;
  sourceDomain: string | null;
  /** Everything this person has put in, summed — they may have chipped in twice. */
  yourAmountCents: number;
  raisedCents: number;
  goalCents: number | null;
  lastChippedAt: Date;
  listName: string;
  listEmoji: string;
  eventDate: Date | null;
  listPath: string;
};

/** The group gifts this visitor has chipped in toward, for their own page. */
export async function getGuestContributions(): Promise<GuestContribution[]> {
  const scope = await viewerScope(contributions.guestToken, contributions.userId);
  if (!scope) return [];

  const rows = await db
    .select({
      amountCents: contributions.amountCents,
      createdAt: contributions.createdAt,
      item: items,
      list: lists,
      handle: users.handle,
    })
    .from(contributions)
    .innerJoin(items, eq(items.id, contributions.itemId))
    .innerJoin(lists, eq(lists.id, items.listId))
    .leftJoin(users, eq(users.id, lists.ownerId))
    .where(and(scope, counted))
    .all();

  // Several chip-ins toward the same gift read as one line, not a payment log.
  const byItem = new Map<string, GuestContribution>();

  for (const { amountCents, createdAt, item, list, handle } of rows) {
    const existing = byItem.get(item.id);

    if (existing) {
      existing.yourAmountCents += amountCents;
      if (createdAt > existing.lastChippedAt) existing.lastChippedAt = createdAt;
      continue;
    }

    byItem.set(item.id, {
      itemId: item.id,
      title: item.title,
      image: item.images[item.selectedImageIndex] ?? item.images[0] ?? null,
      href: outboundHref(item.url),
      sourceDomain: item.sourceDomain,
      yourAmountCents: amountCents,
      raisedCents: 0,
      goalCents: item.goalCents,
      lastChippedAt: createdAt,
      listName: list.name,
      listEmoji: list.emoji,
      eventDate: list.eventDate,
      listPath: publicList(list, handle),
    });
  }

  // The group total is public on the list, so it's fair to show it here too.
  for (const contribution of byItem.values()) {
    contribution.raisedCents = await raisedForItem(contribution.itemId);
  }

  return [...byItem.values()].sort(
    (a, b) => b.lastChippedAt.getTime() - a.lastChippedAt.getTime(),
  );
}

/** Ties this browser's chip-ins to an account, at sign-up or sign-in. */
export async function linkGuestContributionsToUser(
  guestToken: string,
  userId: string,
): Promise<number> {
  const result = await db
    .update(contributions)
    .set({ userId })
    .where(
      and(eq(contributions.guestToken, guestToken), isNull(contributions.userId)),
    );

  return result.changes;
}
