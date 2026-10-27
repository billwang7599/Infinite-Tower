import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health } from "@infinite-tower/shared";
import {
  Fight, initPhysics, LEAVING_LOSES, MAX_FIGHT_TIME, playerResult, type FightState,
} from "@infinite-tower/shared/fight";
import { ARENA, duel, enemy, IDLE, player, run, STATUE } from "./fixtures.js";

before(() => initPhysics());

const PLAYER_AT = { x: 0, y: 0.05, z: -5 };
const STATUE_AT = { x: 0, y: 0.05, z: 5 };
const STATES: FightState[] = ["fighting", "won", "lost"];

describe("the time limit", () => {
  test("a fight still undecided after MAX_FIGHT_TIME is lost, and not a step before", () => {
    const fight = duel(STATUE, PLAYER_AT, STATUE_AT);
    run(fight, 1);
    // Skipped ahead rather than ten minutes of steps: the outcome's clock is what the limit reads.
    fight.outcome.stateTime = MAX_FIGHT_TIME - 1.5 * Fight.STEP_SECONDS;
    fight.step([IDLE]);
    assert.equal(fight.outcome.state, "fighting");
    fight.step([IDLE]);
    assert.equal(fight.outcome.state, "lost");
    assert.ok(fight.world.require(fight.players[0]!, Health).hp > 0, "nobody had to die");
  });

  test("doesn't touch a fight that's already decided", () => {
    const fight = duel(STATUE, PLAYER_AT, STATUE_AT);
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    run(fight, 0.1);
    assert.equal(fight.outcome.state, "won");
    fight.outcome.stateTime = MAX_FIGHT_TIME;
    run(fight, 0.1);
    assert.equal(fight.outcome.state, "won");
  });
});

describe("leaving", () => {
  test("a player who leaves is down at once; alone in the fight, it's lost", () => {
    const fight = duel(STATUE, PLAYER_AT, STATUE_AT);
    run(fight, 0.5);
    fight.leave(fight.players[0]!);
    assert.equal(fight.world.require(fight.players[0]!, Health).hp, 0);
    fight.step([IDLE]);
    assert.equal(fight.outcome.state, "lost");
  });

  test("with another player still up, one leaving doesn't decide the fight", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(PLAYER_AT), player({ x: 2, y: 0.05, z: -5 })], enemies: [enemy(STATUE, STATUE_AT)],
    });
    fight.leave(fight.players[1]!);
    run(fight, 0.5);
    assert.equal(fight.outcome.state, "fighting");
  });

  test("the player who left has lost, however the fight goes on without them", () => {
    for (const state of STATES) {
      assert.equal(playerResult({ state, stateTime: 0 }, true), LEAVING_LOSES ? "lost" : "left", state);
    }
  });

  test("everyone else gets the fight's own result", () => {
    for (const state of STATES) assert.equal(playerResult({ state, stateTime: 0 }, false), state);
  });
});
