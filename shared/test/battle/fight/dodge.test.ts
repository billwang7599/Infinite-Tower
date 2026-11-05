import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  dodgeCost, FIXED_DT, Health, Player, PLAYER, Stamina, toSteps, type Burden, type EnemyDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_HP, FULL_STAMINA, IDLE, input, player, STATUE } from "./fixtures.js";

// Before the module's constants: they run a fight.
await initPhysics();

/**
 * Bites whoever stands within 8 m, all around, on exactly one step (its hitbox lives a single step), as soon as its
 * wind-up is over: so whether it lands depends on nothing but the player's i-frames on that step.
 */
const SNAPPER: EnemyDef = {
  ...STATUE, turnRate: 3,
  attacks: {
    lunge: {
      triggerDist: 3, range: 8, minDot: -1, windup: 0.4, active: FIXED_DT / 2, recover: 0.5, speed: 0,
      damage: 10, knockback: 0, lift: 0, cooldown: 99, firstDelay: 0,
    },
  },
};

function duelWith(burden: Burden = "light"): Fight {
  return new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: -1 }, { burden })],
    enemies: [enemy(SNAPPER, { x: 0, y: 0.05, z: 1.5 })],
  });
}

/** Runs a fight where the player taps dodge (sideways) on step `dodgeAt` (none if null); returns their hp per step. */
function hpBySteps(dodgeAt: number | null, steps = 60): number[] {
  return run(dodgeAt, steps).hp;
}

function run(dodgeAt: number | null, steps = 60) {
  const fight = duelWith();
  const hp: number[] = [], action: string[] = [];
  for (let step = 1; step <= steps; step++) {
    fight.step([step === dodgeAt ? input({ moveX: 1, dodge: true }) : IDLE]);
    hp.push(fight.world.require(fight.players[0]!, Health).hp);
    action.push(fight.world.require(fight.players[0]!, Player).action);
  }
  return { hp, action };
}

/** The step the bite lands on, standing still. */
const LANDS_AT = hpBySteps(null).findIndex((hp) => hp < FULL_HP) + 1;

const IFRAMES_FROM = toSteps(PLAYER.dodge.iframeStart), IFRAMES_UNTIL = toSteps(PLAYER.dodge.iframeEnd);

describe("dodging a hit, step by step", () => {
  test("the bite lands on one known step when nobody dodges", () => {
    assert.ok(LANDS_AT > 1, `lands at step ${LANDS_AT}`);
    const hp = hpBySteps(null);
    assert.equal(hp[LANDS_AT - 2], FULL_HP);
    assert.equal(hp[LANDS_AT - 1], FULL_HP - 10);
  });

  test("a dodge that starts on the very step the hit lands doesn't beat it, nor one just before", () => {
    assert.equal(hpBySteps(LANDS_AT).at(-1), FULL_HP - 10, "on the step");
    for (let k = 1; k < IFRAMES_FROM; k++) assert.equal(hpBySteps(LANDS_AT - k).at(-1), FULL_HP - 10, `${k} before`);
  });

  test("dodging k steps before the hit: a miss while the i-frames last, a hit before and after them", () => {
    const ks = [-1, 0, IFRAMES_FROM - 1, IFRAMES_FROM, IFRAMES_FROM + 1, IFRAMES_UNTIL - 2, IFRAMES_UNTIL - 1,
      IFRAMES_UNTIL, IFRAMES_UNTIL + 3];
    for (const k of ks) {
      const missed = k >= IFRAMES_FROM && k < IFRAMES_UNTIL;
      const hp = hpBySteps(LANDS_AT - k).at(-1);
      assert.equal(hp, missed ? FULL_HP : FULL_HP - 10, `dodge ${k} steps before the hit`);
    }
  });

  test("a hit in the dodge's tail, after its i-frames, lands while the player is still dodging", () => {
    let tail = 0;
    for (let k = IFRAMES_UNTIL; k <= LANDS_AT - 2; k++) {
      const { hp, action } = run(LANDS_AT - k);
      if (action[LANDS_AT - 1] !== "dodge") break;
      assert.equal(hp.at(-1), FULL_HP - 10, `dodge ${k} steps before the hit`);
      tail++;
    }
    assert.ok(tail >= 3, `${tail} steps of tail`);
  });

  test("starting a dodge, its stamina cost and the burden's cost are all the fight's own", () => {
    for (const burden of ["light", "heavy", "overloaded"] as const) {
      const fight = duelWith(burden);
      fight.step([IDLE]); // on the ground first
      fight.step([input({ moveX: 1, dodge: true })]);
      const me = fight.players[0]!, cost = dodgeCost(burden);
      assert.equal(fight.world.require(me, Player).action, cost === null ? "none" : "dodge", burden);
      assert.equal(fight.world.require(me, Stamina).value, FULL_STAMINA - (cost ?? 0), burden);
    }
  });
});

describe("after a dodge", () => {
  const DODGE = input({ moveX: 1, dodge: true });
  const actionOf = (fight: Fight) => fight.world.require(fight.players[0]!, Player).action;

  function dodged(): Fight {
    const fight = new Fight({
      arena: ARENA, players: [player({ x: 0, y: 0.05, z: -1 })], enemies: [enemy(STATUE, { x: 0, y: 0.05, z: 6 })],
    });
    fight.step([IDLE]);
    fight.step([DODGE]);
    while (actionOf(fight) === "dodge") fight.step([IDLE]);
    return fight;
  }

  test("another can't start right after it", () => {
    const fight = dodged(), stamina = fight.world.require(fight.players[0]!, Stamina).value;
    fight.step([DODGE]);
    assert.equal(actionOf(fight), "none");
    assert.equal(fight.world.require(fight.players[0]!, Stamina).value, stamina);
  });

  test("a press in its recovery waits for the recovery's end, like any early press", () => {
    const fight = dodged(), endedAt = fight.steps, recovery = toSteps(PLAYER.dodge.cooldown);
    assert.ok(recovery > 1);
    while (fight.steps < endedAt + recovery - 1) {
      fight.step([fight.steps + 1 === endedAt + recovery - 1 ? DODGE : IDLE]);
      assert.equal(actionOf(fight), "none", `${fight.steps - endedAt} steps after`);
    }
    fight.step([IDLE]);
    assert.equal(actionOf(fight), "dodge");
  });

  test("an attack or a block isn't held back", () => {
    for (const [press, action] of [[{ attack: "light" }, "attack"], [{ block: true }, "block"]] as const) {
      const fight = dodged();
      fight.step([input(press)]);
      assert.equal(actionOf(fight), action);
    }
  });
});
