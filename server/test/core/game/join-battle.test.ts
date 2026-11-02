import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, bagCounts, emptyBag, FIXED_DT, Health, IDLE_INPUT, JOIN_RANGE_TILES, type Character, type EnemyId,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { rollDrops } from "../../../src/core/enemies/index.js";
import { MAX_BATTLE_PLAYERS } from "../../../src/core/battle/room.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import { LAG_SLACK_TILES, type GameSession } from "../../../src/core/game/session.js";
import type { Account } from "../../../src/core/ports.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { OverworldActor, OverworldPos } from "../../../src/core/overworld/components.js";
import { ACCOUNT, findBoar, pileAt } from "./helpers.js";

before(() => initPhysics());

// The Grass Field: one boar and a Kobold, where these tests count the actors.
const LEVEL = getLevel("grass-field");
const BOAR_SPAWN = LEVEL.spawns.find((s) => s.enemy === "wild-boar")!;
const BAG = addItem(emptyBag(), "boar-meat", 3).bag;
const ACCOUNTS: Account[] = [ACCOUNT, ...[2, 3, 4, 5, 6].map((n) => ({ id: `player-${n}`, username: `p${n}` }))];
const characterOf = (i: number): Character => ({ ...TEST_CHARACTER, name: `Player ${i + 1}` });

async function players(count = 2) {
  const store = new MemoryPlayerStore();
  ACCOUNTS.slice(0, count).forEach((account, i) => {
    store.saved.set(account.id, { ...newPlayer(), character: characterOf(i), bag: BAG, level: LEVEL.layout.id });
  });
  const online = new OnlinePlayers(store, true, 50);
  const all: { link: FakeLink; session: GameSession }[] = [];
  for (const account of ACCOUNTS.slice(0, count)) {
    const link = new FakeLink();
    const session = await online.join(link, account);
    assert.ok(session);
    all.push({ link, session });
  }
  return { online, store, all };
}

const place = (session: GameSession, at: { x: number; z: number }) => session.overworld.place(session.me, at);
const nextTo = (host: GameSession, by: number) => {
  const at = host.overworld.playerPos(host.me);
  return { x: at.x + by, z: at.z };
};

function play(online: OnlinePlayers, sessions: GameSession[], n = 1): void {
  for (let i = 0; i < n; i++) {
    for (const s of sessions) {
      const battle = s.battle;
      if (!battle || battle.over) continue;
      const step = battle.room.fight.steps + 1;
      s.battleInput(step, [{ step, ...IDLE_INPUT }]);
    }
    online.tick(FIXED_DT);
  }
}

async function hosting(count = 2) {
  const all = await players(count);
  const [host, ...rest] = all.all.map((p) => p.session);
  host!.cheat({ kind: "encounter", enemy: "wild-boar" });
  for (const s of rest) place(s, nextTo(host!, 1));
  play(all.online, [host!], 3);
  return { ...all, host: host!, guest: rest[0]! };
}

describe("joining another player's battle", () => {
  test("near their fighting marker, you're put in their battle as the next player", async () => {
    const { host, guest, all } = await hosting();
    guest.joinBattle();
    assert.equal(guest.battle?.room, host.battle?.room);
    assert.equal(guest.battle?.seat, 1);
    const encounter = all[1]!.link.last("encounter");
    assert.equal(encounter.seat, 1);
    assert.equal(encounter.setup.players.length, 2);
    assert.equal(encounter.setup.players[1]!.who?.name, characterOf(1).name);
    assert.equal(encounter.joined?.fight.players.length, 2);
    assert.equal(all[0]!.link.last("battleJoined").player.who?.name, characterOf(1).name);
    assert.equal(guest.overworld.playerData(guest.me).fighting, true);
  });

  test("the reach has the same slack for lag as resting", async () => {
    const { guest, host } = await hosting();
    place(guest, nextTo(host, JOIN_RANGE_TILES + LAG_SLACK_TILES - 0.05));
    guest.joinBattle();
    assert.ok(guest.battle);
  });

  test("out of reach, nothing happens but a notice", async () => {
    const { all, guest, host } = await hosting();
    place(guest, nextTo(host, JOIN_RANGE_TILES + LAG_SLACK_TILES + 0.2));
    guest.joinBattle();
    assert.equal(guest.battle, null);
    assert.deepEqual(all[1]!.link.last("joinRefused"), { t: "joinRefused", reason: "nobodyNear" });
  });

  test("a duel can't be joined", async () => {
    const { online, all } = await players(3);
    const [a, b, c] = all.map((p) => p.session);
    a!.challenge();
    b!.answerChallenge(true);
    online.tick(FIXED_DT);
    place(c!, nextTo(a!, 1));
    c!.joinBattle();
    assert.equal(c!.battle, null);
    assert.equal(all[2]!.link.last("joinRefused").reason, "duel");
  });

  test(`a battle with ${MAX_BATTLE_PLAYERS} players in it is full`, async () => {
    const { all } = await hosting(MAX_BATTLE_PLAYERS + 1);
    const joiners = all.slice(1).map((p) => p.session);
    for (const s of joiners) s.joinBattle();
    assert.deepEqual(joiners.map((s) => s.battle !== null), [true, true, true, false]);
    assert.equal(all.at(-1)!.link.last("joinRefused").reason, "full");
  });
});

describe("a battle fought together", () => {
  test("won: each of them counts a win and gets a result of their own", async () => {
    const { online, host, guest, all } = await hosting();
    guest.joinBattle();
    play(online, [host, guest], 3);
    const fight = host.battle!.room.fight;
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(online, [host, guest], 2);
    for (const { link, session } of all) {
      assert.equal(link.last("battleResult").won, true);
      assert.equal(session.wins, 1);
    }
  });

  test("won: the enemy's drops are rolled once for the fight, in one pile where it fell, for any of them", async (t) => {
    t.mock.method(Math, "random", () => 0);
    const { online, host, guest } = await hosting();
    guest.joinBattle();
    play(online, [host, guest], 3);
    const fight = host.battle!.room.fight;
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(online, [host, guest], 2);
    const { drops } = host.battle!;
    assert.equal(guest.battle!.drops, drops);
    assert.equal(drops.piles.length, 1);
    assert.deepEqual(bagCounts(host.overworld.pileItems(drops.piles[0]!.pile)!), rollDrops("wild-boar", () => 0));
  });

  test("won: the leftovers land on the overworld only when the last winner leaves the arena", async (t) => {
    t.mock.method(Math, "random", () => 0);
    const { online, host, guest } = await hosting();
    const home = { ...host.overworld.playerPos(host.me) };
    guest.joinBattle();
    play(online, [host, guest], 3);
    const fight = host.battle!.room.fight;
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(online, [host, guest], 2);
    const { pile } = host.battle!.drops.piles[0]!;
    host.leaveBattle();
    play(online, [guest], 3);
    assert.equal(pileAt(host.overworld, home), null);
    guest.leaveBattle();
    assert.equal(pileAt(host.overworld, home), pile);
  });

  test("a fight already won can't be joined", async () => {
    const { online, all, host } = await hosting(3);
    const fight = host.battle!.room.fight;
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(online, [host], 2);
    const late = all[2]!.session;
    place(late, nextTo(host, 1));
    late.joinBattle();
    assert.equal(late.battle, null);
    assert.equal(all[2]!.link.last("joinRefused").reason, "nobodyNear");
  });

  test("a joiner who dies loses their bag and wakes on the start level's pad; the host fights on", async () => {
    const { online, host, guest, all } = await hosting();
    guest.joinBattle();
    play(online, [host, guest], 3);
    const fight = host.battle!.room.fight;
    fight.world.require(fight.players[1]!, Health).hp = 0;
    play(online, [host, guest], 2);
    const result = all[1]!.link.last("battleResult");
    assert.equal(result.won, false);
    assert.equal(bagCounts(guest.bag)["boar-meat"], undefined);
    assert.deepEqual(result.me, getLevel(START_LEVEL).spawn);
    assert.equal(host.battle?.over, false);
    assert.equal(all[0]!.link.all("battleResult").length, 0);
  });

  test("a joiner who disconnects has lost (LEAVING_LOSES); the host fights on", async () => {
    const { online, store, host, guest } = await hosting();
    guest.joinBattle();
    play(online, [host, guest], 3);
    online.leave(guest);
    play(online, [host], 3);
    assert.equal(host.battle?.over, false);
    assert.equal(bagCounts(store.saved.get(ACCOUNTS[1]!.id)!.bag)["boar-meat"], undefined);
  });

  test("the enemy stays gone while anyone still fights it, though its first fighter fell", async () => {
    const { online, all } = await players(2);
    const [host, guest] = all.map((p) => p.session);
    const { pos } = findBoar(host!);
    place(host!, pos);
    online.tick(FIXED_DT);
    assert.ok(host!.battle);
    place(guest!, nextTo(host!, 1));
    guest!.joinBattle();
    const fight = host!.battle!.room.fight;
    fight.world.require(fight.players[0]!, Health).hp = 0;
    play(online, [host!, guest!], 2);
    assert.equal(host!.battle!.over, true);
    play(online, [guest!], Math.ceil(BOAR_SPAWN.respawnTime / FIXED_DT) + 5);
    assert.equal(guest!.battle?.over, false);
    assert.equal(actors(host!), 0);
  });
});

describe("one of a battle's players leaving it", () => {
  /** Everyone invulnerable, so only the test ends the fight: the host touched the boar, the guest joined them. */
  async function boarFight(count = 2) {
    const all = await players(count);
    const sessions = all.all.map((p) => p.session);
    const [host, guest] = sessions as [GameSession, GameSession];
    for (const s of sessions) s.cheat({ kind: "invulnerable", on: true });
    place(host, findBoar(host).pos);
    all.online.tick(FIXED_DT);
    assert.ok(host.battle);
    place(guest, nextTo(host, 1));
    guest.joinBattle();
    play(all.online, [host, guest], 3);
    return { ...all, host, guest, fight: host.battle.room.fight };
  }

  test("the host disconnecting has lost; the guest fights on, the boar stays gone, and others may join", async () => {
    const { online, store, all, host, guest } = await boarFight(3);
    online.leave(host);
    assert.equal(bagCounts(store.saved.get(ACCOUNTS[0]!.id)!.bag)["boar-meat"], undefined);
    play(online, [guest], stepsFor(BOAR_SPAWN.respawnTime));
    assert.equal(guest.battle?.over, false);
    assert.equal(actors(guest), 0);

    const third = all[2]!.session;
    place(third, nextTo(guest, 1));
    play(online, [guest], 3);
    assert.equal(all[2]!.link.last("state").players.find((p) => p.id === guest.me)?.fighting, true);
    third.joinBattle();
    assert.equal(third.battle?.room, guest.battle?.room);
  });

  test("won after the host disconnected: the boar comes back respawnTime after the win", async () => {
    const { online, host, guest, fight, all } = await boarFight();
    online.leave(host);
    play(online, [guest], stepsFor(BOAR_SPAWN.respawnTime / 2));
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(online, [guest], 2);
    assert.equal(all[1]!.link.last("battleResult").won, true);
    guest.leaveBattle();
    play(online, [], stepsFor(BOAR_SPAWN.respawnTime) - 10);
    assert.equal(actors(guest), 0);
    play(online, [], 15);
    assert.equal(actors(guest), 1);
  });

  test("a host who fell and walked back: their next fight's enemy stays gone when the first fight is won", async () => {
    const { online, host, guest, fight } = await boarFight();
    fight.world.require(fight.players[0]!, Health).hp = 0;
    play(online, [host, guest], 2);
    host.leaveBattle();
    for (const to of ["market-ward", LEVEL.layout.id]) {
      const gate = host.overworld.level.exits.find((e) => e.to === to)!.area;
      place(host, { x: gate.x + gate.w / 2, z: gate.z + gate.h / 2 });
      online.tick(FIXED_DT);
    }
    assert.equal(host.overworld.level, LEVEL);
    host.overworld.playerData(host.me).safeTime = 0;
    place(host, actorAt(host, KOBOLD));
    online.tick(FIXED_DT);
    assert.equal(host.battle?.room.setup.enemies[0]?.def.id, KOBOLD);

    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(online, [host, guest], stepsFor(KOBOLD_SPAWN.respawnTime));
    assert.equal(guest.battle?.over, true);
    assert.equal(host.battle?.over, false);
    assert.equal(actors(host, KOBOLD), 0);
  });

  test("a guest who disconnects: the host fights on, wins, and the boar comes back after", async () => {
    const { online, host, guest, fight, all } = await boarFight();
    online.leave(guest);
    play(online, [host], stepsFor(BOAR_SPAWN.respawnTime));
    assert.equal(actors(host), 0);
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    play(online, [host], 2);
    assert.equal(all[0]!.link.last("battleResult").won, true);
    host.leaveBattle();
    play(online, [], stepsFor(BOAR_SPAWN.respawnTime));
    assert.equal(actors(host), 1);
  });
});

const KOBOLD = "kobold-swordsman";
const KOBOLD_SPAWN = LEVEL.spawns.find((s) => s.enemy === KOBOLD)!;
const stepsFor = (seconds: number) => Math.ceil(seconds / FIXED_DT) + 5;

const actors = (session: GameSession, kind: EnemyId = "wild-boar") =>
  [...session.overworld.world.query(OverworldActor)].filter(([, a]) => a.kind === kind).length;

function actorAt(session: GameSession, kind: EnemyId) {
  const found = [...session.overworld.world.query(OverworldActor, OverworldPos)].find(([, a]) => a.kind === kind);
  assert.ok(found, `no ${kind} on the overworld`);
  return { ...found[2] };
}
