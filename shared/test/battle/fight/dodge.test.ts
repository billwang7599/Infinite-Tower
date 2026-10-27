import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  dodgeCost, FIXED_DT, Health, Player, PLAYER, Stamina, type Burden, type EnemyDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, IDLE, input, player, STATS, STATUE } from "./fixtures.js";

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
  const fight = duelWith();
  const hp: number[] = [];
  for (let step = 1; step <= steps; step++) {
    fight.step([step === dodgeAt ? input({ moveX: 1, dodge: true }) : IDLE]);
    hp.push(fight.world.require(fight.players[0]!, Health).hp);
  }
  return hp;
}

/** The step the bite lands on, standing still. */
const LANDS_AT = hpBySteps(null).findIndex((hp) => hp < PLAYER.maxHp) + 1;

/** How many steps of a dodge, counting the one it starts on, have i-frames (from PLAYER.dodge). */
const IFRAME_STEPS = (() => {
  const { iframeStart, iframeEnd } = PLAYER.dodge;
  let n = 0;
  for (let t = FIXED_DT; t < iframeEnd; t += FIXED_DT) if (t >= iframeStart) n++;
  return n;
})();

describe("dodging a hit, step by step", () => {
  test("the bite lands on one known step when nobody dodges", () => {
    assert.ok(LANDS_AT > 1, `lands at step ${LANDS_AT}`);
    const hp = hpBySteps(null);
    assert.equal(hp[LANDS_AT - 2], PLAYER.maxHp);
    assert.equal(hp[LANDS_AT - 1], PLAYER.maxHp - 10);
  });

  test("a dodge that starts on the very step the hit lands has i-frames on that step", () => {
    assert.ok(PLAYER.dodge.iframeStart <= FIXED_DT, "i-frames from the dodge's first step");
    assert.equal(hpBySteps(LANDS_AT).at(-1), PLAYER.maxHp);
  });

  test("dodging k steps before the hit: a miss while the i-frames last, a hit after (and one step too late)", () => {
    for (const k of [-1, 0, 1, 2, 5, IFRAME_STEPS - 2, IFRAME_STEPS - 1, IFRAME_STEPS, IFRAME_STEPS + 3]) {
      const missed = k >= 0 && k < IFRAME_STEPS;
      const hp = hpBySteps(LANDS_AT - k).at(-1);
      assert.equal(hp, missed ? PLAYER.maxHp : PLAYER.maxHp - 10, `dodge ${k} steps before the hit`);
    }
  });

  test("starting a dodge, its stamina cost and the burden's cost are all the fight's own", () => {
    for (const burden of ["light", "heavy", "overloaded"] as const) {
      const fight = duelWith(burden);
      fight.step([IDLE]); // on the ground first
      fight.step([input({ moveX: 1, dodge: true })]);
      const me = fight.players[0]!, cost = dodgeCost(burden);
      assert.equal(fight.world.require(me, Player).action, cost === null ? "none" : "dodge", burden);
      assert.equal(fight.world.require(me, Stamina).value, STATS.stamina - (cost ?? 0), burden);
    }
  });
});
