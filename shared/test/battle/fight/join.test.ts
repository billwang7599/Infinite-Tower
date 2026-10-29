import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Health } from "@infinite-tower/shared";
import { Fight, initPhysics, joinStart, playerResult, type FightSetup } from "@infinite-tower/shared/fight";
import { ARENA, BOAR, enemy, input, player, run, STATUE } from "./fixtures.js";

before(() => initPhysics());

const SETUP: FightSetup = {
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: -5 })], enemies: [enemy(BOAR, { x: 0, y: 0.05, z: 5 })],
};

describe("a player joining a fight under way", () => {
  test("comes in at the arena's edge, as the next player, and plays from the next step", () => {
    const fight = new Fight(SETUP);
    run(fight, 0.5);
    const joiner = fight.join(player(joinStart(fight.arena, 1)));
    assert.equal(fight.players.length, 2);
    assert.equal(fight.players[1], joiner);
    const at = fight.world.require(joiner, Body).pos;
    assert.ok(Math.hypot(at.x, at.z) > ARENA.radius * 0.6, "near the wall");
    assert.ok(Math.hypot(at.x, at.z) < ARENA.radius, "inside it");
    const before = { ...at };
    for (let i = 0; i < 20; i++) fight.step([input({}), input({ moveX: 1 })]);
    assert.ok(fight.world.require(joiner, Body).pos.x > before.x + 0.5);
  });

  test("each joiner gets a spot of their own", () => {
    const spots = [1, 2, 3].map((seat) => joinStart(ARENA, seat));
    for (const a of spots) for (const b of spots) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1);
  });

  test("a fight saved after a join loads into one built with the joiner in its setup", () => {
    const fight = new Fight(SETUP);
    run(fight, 0.5);
    const joining = player(joinStart(fight.arena, 1));
    fight.join(joining);
    for (let i = 0; i < 30; i++) fight.step([input({ moveZ: 1 }), input({ moveX: -1 })]);
    const copy = new Fight({ ...SETUP, players: [...SETUP.players, joining] });
    copy.load(JSON.parse(JSON.stringify(fight.save())));
    assert.equal(copy.hash(), fight.hash());
    for (let i = 0; i < 30; i++) {
      fight.step([input({ moveX: 1 }), input({ moveZ: -1 })]);
      copy.step([input({ moveX: 1 }), input({ moveZ: -1 })]);
    }
    assert.deepEqual(copy.save(), fight.save());
  });

  test("players don't hurt each other in a shared fight", () => {
    const fight = new Fight({
      arena: ARENA, enemies: [enemy(STATUE, { x: 0, y: 0.05, z: 6 })],
      players: [player({ x: 0, y: 0.05, z: -1 }), player({ x: 0, y: 0.05, z: 0.2 })],
    });
    for (let i = 0; i < 60; i++) fight.step([input({ attack: i % 20 === 0 ? "lr" : null }), input({})]);
    assert.equal(fight.world.require(fight.players[1]!, Health).hp, fight.world.require(fight.players[1]!, Health).max);
  });
});

describe("a player's own result in a shared fight", () => {
  test("down while the others fight on: lost, now", () => {
    assert.equal(playerResult({ state: "fighting", stateTime: 0 }, false, { standing: false, duel: false }), "lost");
  });

  test("standing while it goes on: still fighting", () => {
    assert.equal(playerResult({ state: "fighting", stateTime: 0 }, false, { standing: true, duel: false }), "fighting");
  });

  test("won by the others while down on the same step: everyone still in it wins", () => {
    assert.equal(playerResult({ state: "won", stateTime: 0 }, false, { standing: false, duel: false }), "won");
  });
});
