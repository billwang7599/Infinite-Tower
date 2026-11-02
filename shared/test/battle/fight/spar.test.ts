import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health, type EnemyDef, type Strike } from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_HP, input, player, run, STATUE, SWORDSMAN, swings } from "./fixtures.js";

before(() => initPhysics());

const PLAYER_AT = { x: 0, y: 0.05, z: 0 };
const NEAR = { x: 0, y: 0.05, z: 1.6 };
const YIELD_SHARE = 0.1;

const DUMMY: EnemyDef = { ...STATUE, dummy: true };

const hpOf = (fight: Fight, e: number | "player") =>
  fight.world.require(e === "player" ? fight.players[0]! : fight.enemies[e]!, Health).hp;

function strike(fight: Fight, attack: Strike): void {
  fight.step([input({ attack })]);
  run(fight, 1.5);
}

describe("the training dummy", () => {
  test("takes no damage, and falls once struck with a light, a heavy and a stab", () => {
    const fight = new Fight({ arena: ARENA, players: [player(PLAYER_AT)], enemies: [enemy(DUMMY, NEAR)] });
    strike(fight, "light");
    strike(fight, "light");
    strike(fight, "heavy");
    assert.equal(hpOf(fight, 0), DUMMY.maxHp);
    assert.equal(fight.outcome.state, "fighting");
    strike(fight, "stab");
    assert.equal(hpOf(fight, 0), 0);
    assert.equal(fight.outcome.state, "won");
  });
});

describe("a spar: nobody goes under their share of HP", () => {
  test("an enemy hit down to its share yields: the fight is won with it still standing at that HP", () => {
    const weak: EnemyDef = { ...STATUE, maxHp: 20 };
    const fight = new Fight({
      arena: ARENA, yieldAt: YIELD_SHARE, players: [player(PLAYER_AT)], enemies: [enemy(weak, NEAR)],
    });
    for (let i = 0; i < 6 && fight.outcome.state === "fighting"; i++) strike(fight, "light");
    assert.equal(fight.outcome.state, "won");
    assert.equal(hpOf(fight, 0), weak.maxHp * YIELD_SHARE);
  });

  test("a player hit down to their share yields: the fight is lost, and they're left at that HP", () => {
    const brute: EnemyDef = {
      ...SWORDSMAN, wielder: { hands: { rightHand: "greatsword" }, armReachM: 1 },
      attacks: { weapon: swings({ cooldown: 0, recover: 0.2 }) },
    };
    const fight = new Fight({
      arena: ARENA, yieldAt: YIELD_SHARE, players: [player(PLAYER_AT)], enemies: [enemy(brute, NEAR)],
    });
    run(fight, 60);
    assert.equal(fight.outcome.state, "lost");
    assert.equal(hpOf(fight, "player"), FULL_HP * YIELD_SHARE);
  });

  test("without one, a fight goes down to 0 as ever", () => {
    const weak: EnemyDef = { ...STATUE, maxHp: 20 };
    const fight = new Fight({ arena: ARENA, players: [player(PLAYER_AT)], enemies: [enemy(weak, NEAR)] });
    for (let i = 0; i < 6 && fight.outcome.state === "fighting"; i++) strike(fight, "light");
    assert.equal(fight.outcome.state, "won");
    assert.equal(hpOf(fight, 0), 0);
  });
});
