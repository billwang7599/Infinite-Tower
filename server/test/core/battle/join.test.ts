import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health, IDLE_INPUT, type Character } from "@infinite-tower/shared";
import { initPhysics, joinStart, type FightSetup, type PlayerResult } from "@infinite-tower/shared/fight";
import { BattleRoom, MAX_BATTLE_PLAYERS } from "../../../src/core/battle/room.js";
import { FakeLink } from "../../fixtures/fakes.js";
import { setupWith } from "../../fixtures/fight.js";
import { TEST_CHARACTER } from "../../fixtures/world.js";

before(() => initPhysics());

const IDLE_MOVE = { ...IDLE_INPUT, moveX: 1 };

const who = (name: string): { name: string; character: Character } => ({ name, character: TEST_CHARACTER });

function shared(setup: FightSetup = setupWith()) {
  const links = [new FakeLink()];
  const ended: { seat: number; result: PlayerResult }[] = [];
  let overs = 0, closes = 0;
  const seat = (link: FakeLink, i: number) => ({ link, onEnd: (result: PlayerResult) => ended.push({ seat: i, result }) });
  const room = new BattleRoom(setup, [seat(links[0]!, 0)], { onOver: () => overs++, onClosed: () => closes++ });
  const join = (name = "Joiner") => {
    const link = new FakeLink();
    const at = room.join(seat(link, links.length), { ...setup.players[0]!, who: who(name) });
    if (at !== null) links.push(link);
    return at;
  };
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      links.forEach((_, s) => room.input(s, room.fight.steps + 1, []));
      room.tick();
    }
  };
  return { room, links, ended, join, tick, overs: () => overs, closes: () => closes };
}

describe("joining a battle under way", () => {
  test("the joiner is the next player, in at the arena's edge, and the room says who's in it now", () => {
    const { room, join, tick } = shared();
    tick(10);
    assert.equal(join(), 1);
    assert.equal(room.fight.players.length, 2);
    assert.deepEqual(room.setup.players[1]!.at, joinStart(room.fight.arena, 1));
    assert.equal(room.setup.players[1]!.who?.name, "Joiner");
  });

  test("the players already in it are told who joined, then get the fight with them in it", () => {
    const { room, links, join, tick } = shared();
    tick(10);
    links[0]!.sent.length = 0;
    join();
    assert.deepEqual(links[0]!.sent.map((m) => m.t), ["battleJoined", "battleSync"]);
    assert.deepEqual(links[0]!.last("battleJoined").player, room.setup.players[1]);
    assert.equal(links[0]!.last("battleSync").fight.players.length, 2);
  });

  test("each player gets the others' inputs", () => {
    const { room, links, join, tick } = shared();
    tick(5);
    join();
    room.input(1, room.fight.steps + 1, [{ step: room.fight.steps + 1, ...IDLE_MOVE }]);
    tick(1);
    assert.deepEqual(links[0]!.last("battleInputs").inputs.map((i) => i.seat), [1]);
  });

  test(`up to ${MAX_BATTLE_PLAYERS} players a battle`, () => {
    const { join } = shared();
    for (let i = 1; i < MAX_BATTLE_PLAYERS; i++) assert.equal(join(), i);
    assert.equal(join(), null);
  });

  test("a duel can't be joined", () => {
    const setup = setupWith();
    const { join } = shared({ ...setup, duel: true, enemies: [], players: [setup.players[0]!, setup.players[0]!] });
    assert.equal(join(), null);
  });

  test("a decided battle can't be joined", () => {
    const { room, join, tick } = shared();
    tick(2);
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    tick(2);
    assert.ok(room.afterFight);
    assert.equal(join(), null);
  });
});

describe("a battle shared by several players", () => {
  test("one who goes down has lost it, at once, and the rest fight on", () => {
    const { room, ended, join, tick, overs } = shared();
    tick(2);
    join();
    tick(2);
    room.fight.world.require(room.fight.players[1]!, Health).hp = 0;
    tick(1);
    assert.deepEqual(ended, [{ seat: 1, result: "lost" }]);
    assert.equal(room.over, false);
    assert.equal(overs(), 0);
  });

  test("a player who's down drops out: the room doesn't wait for their inputs", () => {
    const { room, join, tick } = shared();
    tick(2);
    join();
    tick(2);
    room.fight.world.require(room.fight.players[1]!, Health).hp = 0;
    tick(1);
    const at = room.fight.steps;
    room.input(0, at + 1, []);
    room.tick();
    assert.equal(room.fight.steps, at + 1);
  });

  test("won: everyone still in it has won", () => {
    const { room, ended, join, tick, overs } = shared();
    tick(2);
    join();
    join();
    tick(2);
    room.fight.world.require(room.fight.players[2]!, Health).hp = 0;
    tick(1);
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    tick(1);
    assert.deepEqual(ended, [{ seat: 2, result: "lost" }, { seat: 0, result: "won" }, { seat: 1, result: "won" }]);
    assert.equal(overs(), 1);
    assert.deepEqual([0, 1, 2].map((s) => room.inArena(s)), [true, true, false], "the winners stay in the arena");
  });

  test("after a win the arena empties as each winner leaves, and is freed when the last one does", () => {
    const { room, ended, join, tick, closes } = shared();
    tick(2);
    join();
    tick(2);
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    tick(1);
    room.leave(0);
    tick(5);
    assert.equal(room.over, false);
    assert.equal(closes(), 0);
    room.leave(1);
    assert.equal(room.over, true);
    assert.equal(closes(), 1);
    assert.equal(ended.length, 2, "leaving isn't a result");
  });

  test("a winner who leaves is gone from the arena for the others at once: they get the fight without them", () => {
    const { room, links, join, tick } = shared();
    tick(2);
    join();
    tick(2);
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    tick(1);
    links[1]!.sent.length = 0;
    room.leave(0);
    const { players } = links[1]!.last("battleSync").fight;
    assert.deepEqual(players.map((p) => p.player.leftArena), [true, false]);
    assert.ok(players[0]!.health.hp > 0, "gone, not down");
  });

  test("a joiner who disconnects mid-fight is gone from the arena for the others at once, down", () => {
    const { room, links, join, tick } = shared();
    tick(2);
    join();
    tick(2);
    links[0]!.sent.length = 0;
    room.leave(1);
    const { players } = links[0]!.last("battleSync").fight;
    assert.deepEqual(players.map((p) => p.player.leftArena), [false, true]);
    assert.equal(players[1]!.health.hp, 0);
  });

  test("the one left in the arena moves its clock", () => {
    const { room, join, tick } = shared();
    tick(2);
    join();
    tick(2);
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    tick(1);
    room.leave(0);
    const at = room.fight.steps;
    room.input(1, at + 1, []);
    room.tick(1);
    assert.equal(room.fight.steps, at + 1);
  });

  test("a joiner who leaves has lost as LEAVING_LOSES says; the rest fight on", () => {
    const { room, ended, join, tick } = shared();
    tick(2);
    join();
    tick(2);
    room.leave(1);
    tick(2);
    assert.deepEqual(ended.map((e) => e.seat), [1]);
    assert.equal(room.over, false);
  });

  test("the host leaving doesn't end it for the joiner, whose ticks run it on", () => {
    const { room, join, tick } = shared();
    tick(2);
    join();
    tick(2);
    room.leave(0);
    const at = room.fight.steps;
    room.input(1, at + 1, []);
    room.tick(1);
    assert.equal(room.fight.steps, at + 1);
  });
});
