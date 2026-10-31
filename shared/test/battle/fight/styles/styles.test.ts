import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Player, Wielder, type PlayerInputData } from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSetup } from "@infinite-tower/shared/fight";
import {
  ARENA, busy, busyHybrid, enemy, IDLE, input, player, run, SWORDSMAN,
} from "../fixtures.js";

before(() => initPhysics());

const setup = (over: Partial<FightSetup> = {}): FightSetup => ({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })],
  enemies: [enemy({ ...SWORDSMAN, maxHp: 10_000 }, { x: 0, y: 0.05, z: 2 })], ...over,
});
const me = (fight: Fight) => fight.world.require(fight.players[0]!, Player);
const swingOf = (fight: Fight, e = fight.players[0]!) => fight.world.require(e, Wielder).swing;

function runTo(fight: Fight, to: number, next: (step: number) => PlayerInputData): void {
  while (fight.steps < to) fight.step([next(fight.steps + 1)]);
}

describe("a fight's combat style", () => {
  test("comes from its setup, For Honor when left out", () => {
    assert.equal(new Fight(setup()).style, "for-honor");
    assert.equal(new Fight(setup({ style: "hybrid" })).style, "hybrid");
    assert.equal(new Fight(setup({ style: "for-honor" })).style, "for-honor");
  });

  test("For Honor ignores the hybrid's keys: no stab, no held block, no kick, no aimed way", () => {
    const fight = new Fight(setup());
    fight.step([input({ locked: 0, attack: "stab", way: "lr" })]);
    assert.equal(swingOf(fight), null);
    run(fight, 0.5, () => input({ locked: 0, block: true, kick: true }));
    assert.notEqual(me(fight).action, "block");
    assert.notEqual(me(fight).action, "kick");
    fight.step([input({ locked: 0, guard: "left", way: "rl", attack: "light" })]);
    assert.equal(swingOf(fight)?.side, "left");
    assert.equal(swingOf(fight)?.way, null);
  });

  test("the hybrid ignores For Honor's: no guard, no guard break, attacks go the aimed way", () => {
    const fight = new Fight(setup({ style: "hybrid" }));
    run(fight, 0.3, () => input({ locked: 0, guard: "left", guardBreak: true }));
    assert.equal(me(fight).guard, null);
    assert.notEqual(me(fight).action, "grab");
    run(fight, 0.5, () => IDLE);
    fight.step([input({ locked: 0, guard: "left", way: "brtl", attack: "heavy" })]);
    assert.equal(swingOf(fight)?.way, "brtl");
    assert.equal(swingOf(fight)?.attack, "heavy");
  });

  test("every fighter in it plays by it: a swordsman swings the hybrid's ways, or For Honor's sides", () => {
    for (const style of ["for-honor", "hybrid"] as const) {
      const fight = new Fight(setup({ style }));
      const kobold = fight.enemies[0]!;
      while (swingOf(fight, kobold) === null && fight.steps < 600) fight.step([IDLE]);
      const swing = swingOf(fight, kobold);
      assert.ok(swing, style);
      assert.equal(swing.way !== null, style === "hybrid", style);
    }
  });

  test("a hybrid fight is the same on both sides: same inputs, same hash; a save loads mid-chain", () => {
    const a = new Fight(setup({ style: "hybrid" })), b = new Fight(setup({ style: "hybrid" }));
    for (let step = 1; step <= 600; step++) {
      a.step([busyHybrid(step)]);
      b.step([busyHybrid(step)]);
      assert.equal(a.hash(), b.hash(), `step ${step}`);
    }
    for (const at of [3, 150, 333]) {
      const original = new Fight(setup({ style: "hybrid" }));
      runTo(original, at, busyHybrid);
      const copy = new Fight(setup({ style: "hybrid" }));
      copy.load(JSON.parse(JSON.stringify(original.save())));
      runTo(original, at + 200, busyHybrid);
      runTo(copy, at + 200, busyHybrid);
      assert.equal(copy.hash(), original.hash(), `loaded at ${at}`);
    }
  });

  test("the hybrid's chain and kick are part of the hash", () => {
    const fight = new Fight(setup({ style: "hybrid" }));
    const before = fight.hash();
    fight.world.require(fight.players[0]!, Wielder).momentum = 2;
    assert.notEqual(fight.hash(), before);
  });

  test("the same inputs in the two styles make different fights", () => {
    const a = new Fight(setup()), b = new Fight(setup({ style: "hybrid" }));
    runTo(a, 300, busy);
    runTo(b, 300, busy);
    assert.notEqual(a.hash(), b.hash());
  });
});
