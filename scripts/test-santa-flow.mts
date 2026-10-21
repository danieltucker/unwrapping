/**
 * Secret Santa end to end, through the same Server Actions and route handler
 * the forms and links use:
 *
 *   npm run test:santa-flow
 *
 * Each person is a browser with a cookie jar of their own, and every step goes
 * through what that browser could actually send — a form's fields, a private
 * link — so the checks on who is asking are exercised, not stepped around. Only
 * Next's transport is missing: no HTTP, no Origin check, no rendering. See
 * scripts/lib/app-hooks.mjs for what stands in for it.
 *
 * Covered: a small group from start to reveal, keeping couples apart, a set of
 * exclusions that can't be drawn (and one that would give a match away), a
 * member trying to leave after the draw, and a re-draw before and after
 * anyone has looked. Plus the authorization of every organiser control, the
 * pause switch, and the fixes from the October 2026 review.
 *
 * Runs on a throwaway SQLite file, migrated from drizzle/ like production.
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { SantaState } from "../src/lib/secret-santa.ts";

const file = path.join(tmpdir(), `unwrap-santa-flow-${process.pid}.db`);
process.env.DATABASE_URL = `file:${file}`;
process.env.DB_AUTO_MIGRATE = "1";
process.env.SESSION_SECRET ??= "test-secret-for-santa-flow";
delete process.env.SECRET_SANTA;

const { eq } = await import("drizzle-orm");
const { db } = await import("../src/db/index.ts");
const schema = await import("../src/db/schema.ts");
const santa = await import("../src/lib/secret-santa.ts");
const { createSession } = await import("../src/lib/session.ts");
const { createExchange } = await import("../src/app/secret-santa/new/actions.ts");
const { joinExchange } = await import("../src/app/secret-santa/[code]/actions.ts");
const manage = await import("../src/app/secret-santa/[code]/manage/actions.ts");
const mine = await import("../src/app/secret-santa/[code]/me/actions.ts");
const privateLink = await import("../src/app/secret-santa/p/[token]/route.ts");
const { jar } = (await import("next/headers")) as unknown as { jar: Map<string, string> };
const { RedirectSignal } = (await import("next/navigation")) as unknown as {
  RedirectSignal: new (location: string) => Error & { location: string };
};

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail !== undefined) console.log(`      ${JSON.stringify(detail).slice(0, 500)}`);
}
function section(title: string) {
  console.log(`\n--- ${title}`);
}

/* -------------------------------------------------------------------------- */
/* Browsers                                                                   */
/* -------------------------------------------------------------------------- */

/** One person's browser: a name for the test output, and its cookies. */
type Browser = { label: string; cookies: Map<string, string> };
const browser = (label: string): Browser => ({ label, cookies: new Map() });

/** Runs `fn` as a request from this browser, keeping whatever cookies it sets. */
async function from<T>(who: Browser, fn: () => Promise<T>): Promise<T> {
  jar.clear();
  for (const [name, value] of who.cookies) jar.set(name, value);
  try {
    return await fn();
  } finally {
    who.cookies = new Map(jar);
  }
}

type Outcome = SantaState & { redirect?: string };
type Action = (previous: SantaState, formData: FormData) => Promise<SantaState>;

/** Submits a form to a Server Action, as `who`. A redirect comes back as `redirect`. */
async function submit(who: Browser, action: Action, fields: Record<string, string>): Promise<Outcome> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return from(who, async () => {
    try {
      return await action({}, form);
    } catch (error) {
      if (error instanceof RedirectSignal) return { redirect: error.location };
      throw error;
    }
  });
}

/** Opens a private link, /secret-santa/p/<token>, in this browser. */
async function openLink(who: Browser, link: string): Promise<string> {
  const token = link.split("/secret-santa/p/")[1];
  return from(who, async () => {
    try {
      await privateLink.GET(new Request(`http://test${link}`), { params: Promise.resolve({ token }) } as never);
      return "no redirect";
    } catch (error) {
      if (error instanceof RedirectSignal) return error.location;
      throw error;
    }
  });
}

let userCount = 0;
/** A browser signed in to a new account. */
async function signedIn(name: string): Promise<Browser & { userId: string }> {
  userCount += 1;
  const user = db
    .insert(schema.users)
    .values({ handle: `${name.toLowerCase()}${userCount}`, email: `${name.toLowerCase()}${userCount}@example.com`, name, passwordHash: "x" })
    .returning()
    .get();
  const who = browser(name);
  await from(who, () => createSession(user.id));
  return { ...who, userId: user.id };
}

/* -------------------------------------------------------------------------- */
/* Reading what happened                                                      */
/* -------------------------------------------------------------------------- */

const exchangeByCode = (code: string) =>
  db.select().from(schema.santaExchanges).where(eq(schema.santaExchanges.code, code)).get()!;

/** Ground truth, which only a test may read: giver name → receiver name. */
function pairs(code: string): Map<string, string> {
  const exchange = exchangeByCode(code);
  const people = db.select().from(schema.santaParticipants).where(eq(schema.santaParticipants.exchangeId, exchange.id)).all();
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  return new Map(
    db.select().from(schema.santaAssignments).where(eq(schema.santaAssignments.exchangeId, exchange.id)).all()
      .map((a) => [nameOf.get(a.giverId)!, nameOf.get(a.receiverId)!]),
  );
}

/** Everyone gives once, receives once, and nobody has themselves. */
function isDerangement(draw: Map<string, string>, names: string[]): boolean {
  const receivers = new Set(draw.values());
  return (
    draw.size === names.length &&
    receivers.size === names.length &&
    names.every((name) => draw.has(name) && draw.get(name) !== name && receivers.has(name))
  );
}

/** What this browser's page for the exchange is given, exactly as the page gets it. */
async function viewOf(who: Browser, code: string) {
  return from(who, async () => {
    const resolved = (await santa.resolveExchange(code))!;
    const participant = await santa.currentParticipant(resolved.exchange);
    return participant ? santa.memberView(resolved, participant) : null;
  });
}

/** What the organiser's dashboard is given. */
async function dashboard(code: string) {
  const exchange = exchangeByCode(code);
  return { exchange, people: await santa.exchangeParticipants(exchange.id), exclusions: await santa.exchangeExclusions(exchange.id) };
}

const idOf = async (code: string, name: string) =>
  (await dashboard(code)).people.find((person) => person.name === name)!.id;

/** Starts an exchange as `organizer`, returning its code. */
async function start(organizer: Browser, name: string, takingPart = false): Promise<string> {
  const result = await submit(organizer, createExchange, { name, budget: "25", ...(takingPart ? { takingPart: "on" } : {}) });
  const code = result.redirect?.match(/^\/secret-santa\/([^/]+)\/manage/)?.[1];
  if (!code) throw new Error(`couldn't start ${name}: ${JSON.stringify(result)}`);
  return code;
}

/** Adds people from the dashboard, returning a browser per person that has opened their link. */
async function addPeople(organizer: Browser, code: string, names: string[]): Promise<Map<string, Browser>> {
  const out = new Map<string, Browser>();
  for (const name of names) {
    const added = await submit(organizer, manage.addPerson, { code, name });
    if (!added.link) throw new Error(`couldn't add ${name}: ${JSON.stringify(added)}`);
    const who = browser(name);
    await openLink(who, added.link);
    out.set(name, who);
  }
  return out;
}

const NOT_ORGANIZER = /couldn't confirm you organised/;
const NOT_IN = /couldn't tell who you are/;

try {
  /* ------------------------------------------------------------------------ */
  section("A small group, start to finish");
  /* ------------------------------------------------------------------------ */
  const olive = await signedIn("Olive");
  const code = await start(olive, "Tucker family Christmas", true);
  check("the organiser starts an exchange and lands on the dashboard", Boolean(code));
  check("the organiser is in it, under their account name", (await dashboard(code)).people.map((p) => p.name).join() === "Olive");

  const nobody = browser("signed-out");
  check(
    "a signed-out browser can't start one",
    /sign-in has run out/.test((await submit(nobody, createExchange, { name: "Nope" })).error ?? ""),
  );

  const ben = await signedIn("Ben");
  const benJoin = await submit(ben, joinExchange, { code, name: "Ben" });
  check("a signed-in person joins from the invite link", benJoin.redirect === `/secret-santa/${code}/me?joined=1`, benJoin);
  check("joining again goes to their page, not a second place", (await submit(ben, joinExchange, { code, name: "Ben again" })).redirect === `/secret-santa/${code}/me`);

  const cara = browser("Cara");
  check("a guest joins with just a name", (await submit(cara, joinExchange, { code, name: "  Cara  " })).redirect?.endsWith("?joined=1") === true);
  check("their private link is in a cookie for this exchange", cara.cookies.has(`unwrap_santa_${code}`));

  const mallory = browser("Mallory");
  const lookalike = await submit(mallory, joinExchange, { code, name: "Ca​ra" });
  check("a name differing only by an invisible character is taken", /already joined/.test(lookalike.error ?? ""), lookalike);
  const fullWidth = await submit(mallory, joinExchange, { code, name: "ＣＡＲＡ" });
  check("a full-width spelling of a name is taken", /already joined/.test(fullWidth.error ?? ""), fullWidth);
  check("a name made of nothing visible is refused", /Type your name/.test((await submit(mallory, joinExchange, { code, name: "​‍‮" })).error ?? ""));

  const added = await submit(olive, manage.addPerson, { code, name: "Dev" });
  check("the organiser adds someone and is handed their link once", Boolean(added.link?.includes("/secret-santa/p/")), added);
  const dev = browser("Dev");
  check("the link sets their cookie and moves on to their page", (await openLink(dev, added.link!)) === `/secret-santa/${code}/me`);
  check("a made-up link goes to the overview with a sentence", (await openLink(browser("guesser"), "/secret-santa/p/not-a-real-token")) === "/secret-santa?link=expired");

  // Every organiser control refuses someone who didn't organise it.
  const devId = await idOf(code, "Dev");
  const controls: [string, Action, Record<string, string>][] = [
    ["edit", manage.updateExchange, { code, name: "Hijacked" }],
    ["add a person", manage.addPerson, { code, name: "Intruder" }],
    ["remove a person", manage.removeParticipant, { code, participantId: devId }],
    ["replace a link", manage.resetPrivateLink, { code, participantId: devId }],
    ["keep two apart", manage.addExclusion, { code, firstId: devId, secondId: await idOf(code, "Cara") }],
    ["stop keeping two apart", manage.removeExclusion, { code, exclusionId: "x" }],
    ["draw", manage.drawExchange, { code }],
    ["reset the draw", manage.resetExchangeDraw, { code }],
    ["delete", manage.deleteExchange, { code }],
  ];
  for (const [label, action, fields] of controls) {
    const asMember = await submit(ben, action, fields);
    const asGuest = await submit(cara, action, fields);
    check(`a participant can't ${label}`, NOT_ORGANIZER.test(asMember.error ?? "") && NOT_ORGANIZER.test(asGuest.error ?? ""), { asMember, asGuest });
  }
  check("nothing changed while they tried", exchangeByCode(code).name === "Tucker family Christmas" && (await dashboard(code)).people.length === 4);

  // The draw.
  check("before the draw, nobody has a match", (await viewOf(cara, code))?.match === null);
  check("the organiser draws", (await submit(olive, manage.drawExchange, { code })).ok === true);
  check("drawing twice is refused, not repeated", /already been drawn/.test((await submit(olive, manage.drawExchange, { code })).error ?? ""));
  const names = ["Olive", "Ben", "Cara", "Dev"];
  const first = pairs(code);
  check("everyone gives once and gets once, never themselves", isDerangement(first, names), Object.fromEntries(first));
  check("joining after the draw is refused", /already been drawn/.test((await submit(browser("Late"), joinExchange, { code, name: "Late" })).error ?? ""));

  // Nobody sees anything until they ask, and then only their own.
  const people: [string, Browser][] = [["Olive", olive], ["Ben", ben], ["Cara", cara], ["Dev", dev]];
  for (const [name, who] of people) {
    check(`${name}: no match on the page before pressing the button`, (await viewOf(who, code))?.match === null);
    const reveal = await submit(who, mine.revealMatch, { code });
    check(`${name}: the button lands on the name`, reveal.redirect === `/secret-santa/${code}/me?revealed=1#match`, reveal);
    const view = await viewOf(who, code);
    check(`${name}: sees exactly who they drew`, view?.match?.name === first.get(name), view?.match);
  }
  const board = await dashboard(code);
  check("the dashboard knows everyone has looked", board.people.every((p) => santa.hasSeenCurrentDraw(board.exchange, p.seenDraw)));
  check("the dashboard carries nothing that could hold a match", !/receiver|giver|assignment|match/i.test(JSON.stringify(board.people)));

  // The anonymous thread.
  const caraGets = first.get("Cara")!;
  const caraSanta = [...first].find(([, receiver]) => receiver === "Cara")![0];
  check("Cara writes to the person she drew", (await submit(cara, mine.sendMessage, { code, to: "receiver", body: "Any sizes I should know?" })).ok === true);
  const hers = await viewOf(people.find(([n]) => n === caraGets)![1], code);
  check(
    "it arrives, unsigned, in her receiver's thread with their Santa",
    hers?.threads.withSanta?.some((m) => m.body === "Any sizes I should know?" && !m.mine) === true,
  );
  const bystander = people.find(([n]) => n !== "Cara" && n !== caraGets && n !== caraSanta);
  if (bystander) {
    const theirs = JSON.stringify(await viewOf(bystander[1], code));
    check("nobody else in the group sees it", !theirs.includes("Any sizes"));
  }
  check(
    "a message is stored without control or direction characters",
    (await submit(cara, mine.sendMessage, { code, to: "santa", body: "hi‮ereht\u0007" })).ok === true &&
      db.select().from(schema.santaMessages).all().some((m) => m.body === "hiereht"),
  );

  // Strangers, and people from other exchanges.
  const stranger = browser("stranger");
  for (const [label, action] of [["reveal", mine.revealMatch], ["message", mine.sendMessage], ["leave", mine.leaveExchange]] as const) {
    check(`a stranger can't ${label}`, NOT_IN.test((await submit(stranger, action, { code, to: "receiver", body: "hi" })).error ?? ""));
  }
  const other = await start(olive, "Office party");
  await addPeople(olive, other, ["Xena", "Yuri", "Zane"]);
  check("Ben's place in one exchange is nothing in another", NOT_IN.test((await submit(ben, mine.revealMatch, { code: other })).error ?? ""));
  const outsiderId = await idOf(other, "Xena");

  /* ------------------------------------------------------------------------ */
  section("Keeping couples apart");
  /* ------------------------------------------------------------------------ */
  const family = await start(olive, "Couples");
  const couple = ["Ann", "Bob", "Cat", "Dan", "Eve", "Fay"];
  await addPeople(olive, family, couple);
  const ids = Object.fromEntries(await Promise.all(couple.map(async (n) => [n, await idOf(family, n)] as const)));
  check("keep Ann and Bob apart", (await submit(olive, manage.addExclusion, { code: family, firstId: ids.Ann, secondId: ids.Bob })).ok === true);
  check("keep Cat and Dan apart", (await submit(olive, manage.addExclusion, { code: family, firstId: ids.Dan, secondId: ids.Cat })).ok === true);
  await submit(olive, manage.addExclusion, { code: family, firstId: ids.Bob, secondId: ids.Ann });
  check("the same pair the other way round isn't stored twice", (await dashboard(family)).exclusions.length === 2);
  check("someone can't be kept apart from themselves", /two different/.test((await submit(olive, manage.addExclusion, { code: family, firstId: ids.Eve, secondId: ids.Eve })).error ?? ""));
  check(
    "someone from another exchange can't be named",
    /has left/.test((await submit(olive, manage.addExclusion, { code: family, firstId: ids.Eve, secondId: outsiderId })).error ?? ""),
  );
  await submit(olive, manage.addExclusion, { code: other, firstId: outsiderId, secondId: await idOf(other, "Yuri") });
  const otherExclusion = (await dashboard(other)).exclusions[0];
  await submit(olive, manage.removeExclusion, { code: family, exclusionId: otherExclusion.id });
  check("removing a pair by an id from another exchange does nothing", db.select().from(schema.santaExclusions).where(eq(schema.santaExclusions.id, otherExclusion.id)).get() !== undefined);

  let respected = true;
  let drawsMade = 0;
  for (let round = 0; round < 25; round += 1) {
    if ((await submit(olive, manage.drawExchange, { code: family })).ok) drawsMade += 1;
    const draw = pairs(family);
    respected &&= isDerangement(draw, couple) &&
      draw.get("Ann") !== "Bob" && draw.get("Bob") !== "Ann" && draw.get("Cat") !== "Dan" && draw.get("Dan") !== "Cat";
    await submit(olive, manage.resetExchangeDraw, { code: family });
  }
  check(`25 draws, and no couple ever drew each other (${drawsMade} made)`, respected && drawsMade === 25);
  check("exclusions can't change once drawn", await (async () => {
    await submit(olive, manage.drawExchange, { code: family });
    return /already been drawn/.test((await submit(olive, manage.addExclusion, { code: family, firstId: ids.Eve, secondId: ids.Fay })).error ?? "");
  })());

  /* ------------------------------------------------------------------------ */
  section("Exclusions that can't be drawn");
  /* ------------------------------------------------------------------------ */
  const tiny = await start(olive, "Three of us");
  await addPeople(olive, tiny, ["Gus", "Hal"]);
  check("two people can't draw", /at least 3/.test((await submit(olive, manage.drawExchange, { code: tiny })).error ?? ""));
  await addPeople(olive, tiny, ["Ivy"]);
  await submit(olive, manage.addExclusion, { code: tiny, firstId: await idOf(tiny, "Gus"), secondId: await idOf(tiny, "Hal") });
  const impossible = await submit(olive, manage.drawExchange, { code: tiny });
  check("three people with one couple: refused with a reason", /no way to draw names/.test(impossible.error ?? ""), impossible);
  check("an impossible draw leaves it open, with nothing written", exchangeByCode(tiny).status === "open" && pairs(tiny).size === 0);
  await submit(olive, manage.removeExclusion, { code: tiny, exclusionId: (await dashboard(tiny)).exclusions[0].id });
  check("removing the pair makes it drawable", (await submit(olive, manage.drawExchange, { code: tiny })).ok === true);

  const four = await start(olive, "Give-away");
  await addPeople(olive, four, ["Jo", "Kim", "Lou", "Max"]);
  await submit(olive, manage.addExclusion, { code: four, firstId: await idOf(four, "Jo"), secondId: await idOf(four, "Kim") });
  await submit(olive, manage.addExclusion, { code: four, firstId: await idOf(four, "Jo"), secondId: await idOf(four, "Lou") });
  const predictable = await submit(olive, manage.drawExchange, { code: four });
  check("exclusions that leave someone one choice are refused", /wouldn't be a secret/.test(predictable.error ?? ""), predictable);
  check("a refused draw writes nothing", exchangeByCode(four).status === "open" && pairs(four).size === 0);

  /* ------------------------------------------------------------------------ */
  section("A member leaving after the draw");
  /* ------------------------------------------------------------------------ */
  const leavers = await start(olive, "Book club");
  const club = await addPeople(olive, leavers, ["Nia", "Oto", "Pam", "Quinn"]);
  const quinn = club.get("Quinn")!;
  await submit(olive, manage.drawExchange, { code: leavers });
  await submit(quinn, mine.revealMatch, { code: leavers });
  const leave = await submit(quinn, mine.leaveExchange, { code: leavers });
  check("leaving after the draw is refused, naming who can reset it", /already been drawn.*Olive/.test(leave.error ?? ""), leave);
  check(
    "the organiser can't remove them either",
    /already been drawn/.test((await submit(olive, manage.removeParticipant, { code: leavers, participantId: await idOf(leavers, "Quinn") })).error ?? ""),
  );
  check("the draw is intact: four givers, four receivers", isDerangement(pairs(leavers), ["Nia", "Oto", "Pam", "Quinn"]));
  check("Quinn still sees their match", (await viewOf(quinn, leavers))?.match !== null);

  check("the organiser resets the draw", (await submit(olive, manage.resetExchangeDraw, { code: leavers })).ok === true);
  const quinnToken = quinn.cookies.get(`unwrap_santa_${leavers}`)!;
  check("now Quinn can leave", (await submit(quinn, mine.leaveExchange, { code: leavers })).redirect === "/secret-santa");
  check("their cookie for the exchange is gone", !quinn.cookies.has(`unwrap_santa_${leavers}`));
  check("their old link now says it has expired", (await openLink(browser("Quinn again"), `/secret-santa/p/${quinnToken}`)) === "/secret-santa?link=expired");
  check("the rest draw again without them", (await submit(olive, manage.drawExchange, { code: leavers })).ok === true && isDerangement(pairs(leavers), ["Nia", "Oto", "Pam"]));

  /* ------------------------------------------------------------------------ */
  section("A re-draw before anyone has looked");
  /* ------------------------------------------------------------------------ */
  const redo = await start(olive, "Redo");
  const redoNames = ["Rae", "Sol", "Tia", "Uma", "Vic"];
  const redoPeople = await addPeople(olive, redo, redoNames);
  await submit(olive, manage.drawExchange, { code: redo });
  check("first draw made", exchangeByCode(redo).drawCount === 1 && pairs(redo).size === 5);
  const rae = redoPeople.get("Rae")!;
  await submit(rae, mine.sendMessage, { code: redo, to: "santa", body: "draw-one message" });

  await submit(olive, manage.resetExchangeDraw, { code: redo });
  check("a reset reopens it and throws the pairs away", exchangeByCode(redo).status === "open" && pairs(redo).size === 0);
  check("the first draw's messages go with it", !db.select().from(schema.santaMessages).all().some((m) => m.body === "draw-one message"));
  check("a reveal sent between reset and re-draw is refused", /haven't been drawn/.test((await submit(rae, mine.revealMatch, { code: redo })).error ?? ""));

  await submit(olive, manage.drawExchange, { code: redo });
  check("the re-draw is the second", exchangeByCode(redo).drawCount === 2 && isDerangement(pairs(redo), redoNames));
  let fresh = true;
  for (const [, who] of redoPeople) {
    const view = await viewOf(who, redo);
    fresh &&= view?.match === null && view?.seen === false && view?.me.lookedBeforeRedraw === false;
  }
  check("after it, nobody has a match, and nobody is told they looked before", fresh);
  const redoBoard = await dashboard(redo);
  check("the dashboard counts nobody as having looked", redoBoard.people.every((p) => !santa.hasSeenCurrentDraw(redoBoard.exchange, p.seenDraw)));
  await submit(rae, mine.revealMatch, { code: redo });
  check("revealing shows the new draw's match", (await viewOf(rae, redo))?.match?.name === pairs(redo).get("Rae"));

  section("A re-draw after someone has looked");
  await submit(olive, manage.resetExchangeDraw, { code: redo });
  await submit(olive, manage.drawExchange, { code: redo });
  const after = await viewOf(rae, redo);
  check("Rae has to reveal again", after?.match === null && after?.me.lookedBeforeRedraw === true);
  check("and can't write to anyone by name until she does", /See who you've got first/.test((await submit(rae, mine.sendMessage, { code: redo, to: "receiver", body: "hi" })).error ?? ""));

  /* ------------------------------------------------------------------------ */
  section("A replaced link, and keeping a place with an account");
  /* ------------------------------------------------------------------------ */
  const benLinkBefore = ben.cookies.get(`unwrap_santa_${code}`);
  await submit(olive, manage.resetExchangeDraw, { code });
  const reset = await submit(olive, manage.resetPrivateLink, { code, participantId: await idOf(code, "Ben") });
  check("the organiser can replace Ben's link", Boolean(reset.link));
  check("and everyone can see that it was", (await viewOf(cara, code))?.roster.find((p) => p.name === "Ben")?.linkResetAt != null);
  check("Ben's old link stops working", benLinkBefore !== undefined && (await openLink(browser("old"), `/secret-santa/p/${benLinkBefore}`)) === "/secret-santa?link=expired");
  check("Ben is still Ben through his account", (await viewOf(ben, code))?.me.name === "Ben");
  await openLink(olive, reset.link!);
  const takeover = await submit(olive, mine.keepWithAccount, { code });
  check("holding Ben's new link doesn't let the organiser move his place to her account", /different account/.test(takeover.error ?? ""), takeover);
  check("his place still belongs to his account", db.select().from(schema.santaParticipants).where(eq(schema.santaParticipants.name, "Ben")).get()?.userId === ben.userId);

  /* ------------------------------------------------------------------------ */
  section("Input");
  /* ------------------------------------------------------------------------ */
  const sneaky = await start(olive, "Ho‮ho\u0000 ho\nho");
  check("an exchange name loses control and direction characters", exchangeByCode(sneaky).name === "Hoho ho ho", exchangeByCode(sneaky).name);
  check("a long name is refused", /a little long/.test((await submit(olive, createExchange, { name: "x".repeat(81) })).error ?? ""));
  check("a budget that isn't a number is refused", /numbers only/.test((await submit(olive, createExchange, { name: "B", budget: "lots" })).error ?? ""));

  const rita = await signedIn("Rita");
  let started = 0;
  for (let i = 0; i < santa.NEW_EXCHANGES_PER_DAY; i += 1) {
    if ((await submit(rita, createExchange, { name: `Group ${i}` })).redirect) started += 1;
  }
  const overCap = await submit(rita, createExchange, { name: "One too many" });
  check(`${santa.NEW_EXCHANGES_PER_DAY} new exchanges a day, then a sentence`, started === santa.NEW_EXCHANGES_PER_DAY && /Try again tomorrow/.test(overCap.error ?? ""), { started, overCap });

  /* ------------------------------------------------------------------------ */
  section("The switch");
  /* ------------------------------------------------------------------------ */
  await submit(olive, manage.drawExchange, { code });
  process.env.SECRET_SANTA = "readonly";
  check("paused: nobody can join", /paused/.test((await submit(browser("New"), joinExchange, { code: tiny, name: "New" })).error ?? ""));
  check("paused: nobody can start one", /paused/.test((await submit(olive, createExchange, { name: "During" })).error ?? ""));
  check("paused: the organiser can't reset", /paused/.test((await submit(olive, manage.resetExchangeDraw, { code })).error ?? ""));
  check("paused: no messages", /paused/.test((await submit(cara, mine.sendMessage, { code, to: "receiver", body: "hi" })).error ?? ""));
  check("paused: people can still see who they've got", (await submit(cara, mine.revealMatch, { code })).redirect?.endsWith("#match") === true);
  process.env.SECRET_SANTA = "off";
  check("off: even revealing refuses", /isn't available/.test((await submit(cara, mine.revealMatch, { code })).error ?? ""));
  check("off: and every organiser control", /isn't available/.test((await submit(olive, manage.drawExchange, { code: four })).error ?? ""));
  process.env.SECRET_SANTA = "yes please";
  check("an unrecognised value is off", /isn't available/.test((await submit(olive, createExchange, { name: "typo" })).error ?? ""));
  delete process.env.SECRET_SANTA;
  check("unset is on, and the draw survived the switch", (await viewOf(cara, code))?.match?.name === pairs(code).get("Cara"));
} finally {
  // Windows won't delete a database file that is still open.
  (globalThis as { __sqlite?: { close(): void } }).__sqlite?.close();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
}

console.log(failures === 0 ? "\nAll passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
