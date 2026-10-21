/**
 * Proves the Secret Santa promise against the real data layer:
 *
 *   node --import ./scripts/lib/app-loader.mjs scripts/test-santa-privacy.mts
 *
 * A member can never see who drew them, and never see anyone else's match.
 * Checked on memberView — everything a member's page is given — for every
 * member of a drawn exchange, before and after they reveal, with messages
 * flowing both ways in every pair. Also the organiser's dashboard data, the
 * thread limits, and the anonymous-reservation check.
 *
 * Runs on a throwaway SQLite file, migrated from drizzle/ like production.
 */
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { MemberView } from "../src/lib/secret-santa.ts";

const file = path.join(tmpdir(), `unwrap-santa-privacy-${process.pid}.db`);
process.env.DATABASE_URL = `file:${file}`;
process.env.DB_AUTO_MIGRATE = "1";

const { eq } = await import("drizzle-orm");
const { db } = await import("../src/db/index.ts");
const schema = await import("../src/db/schema.ts");
const santa = await import("../src/lib/secret-santa.ts");
const { jar } = (await import("next/headers")) as unknown as { jar: Map<string, string> };

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail !== undefined) console.log(`      ${JSON.stringify(detail).slice(0, 500)}`);
}

/** Pretend to be the browser holding this member's private link, and nobody else. */
function as(code: string, token: string | null) {
  jar.clear();
  if (token) jar.set(`unwrap_santa_${code}`, token);
}

try {
  // --- An exchange of seven, two kept apart, everyone with a wishlist --------
  const organizer = db
    .insert(schema.users)
    .values({ handle: "olive", email: "olive@example.com", name: "Olive", passwordHash: "x" })
    .returning()
    .get();
  const code = "Test777";
  const exchange = db
    .insert(schema.santaExchanges)
    .values({ organizerId: organizer.id, code, name: "Privacy test", budgetCents: 2500 })
    .returning()
    .get();

  // Distinct names that aren't substrings of each other or of anything else on
  // the page, so finding one in a view means something.
  const names = ["Alvarez", "Brightwater", "Castellanos", "Dunmore", "Eckhardt", "Fairweather", "Gallagher"];
  const members = names.map((name) => {
    const joined = santa.addParticipant(exchange.id, name, null);
    if (joined.outcome !== "joined") throw new Error(`could not add ${name}`);
    const row = db
      .select()
      .from(schema.santaParticipants)
      .where(eq(schema.santaParticipants.name, name))
      .get()!;
    const list = db
      .insert(schema.lists)
      .values({ slug: `list-${name.toLowerCase()}`, shortCode: `L${name.slice(0, 6)}`, name: `${name} list`, surpriseMode: true })
      .returning()
      .get();
    db.update(schema.santaParticipants)
      .set({ wishlistId: list.id })
      .where(eq(schema.santaParticipants.id, row.id))
      .run();
    return { name, id: row.id, token: joined.token, listId: list.id };
  });

  const [a, b] = [members[0].id, members[1].id].sort();
  db.insert(schema.santaExclusions).values({ exchangeId: exchange.id, firstId: a, secondId: b }).run();

  check("the draw runs", santa.runDraw(exchange.id) === "drawn");

  // Ground truth, read here and only here.
  const pairs = db.select().from(schema.santaAssignments).all();
  const byId = new Map(members.map((m) => [m.id, m]));
  const receiverOf = new Map(pairs.map((p) => [p.giverId, byId.get(p.receiverId)!]));
  const giverOf = new Map(pairs.map((p) => [p.receiverId, byId.get(p.giverId)!]));
  check("the excluded pair didn't draw each other", receiverOf.get(members[0].id)!.id !== members[1].id && receiverOf.get(members[1].id)!.id !== members[0].id);

  const resolved = (await santa.resolveExchange(code))!;
  const secretIds = [...members.map((m) => m.id), ...pairs.map((p) => p.id)];

  async function viewOf(member: (typeof members)[number]) {
    as(code, member.token);
    const participant = await santa.currentParticipant(resolved.exchange);
    if (participant?.id !== member.id) throw new Error(`cookie didn't identify ${member.name}`);
    return santa.memberView(await santa.resolveExchange(code).then((r) => r!), participant);
  }

  /** The view with the parts that legitimately name everyone taken out. */
  function withoutRoster(view: MemberView) {
    // Undefined properties are left out of the JSON.
    return JSON.stringify({ ...view, roster: undefined, organizerName: undefined, me: undefined });
  }

  // --- Before anyone reveals --------------------------------------------------
  for (const member of members) {
    const view = await viewOf(member);
    const json = JSON.stringify(view);
    const others = withoutRoster(view);
    check(`${member.name}: no match before revealing`, view.match === null && view.threads.withReceiver === null);
    check(`${member.name}: no ids of people or pairs in the view`, !secretIds.some((id) => json.includes(id)));
    check(
      `${member.name}: nobody's name outside the roster before revealing`,
      !names.some((name) => name !== member.name && others.includes(name)),
      others,
    );
    check(`${member.name}: not yet the Santa for anyone's list`, !(await santa.isSantaFor(receiverOf.get(member.id)!.listId)));
  }

  // --- Everyone reveals, and writes both ways ---------------------------------
  const bodies = new Map<string, { giver: string; receiver: string }>();
  for (const member of members) {
    as(code, member.token);
    const participant = (await santa.currentParticipant(resolved.exchange))!;
    await santa.revealMatch(participant);
  }
  const drawn = (await santa.resolveExchange(code))!;
  for (const member of members) {
    as(code, member.token);
    const participant = (await santa.currentParticipant(drawn.exchange))!;
    const toReceiver = `note-${randomUUID()}`;
    const toSanta = `note-${randomUUID()}`;
    check(`${member.name}: can write to the person they drew`, (await santa.postMessage(participant, drawn.exchange, "receiver", toReceiver)) === "sent");
    check(`${member.name}: can write to their Santa`, (await santa.postMessage(participant, drawn.exchange, "santa", toSanta)) === "sent");
    bodies.set(member.id, { giver: toReceiver, receiver: toSanta });
  }
  const allBodies = [...bodies.values()].flatMap((b) => [b.giver, b.receiver]);

  for (const member of members) {
    const view = await viewOf(member);
    const json = JSON.stringify(view);
    const others = withoutRoster(view);
    const receiver = receiverOf.get(member.id)!;
    const santaOf = giverOf.get(member.id)!;

    check(`${member.name}: sees exactly who they drew`, view.match?.name === receiver.name, view.match);
    check(`${member.name}: no ids of people or pairs in the view`, !secretIds.some((id) => json.includes(id)));

    // The only name the view may carry, beyond the roster, is their match. If
    // their Santa is also the person they drew, that name is there as their
    // match and says nothing about the draw in the other direction.
    // Their own name is there too, in their wishlist's.
    const named = names.filter((name) => name !== member.name && others.includes(name));
    check(
      `${member.name}: the only name outside the roster is their match`,
      named.length === 1 && named[0] === receiver.name,
      named,
    );
    if (santaOf.id !== receiver.id) {
      check(`${member.name}: their Santa's name is nowhere but the roster`, !others.includes(santaOf.name));
    }

    // Their two threads, and nobody else's.
    const expected = new Set([
      bodies.get(member.id)!.giver, // they wrote to their receiver
      bodies.get(receiver.id)!.receiver, // their receiver wrote to their Santa: them
      bodies.get(member.id)!.receiver, // they wrote to their Santa
      bodies.get(santaOf.id)!.giver, // their Santa wrote to them
    ]);
    const seen = allBodies.filter((body) => json.includes(body));
    check(
      `${member.name}: sees their own two threads and no one else's`,
      seen.length === expected.size && seen.every((body) => expected.has(body)),
      { seen: seen.length, expected: expected.size },
    );

    const fromSanta = view.threads.withSanta ?? [];
    check(
      `${member.name}: messages from their Santa carry no sender`,
      fromSanta.every((message) => Object.keys(message).sort().join() === "at,body,id,mine,reportedByMe"),
      fromSanta.map((message) => Object.keys(message)),
    );

    check(`${member.name}: is the Santa for their receiver's list`, await santa.isSantaFor(receiver.listId));
    const otherLists = members.filter((m) => m.id !== receiver.id).map((m) => m.listId);
    let anyOther = false;
    for (const listId of otherLists) anyOther ||= await santa.isSantaFor(listId);
    check(`${member.name}: is nobody else's Santa`, !anyOther);
  }

  // --- The organiser's dashboard data -----------------------------------------
  const dashboard = JSON.stringify({
    people: await santa.exchangeParticipants(exchange.id),
    exclusions: await santa.exchangeExclusions(exchange.id),
  });
  check("the dashboard data has no pair ids", !pairs.some((p) => dashboard.includes(p.id)));
  check("the dashboard data has no messages", !allBodies.some((body) => dashboard.includes(body)));
  check(
    "the dashboard data has no field that could hold a match",
    !/receiver|giver|assignment|match/i.test(dashboard),
  );

  // --- A stranger --------------------------------------------------------------
  as(code, null);
  check("a browser with no link is nobody", (await santa.currentParticipant(drawn.exchange)) === null);
  as(code, "made-up-token");
  check("a made-up token is nobody", (await santa.currentParticipant(drawn.exchange)) === null);

  // --- Thread limits and reports -------------------------------------------------
  const first = members[2];
  as(code, first.token);
  const firstRow = (await santa.currentParticipant(drawn.exchange))!;
  check("an empty message is refused", (await santa.postMessage(firstRow, drawn.exchange, "receiver", "   ")) === "empty");
  check(
    "a message over the limit is refused",
    (await santa.postMessage(firstRow, drawn.exchange, "receiver", "x".repeat(santa.MAX_MESSAGE + 1))) === "too-long",
  );
  let outcome = "";
  for (let i = 0; i < 12 && outcome !== "too-fast"; i += 1) {
    outcome = await santa.postMessage(firstRow, drawn.exchange, "receiver", `burst ${i}`);
  }
  check("a burst of messages is slowed down", outcome === "too-fast");

  const ownMessage = db
    .select()
    .from(schema.santaMessages)
    .where(eq(schema.santaMessages.senderId, first.id))
    .get()!;
  check("you can't report your own message", (await santa.reportMessage(firstRow, ownMessage.id)) === "own");

  const fromTheirSanta = db
    .select()
    .from(schema.santaMessages)
    .where(eq(schema.santaMessages.senderId, giverOf.get(first.id)!.id))
    .all()
    .find((m) => m.fromGiver)!;
  check("you can report a message sent to you", (await santa.reportMessage(firstRow, fromTheirSanta.id)) === "reported");

  const elsewhere = db
    .select()
    .from(schema.santaMessages)
    .all()
    .find((m) => m.senderId !== first.id && m.senderId !== giverOf.get(first.id)!.id && m.senderId !== receiverOf.get(first.id)!.id)!;
  check("you can't report a message from someone else's thread", (await santa.reportMessage(firstRow, elsewhere.id)) === "missing");

  // --- A redraw starts every thread again ---------------------------------------
  santa.resetDraw(exchange.id);
  check("the redraw runs", santa.runDraw(exchange.id) === "drawn");
  const after = await viewOf(first);
  check("after a redraw: no match until they reveal again", after.match === null);
  check("after a redraw: they're told they looked at an old draw", after.me.lookedBeforeRedraw);
  check(
    "after a redraw: the old messages are gone",
    !allBodies.some((body) => JSON.stringify(after).includes(body)),
  );
} finally {
  // Windows won't delete a database file that is still open.
  (globalThis as { __sqlite?: { close(): void } }).__sqlite?.close();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
}

console.log(failures === 0 ? "\nAll passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
