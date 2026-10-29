import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, emptyBag, FIXED_DT, Health, IDLE_INPUT, type Character, type StepInput,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { CHALLENGE_RANGE_TILES, CHALLENGE_TIME } from "../../../src/core/game/duels.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import type { GameSession } from "../../../src/core/game/session.js";
import type { Account } from "../../../src/core/ports.js";
import { getArena, getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { ACCOUNT } from "./helpers.js";

before(() => initPhysics());

const B: Account = { id: "player-2", username: "bee" };
const C: Account = { id: "player-3", username: "sea" };
const B_CHARACTER: Character = { ...TEST_CHARACTER, name: "Bee" };
const C_CHARACTER: Character = { ...TEST_CHARACTER, name: "Sea" };
const LEVEL = getLevel(START_LEVEL);
const HURT = { hp: 40, stamina: 70 };
const BAG = addItem(emptyBag(), "boar-meat", 3).bag;

async function players() {
  const store = new MemoryPlayerStore();
  store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER, vitals: HURT, bag: BAG });
  store.saved.set(B.id, { ...newPlayer(), character: B_CHARACTER });
  store.saved.set(C.id, { ...newPlayer(), character: C_CHARACTER });
  const online = new OnlinePlayers(store, true, 50);
  const join = async (account: Account) => {
    const link = new FakeLink();
    const session = await online.join(link, account);
    assert.ok(session);
    return { link, session };
  };
  const a = await join(ACCOUNT), b = await join(B), c = await join(C);
  place(c.session, { x: LEVEL.spawn.x + 10, z: LEVEL.spawn.z });
  return { online, store, a, b, c };
}

const ticks = (online: OnlinePlayers, n: number) => { for (let i = 0; i < n; i++) online.tick(FIXED_DT); };
const place = (session: GameSession, at: { x: number; z: number }) => session.overworld.place(session.me, at);
const news = (link: FakeLink) => link.all("challengeNews").map((m) => m.news);
const lastNews = (link: FakeLink) => news(link).at(-1);

async function dueling() {
  const all = await players();
  const { online, a, b } = all;
  a.session.challenge();
  b.session.answerChallenge(true);
  a.session.battleInput(0, []);
  b.session.battleInput(0, []);
  online.tick(FIXED_DT);
  return all;
}

function runTo(online: OnlinePlayers, sessions: GameSession[], step: number): void {
  for (const s of sessions) s.battleInput(step, []);
  online.tick(FIXED_DT);
}

describe("challenging another player to a duel", () => {
  test("the nearest player within range is challenged: they're told who, and you whom", async () => {
    const { a, b } = await players();
    a.session.challenge();
    assert.deepEqual(lastNews(b.link), { kind: "received", from: TEST_CHARACTER.name });
    assert.deepEqual(lastNews(a.link), { kind: "sent", to: B_CHARACTER.name });
  });

  test("with nobody within range, nobody is challenged", async () => {
    const { a, b } = await players();
    place(b.session, { x: LEVEL.spawn.x + CHALLENGE_RANGE_TILES + 0.5, z: LEVEL.spawn.z });
    a.session.challenge();
    assert.deepEqual(lastNews(a.link), { kind: "nobodyNear" });
    assert.deepEqual(news(b.link), []);
  });

  test("a player in a battle can't be challenged", async () => {
    const { a, b } = await players();
    b.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    a.session.challenge();
    assert.deepEqual(lastNews(a.link), { kind: "nobodyNear" });
  });

  test("one open challenge per player: neither side of one can be in another", async () => {
    const { a, c } = await players();
    a.session.challenge();
    place(c.session, LEVEL.spawn);
    c.session.challenge();
    assert.equal(lastNews(c.link)?.kind, "busy");
    a.session.challenge();
    assert.deepEqual(lastNews(a.link), { kind: "busy", who: null });
  });

  test("declined: the challenger is told, and it's over", async () => {
    const { a, b } = await players();
    a.session.challenge();
    b.session.answerChallenge(false);
    assert.deepEqual(lastNews(a.link), { kind: "declined", by: B_CHARACTER.name });
    b.session.answerChallenge(true);
    assert.equal(a.session.battle, null);
  });

  test("unanswered, it expires after CHALLENGE_TIME, and both are told", async () => {
    const { online, a, b } = await players();
    a.session.challenge();
    ticks(online, Math.round(CHALLENGE_TIME / FIXED_DT) - 2);
    assert.equal(lastNews(b.link)?.kind, "received");
    ticks(online, 3);
    assert.deepEqual(lastNews(a.link), { kind: "expired", with: B_CHARACTER.name });
    assert.deepEqual(lastNews(b.link), { kind: "expired", with: TEST_CHARACTER.name });
    b.session.answerChallenge(true);
    assert.equal(b.session.battle, null);
  });

  test("the challenger gone, it's called off", async () => {
    const { online, a, b } = await players();
    a.session.challenge();
    online.leave(a.session);
    online.tick(FIXED_DT);
    assert.deepEqual(lastNews(b.link), { kind: "cancelled", with: TEST_CHARACTER.name });
  });
});

describe("a duel", () => {
  test("accepted, both go into one fight in an arena of their own, facing each other", async () => {
    const { a, b } = await players();
    a.session.challenge();
    b.session.answerChallenge(true);
    const ea = a.link.last("encounter"), eb = b.link.last("encounter");
    assert.equal(a.session.battle!.room, b.session.battle!.room);
    assert.deepEqual([ea.seat, eb.seat], [0, 1]);
    assert.deepEqual(ea.setup, eb.setup);
    assert.equal(ea.setup.duel, true);
    assert.deepEqual(ea.setup.enemies, []);
    assert.equal(ea.setup.players.length, 2);
    assert.equal(ea.setup.arena.look, getArena(LEVEL.duelArenaId).look);
    assert.equal(ea.setup.arena.look, "stone-ruins");
    assert.deepEqual(ea.setup.players.map((p) => p.who), [
      { name: TEST_CHARACTER.name, character: TEST_CHARACTER }, { name: B_CHARACTER.name, character: B_CHARACTER },
    ]);
    assert.equal(a.session.overworld.playerData(a.session.me).fighting, true);
    assert.equal(b.session.overworld.playerData(b.session.me).fighting, true);
  });

  test("the fight runs one step a tick, though both players' sessions tick", async () => {
    const { online, a, b } = await dueling();
    for (let step = 1; step <= 30; step++) runTo(online, [a.session, b.session], step);
    assert.equal(a.session.battle!.room.fight.steps, 30);
  });

  test("each player's inputs, as the server ran them, are passed on to the other", async () => {
    const { online, a, b } = await dueling();
    const moving: StepInput = { ...IDLE_INPUT, step: 2, moveX: 1 };
    a.session.battleInput(2, [moving]);
    b.session.battleInput(2, []);
    online.tick(FIXED_DT);
    online.tick(FIXED_DT);
    const relayed = b.link.all("battleInputs").flatMap((m) => m.inputs);
    assert.ok(relayed.some((r) => r.seat === 0 && r.changes.some((c) => c.step === 2 && c.moveX === 1)));
    assert.ok(!a.link.all("battleInputs").some((m) => m.inputs.some((r) => r.seat === 0)), "not back to its sender");
  });

  test("a spar: down to 0 HP ends it; nothing lost or gained, no wins, and both back as they came", async () => {
    const { online, a, b } = await dueling();
    const room = a.session.battle!.room;
    room.edit(1, (world, e) => { world.require(e, Health).hp = 0; });
    runTo(online, [a.session, b.session], 1);
    const ra = a.link.last("battleResult"), rb = b.link.last("battleResult");
    assert.equal(ra.won, true);
    assert.equal(rb.won, false);
    assert.equal(ra.duel, B_CHARACTER.name);
    assert.deepEqual([ra.wins, rb.wins], [0, 0]);
    assert.deepEqual(ra.vitals, HURT);
    assert.deepEqual(rb.vitals, newPlayer().vitals);
    assert.deepEqual([ra.loot, rb.loot, ra.lost, rb.lost], [{}, {}, {}, {}]);
    assert.deepEqual(ra.gear.bag, BAG);
    assert.deepEqual(rb.me, b.session.overworld.playerPos(b.session.me), "no waking at the start");
    assert.deepEqual(ra.me, a.session.overworld.playerPos(a.session.me));
  });

  test("leaving mid-duel forfeits it with nothing lost; the other wins", async () => {
    const { online, store, a, b } = await dueling();
    online.leave(a.session);
    runTo(online, [b.session], 1);
    runTo(online, [b.session], 2);
    assert.equal(b.link.last("battleResult").won, true);
    const saved = store.saved.get(ACCOUNT.id)!;
    assert.deepEqual(saved.vitals, HURT);
    assert.deepEqual(saved.bag, BAG);
  });

  test("back from the arena, both walk the overworld again", async () => {
    const { online, a, b } = await dueling();
    a.session.battle!.room.edit(1, (world, e) => { world.require(e, Health).hp = 0; });
    runTo(online, [a.session, b.session], 1);
    a.session.leaveBattle();
    b.session.leaveBattle();
    assert.equal(a.session.inOverworld && b.session.inOverworld, true);
    assert.equal(b.session.overworld.playerData(b.session.me).fighting, false);
  });
});
