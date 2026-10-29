import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, emptyBag, FIXED_DT, Health, IDLE_INPUT, JOIN_RANGE_TILES, type Character,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { MAX_BATTLE_PLAYERS } from "../../../src/core/battle/room.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import { LAG_SLACK_TILES, type GameSession } from "../../../src/core/game/session.js";
import type { Account } from "../../../src/core/ports.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { OverworldActor } from "../../../src/core/overworld/components.js";
import { ACCOUNT, findBoar } from "./helpers.js";

before(() => initPhysics());

const LEVEL = getLevel(START_LEVEL);
const BOAR_SPAWN = LEVEL.spawns.find((s) => s.enemy === "wild-boar")!;
const BAG = addItem(emptyBag(), "boar-meat", 3).bag;
const ACCOUNTS: Account[] = [ACCOUNT, ...[2, 3, 4, 5, 6].map((n) => ({ id: `player-${n}`, username: `p${n}` }))];
const characterOf = (i: number): Character => ({ ...TEST_CHARACTER, name: `Player ${i + 1}` });

async function players(count = 2) {
  const store = new MemoryPlayerStore();
  ACCOUNTS.slice(0, count).forEach((account, i) => {
    store.saved.set(account.id, { ...newPlayer(), character: characterOf(i), bag: BAG });
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

  test("a joiner who dies loses their bag and wakes at the start; the host fights on", async () => {
    const { online, host, guest, all } = await hosting();
    guest.joinBattle();
    play(online, [host, guest], 3);
    const fight = host.battle!.room.fight;
    fight.world.require(fight.players[1]!, Health).hp = 0;
    play(online, [host, guest], 2);
    const result = all[1]!.link.last("battleResult");
    assert.equal(result.won, false);
    assert.equal(guest.bag.items.length, 0);
    assert.deepEqual(result.me, { x: LEVEL.spawn.x, z: LEVEL.spawn.z });
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
    assert.equal(store.saved.get(ACCOUNTS[1]!.id)?.bag.items.length, 0);
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
    assert.equal(boars(host!), 0);
  });
});

const boars = (session: GameSession) =>
  [...session.overworld.world.query(OverworldActor)].filter(([, a]) => a.kind === "wild-boar").length;
