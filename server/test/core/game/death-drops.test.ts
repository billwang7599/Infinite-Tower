import assert from "node:assert/strict";
import { before, describe, test, type TestContext } from "node:test";
import {
  addItem, bagCounts, Body, distXZ, emptyBag, FIXED_DT, Health, IDLE_INPUT, NO_PILE, PlayerInput, starterEquipment,
  type Bag, type Equipment, type ItemCounts, type Vec2,
} from "@infinite-tower/shared";
import { initPhysics, MAX_FIGHT_TIME } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { rollDrops } from "../../../src/core/enemies/index.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { OverworldPos, Pile } from "../../../src/core/overworld/components.js";
import type { Overworld } from "../../../src/core/overworld/overworld.js";
import { PILE_LIFETIME_MS } from "../../../src/core/overworld/piles.js";
import type { Account } from "../../../src/core/ports.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { ACCOUNT, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const CARRIED: Bag = {
  ...emptyBag(),
  items: [
    { item: "boar-meat", count: 2, x: 0, y: 0, turned: false },
    { item: "boar-tusk", count: 1, x: 1, y: 0, turned: false },
    { item: "greatsword", count: 1, x: 5, y: 0, turned: false },
  ],
};
const BLADE_IN_HAND: Equipment = { ...starterEquipment(), rightHand: "kobold-blade" };
const DROPPED: ItemCounts = { "boar-meat": 2, "boar-tusk": 1, "kobold-blade": 1 };
const FIGHT_SPOT: Vec2 = { x: 3, z: 3 };

const fightOf = (session: GameSession) => session.battle!.room.fight;

const pilesOn = (overworld: Overworld) => [...overworld.world.query(Pile, OverworldPos)].map(([pile]) => pile);

const countsAt = (overworld: Overworld, at: Vec2): ItemCounts | null => {
  const pile = overworld.nearestPile(at, 0);
  return pile === null ? null : bagCounts(overworld.pileItems(pile)!);
};

function fighting(saved: { bag?: Bag; equipment?: Equipment } = {}) {
  const started = startSession({
    dev: true, saved: { bag: saved.bag ?? CARRIED, equipment: saved.equipment ?? BLADE_IN_HAND },
  });
  const { session } = started;
  session.overworld.place(session.me, FIGHT_SPOT);
  session.cheat({ kind: "encounter", enemy: "wild-boar" });
  step(session, 2);
  return started;
}

function step(session: GameSession, n = 1): void {
  for (let i = 0; i < n && session.battle && !session.battle.over; i++) {
    const next = fightOf(session).steps + 1;
    session.battleInput(next, [{ step: next, ...IDLE_INPUT }]);
    tick(session);
  }
}

function die(session: GameSession): void {
  const fight = fightOf(session);
  fight.world.require(fight.players[0]!, Health).hp = 0;
  step(session, 2);
}

describe("dying alone", () => {
  test("all but the starter kit lands as one pile where the fight began, listed in the result", () => {
    const { session, link } = fighting();
    die(session);
    assert.deepEqual(countsAt(session.overworld, FIGHT_SPOT), DROPPED);
    assert.equal(pilesOn(session.overworld).length, 1);
    assert.deepEqual(link.last("battleResult").lost, DROPPED);
    assert.deepEqual(bagCounts(session.bag), { greatsword: 1 });
  });

  test("the pile vanishes PILE_LIFETIME_MS after it lands", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const { session } = fighting();
    die(session);
    t.mock.timers.tick(PILE_LIFETIME_MS - 1);
    session.overworld.step(FIXED_DT);
    assert.notEqual(countsAt(session.overworld, FIGHT_SPOT), null);
    t.mock.timers.tick(1);
    session.overworld.step(FIXED_DT);
    assert.equal(countsAt(session.overworld, FIGHT_SPOT), null);
  });

  test("carrying only the starter kit, nothing is dropped", () => {
    const { session } = fighting({ bag: { ...CARRIED, items: CARRIED.items.slice(2) }, equipment: starterEquipment() });
    die(session);
    assert.deepEqual(pilesOn(session.overworld), []);
  });

  test("disconnecting mid-fight drops it all the same (LEAVING_LOSES)", () => {
    const { session } = fighting();
    const { overworld } = session;
    session.disconnect();
    assert.deepEqual(countsAt(overworld, FIGHT_SPOT), DROPPED);
  });

  test("a fight lost at MAX_FIGHT_TIME drops it all the same", () => {
    const { session } = fighting();
    fightOf(session).outcome.stateTime = MAX_FIGHT_TIME;
    step(session, 1);
    assert.deepEqual(countsAt(session.overworld, FIGHT_SPOT), DROPPED);
  });
});

const ACCOUNTS: Account[] = [ACCOUNT, { id: "player-2", username: "p2" }, { id: "player-3", username: "p3" }];
const BAG = addItem(emptyBag(), "boar-meat", 3).bag;

/** Everyone invulnerable, so only the test ends the fight: the host fighting the boar, the guest joined in. */
async function together(t: TestContext) {
  t.mock.method(Math, "random", () => 0);
  const store = new MemoryPlayerStore();
  ACCOUNTS.forEach((account, i) => {
    store.saved.set(account.id, { ...newPlayer(), character: { ...TEST_CHARACTER, name: `P${i}` }, bag: BAG });
  });
  const online = new OnlinePlayers(store, true, 50);
  const links: FakeLink[] = [], sessions: GameSession[] = [];
  for (const account of ACCOUNTS.slice(0, 2)) {
    const link = new FakeLink(), session = await online.join(link, account);
    assert.ok(session);
    session.cheat({ kind: "invulnerable", on: true });
    links.push(link);
    sessions.push(session);
  }
  const [host, guest] = sessions as [GameSession, GameSession];
  const home = { ...host.overworld.playerPos(host.me) };
  host.cheat({ kind: "encounter", enemy: "wild-boar" });
  guest.overworld.place(guest.me, { x: home.x + 1, z: home.z });
  guest.joinBattle();
  const fight = host.battle!.room.fight;
  const play = (n = 1) => {
    for (let i = 0; i < n; i++) {
      for (const s of sessions) {
        if (!s.battle || s.battle.over) continue;
        const next = fight.steps + 1;
        s.battleInput(next, [{ step: next, ...IDLE_INPUT }]);
      }
      online.tick(FIXED_DT);
    }
  };
  play(3);
  const posOf = (seat: number) => fight.world.require(fight.players[seat]!, Body).pos;
  const kill = (seat: number) => {
    fight.world.require(fight.players[seat]!, Health).hp = 0;
    play(2);
  };
  const winFight = () => {
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(2);
  };
  return { online, links, host, guest, home, fight, play, posOf, kill, winFight };
}

describe("dying while others fight on", () => {
  test("their things lie in the arena where they fell, not on the overworld", async (t) => {
    const { host, guest, posOf, kill } = await together(t);
    Object.assign(posOf(1), { x: 2, z: -1 });
    kill(1);
    const [lying] = host.battle!.drops.piles;
    assert.ok(lying);
    assert.ok(distXZ(lying.at, posOf(1)) < 0.02, "where they fell");
    assert.deepEqual(bagCounts(host.overworld.pileItems(lying.pile)!), { "boar-meat": 3 });
    assert.equal(bagCounts(guest.bag)["boar-meat"], undefined);
    assert.deepEqual(pilesOn(host.overworld), []);
  });

  test("the others can't open it mid-fight; once it's won, they take from it as from the enemy's", async (t) => {
    const { host, links, posOf, kill, winFight } = await together(t);
    kill(1);
    const fell = { x: posOf(1).x, z: posOf(1).z };
    const faceIt = () => {
      Object.assign(posOf(0), { x: fell.x, z: fell.z - 1 });
      Object.assign(fightOf(host).world.require(fightOf(host).players[0]!, PlayerInput), { aimX: 0, aimZ: 1 });
    };
    faceIt();
    host.openPile();
    assert.deepEqual(host.gear.pile, NO_PILE);
    winFight();
    assert.equal(links[0]!.last("arenaDrops").piles.length, 2, "theirs and the boar's");
    faceIt();
    host.openPile();
    assert.deepEqual(bagCounts(links[0]!.last("gear").gear.pile), { "boar-meat": 3 });
  });

  test("disconnecting mid-fight leaves them where they stood", async (t) => {
    const { online, host, guest, posOf, play } = await together(t);
    Object.assign(posOf(1), { x: -2, z: 1 });
    online.leave(guest);
    play(1);
    const [lying] = host.battle!.drops.piles;
    assert.ok(lying && distXZ(lying.at, { x: -2, z: 1 }) < 0.02);
    assert.deepEqual(bagCounts(host.overworld.pileItems(lying.pile)!), { "boar-meat": 3 });
  });

  test("the leftovers, theirs and the enemy's, land as one pile where the fight began", async (t) => {
    const { host, home, kill, winFight } = await together(t);
    kill(1);
    winFight();
    host.leaveBattle();
    const boar = rollDrops("wild-boar", () => 0);
    assert.deepEqual(countsAt(host.overworld, home), { ...boar, "boar-meat": (boar["boar-meat"] ?? 0) + 3 });
    assert.equal(pilesOn(host.overworld).length, 1);
  });

  test("everyone down: all of it lands where the fight began at once", async (t) => {
    const { host, home, kill } = await together(t);
    kill(1);
    kill(0);
    assert.deepEqual(countsAt(host.overworld, home), { "boar-meat": 6 });
    assert.equal(pilesOn(host.overworld).length, 1);
  });
});

describe("a duel", () => {
  test("is a spar: the one down drops nothing", async (t) => {
    t.mock.method(Math, "random", () => 0);
    const store = new MemoryPlayerStore();
    const online = new OnlinePlayers(store, true, 50);
    const sessions: GameSession[] = [];
    for (const [i, account] of ACCOUNTS.slice(0, 2).entries()) {
      store.saved.set(account.id, { ...newPlayer(), character: { ...TEST_CHARACTER, name: `P${i}` }, bag: BAG });
      sessions.push((await online.join(new FakeLink(), account))!);
    }
    const [a, b] = sessions as [GameSession, GameSession];
    b.overworld.place(b.me, a.overworld.playerPos(a.me));
    a.challenge();
    b.answerChallenge(true);
    online.tick(FIXED_DT);
    const fight = a.battle!.room.fight;
    fight.world.require(fight.players[1]!, Health).hp = 0;
    for (let i = 0; i < 3; i++) {
      for (const s of sessions) {
        if (!s.battle || s.battle.over) continue;
        const next = fight.steps + 1;
        s.battleInput(next, [{ step: next, ...IDLE_INPUT }]);
      }
      online.tick(FIXED_DT);
    }
    assert.equal(b.battle?.over, true);
    assert.deepEqual(pilesOn(a.overworld), []);
    assert.deepEqual(bagCounts(b.bag)["boar-meat"], 3);
  });
});
