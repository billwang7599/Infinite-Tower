import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health, PLAYER, type PlayerInputData } from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BOAR, bodyOf, dumpState, enemy, IDLE, input, player, run, STATUE } from "./fixtures.js";

before(() => initPhysics());

const PLAYER_AT = { x: 0, y: 0.05, z: -6 };
const BOAR_AT = { x: 0, y: 0.05, z: 4 };

/** A player who walks up to the enemy and swings at it, left and right, every other step a fresh press. */
function brawler(fight: Fight) {
  return (step: number): PlayerInputData => {
    const me = bodyOf(fight, fight.players[0]!).pos, it = bodyOf(fight, fight.enemies[0]!).pos;
    const dx = it.x - me.x, dz = it.z - me.z, dist = Math.hypot(dx, dz) || 1;
    const aimX = dx / dist, aimZ = dz / dist, far = dist > 2.6;
    const attack = step % 4 === 0 ? "light" : step % 4 === 2 ? "heavy" : null;
    return input({ aimX, aimZ, moveX: far ? aimX : 0, moveZ: far ? aimZ : 0, attack });
  };
}

/** Steps until the fight is decided (or `seconds` run out); returns how it ended. */
function fightOut(fight: Fight, seconds: number, next: (step: number) => PlayerInputData) {
  for (let step = 0; step < seconds / Fight.STEP_SECONDS && fight.outcome.state === "fighting"; step++) {
    fight.step([next(step)]);
  }
  return fight.outcome.state;
}

describe("a fight", () => {
  test("the same inputs from the same start give exactly the same fight, step for step", () => {
    const play = () => {
      const fight = new Fight({ arena: ARENA, players: [player(PLAYER_AT)], enemies: [enemy(BOAR, BOAR_AT)] });
      const next = brawler(fight), states: string[] = [];
      for (let step = 0; step < 600; step++) {
        fight.step([next(step)]);
        states.push(dumpState(fight));
      }
      return { states, physics: fight.physics.snapshot() };
    };
    const first = play(), second = play();
    assert.deepEqual(second.states, first.states);
    assert.ok(Buffer.from(second.physics).equals(Buffer.from(first.physics)), "the physics worlds match byte for byte");
  });

  test("a player who keeps swinging at the boar wins", () => {
    const fight = new Fight({ arena: ARENA, players: [player(PLAYER_AT)], enemies: [enemy(BOAR, BOAR_AT)] });
    assert.equal(fightOut(fight, 60, brawler(fight)), "won");
    assert.ok(fight.world.require(fight.players[0]!, Health).hp > 0);
    assert.equal(fight.world.require(fight.enemies[0]!, Health).hp, 0);
  });

  test("a player who just stands there loses", () => {
    const weak = player(PLAYER_AT, { vitals: { hp: 30, stamina: 100 } });
    const fight = new Fight({ arena: ARENA, players: [weak], enemies: [enemy(BOAR, BOAR_AT)] });
    assert.equal(fightOut(fight, 60, () => IDLE), "lost");
    assert.equal(fight.world.require(fight.players[0]!, Health).hp, 0);
  });

  test("the outcome's clock restarts when the fight is decided", () => {
    const fight = new Fight({ arena: ARENA, players: [player(PLAYER_AT)], enemies: [enemy(STATUE, BOAR_AT)] });
    run(fight, 1);
    assert.equal(fight.outcome.state, "fighting");
    assert.ok(Math.abs(fight.outcome.stateTime - 1) < 1e-9);
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    run(fight, 0.5);
    assert.equal(fight.outcome.state, "won");
    assert.ok(Math.abs(fight.outcome.stateTime - 0.5 + Fight.STEP_SECONDS) < 1e-9);
  });

  test("with more than one player, each moves by their own input", () => {
    const fight = new Fight({
      arena: ARENA,
      players: [player({ x: -2, y: 0.05, z: 0 }), player({ x: 2, y: 0.05, z: 0 })],
      enemies: [enemy(STATUE, { x: 0, y: 0.05, z: 5 }), enemy(STATUE, { x: 0, y: 0.05, z: -5 })],
    });
    for (let step = 0; step < 60; step++) fight.step([input({ moveX: -1 }), input({ moveX: 1 })]);
    const [left, right] = fight.players.map((e) => bodyOf(fight, e).pos);
    assert.ok(left!.x < -2 - PLAYER.moveSpeed * 0.5, `the first went left (${left!.x})`);
    assert.ok(right!.x > 2 + PLAYER.moveSpeed * 0.5, `the second went right (${right!.x})`);
  });

  test("dispose ends it: its entities are gone", () => {
    const fight = new Fight({ arena: ARENA, players: [player(PLAYER_AT)], enemies: [enemy(STATUE, BOAR_AT)] });
    const everyone = [...fight.players, ...fight.enemies];
    fight.dispose();
    for (const e of everyone) assert.equal(fight.world.isAlive(e), false);
  });
});
