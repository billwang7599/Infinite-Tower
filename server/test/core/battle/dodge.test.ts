/**
 * Dodging, the client's fight against the server's: a bite timed to land on one step, a dodge tapped some steps
 * before it, and the input arriving on time, late (within MAX_INPUT_DELAY_STEPS: it still runs on its own step) or
 * too late (it runs on the server's next step instead). The client runs the shared Fight with its input at once;
 * the server's BattleRoom runs it when the input arrives. Same step, same hit or miss, same HP.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FIXED_DT, Health, IDLE_INPUT, MAX_INPUT_DELAY_STEPS, PLAYER, type EnemyDef, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSetup } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/content/enemies.js";
import { openRoom, setupWith } from "../../fixtures/fight.js";

// Before the module's constants: they run a fight.
await initPhysics();

const BOAR = ENEMIES["wild-boar"];
const BITE_DAMAGE = 10;
/** The wild boar, lunging as soon as it can at whoever is within 8 m (all around), its hit live for one step. */
const SNAPPER: EnemyDef = {
  ...BOAR,
  stats: { ...BOAR.stats, strength: 10 },
  attacks: {
    lunge: {
      ...BOAR.attacks.lunge!, triggerDist: 3, range: 8, minDot: -1, active: FIXED_DT / 2, speed: 0,
      damage: BITE_DAMAGE, knockback: 0, lift: 0, cooldown: 99, firstDelay: 0,
    },
  },
};
const SETUP: FightSetup = setupWith(SNAPPER, { x: 0, y: 0.05, z: 1.5 }, { x: 0, y: 0.05, z: -1 });
const DODGE: PlayerInputData = { ...IDLE_INPUT, moveX: 1, dodge: true };

/** The step the bite lands on, nobody dodging. */
const LANDS_AT = (() => {
  const fight = new Fight(SETUP);
  while (fight.world.require(fight.players[0]!, Health).hp === PLAYER.maxHp) fight.step([IDLE_INPUT]);
  return fight.steps;
})();

/** Steps of a dodge (from the one it starts on) with i-frames: what the fight's PLAYER.dodge says. */
const IFRAME_STEPS = Math.ceil(PLAYER.dodge.iframeEnd / FIXED_DT) - 1;

/**
 * Plays the fight to past the bite with a dodge tapped on step `dodgeAt`, its message held back `late` ticks.
 * Returns the player's HP on the client and on the server, and both fights.
 */
function playDodge(dodgeAt: number, late = 0) {
  const { room, client, play, tick } = openRoom(SETUP);
  for (let step = 1; step <= LANDS_AT + 30; step++) {
    play(step === dodgeAt ? DODGE : IDLE_INPUT, step === dodgeAt ? late : 0);
  }
  // What was held back arrives.
  for (let i = 0; i < late; i++) tick();
  const hp = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;
  return { client: hp(client.fight), server: hp(room.fight), room, clientFight: client.fight };
}

const MISSED = PLAYER.maxHp, HIT = PLAYER.maxHp - BITE_DAMAGE;

describe("a dodge, on the client and on the server", () => {
  test("the bite lands on a step of its own", () => {
    assert.ok(LANDS_AT > IFRAME_STEPS + 4, `lands at step ${LANDS_AT}`);
    assert.equal(playDodge(-1).server, HIT);
  });

  test("dodging k steps before the bite, on time: the same hit or miss on both, and the same HP", () => {
    for (const k of [-1, 0, 1, 2, 5, IFRAME_STEPS - 1, IFRAME_STEPS, IFRAME_STEPS + 3]) {
      const { client, server, room, clientFight } = playDodge(LANDS_AT - k);
      const missed = k >= 0 && k < IFRAME_STEPS;
      assert.equal(client, missed ? MISSED : HIT, `client, dodging ${k} steps before`);
      assert.equal(server, client, `server, dodging ${k} steps before`);
      assert.deepEqual(room.fight.save(), clientFight.save(), `the whole fight, dodging ${k} steps before`);
    }
  });

  test("a dodge on the step the bite lands has i-frames on that step, on both", () => {
    const { client, server } = playDodge(LANDS_AT);
    assert.deepEqual({ client, server }, { client: MISSED, server: MISSED });
  });

  test("arriving 150 ms late, the dodge still runs on its own step: a miss on both", () => {
    const late = Math.round(0.15 / FIXED_DT);
    assert.ok(late <= MAX_INPUT_DELAY_STEPS);
    for (const k of [0, 2, 5]) {
      const { client, server, room, clientFight } = playDodge(LANDS_AT - k, late);
      assert.deepEqual({ client, server }, { client: MISSED, server: MISSED }, `dodging ${k} steps before`);
      assert.deepEqual(room.fight.save(), clientFight.save());
    }
  });

  test("arriving more than 200 ms late, it runs on the server's next step instead", () => {
    const late = MAX_INPUT_DELAY_STEPS + 3;
    // Still in time for the bite, a few steps later: a miss on both, but the server's dodge started later.
    const early = playDodge(LANDS_AT - 8, late);
    assert.deepEqual({ client: early.client, server: early.server }, { client: MISSED, server: MISSED });
    const expected = new Fight(SETUP);
    while (expected.steps < early.room.fight.steps) {
      expected.step([expected.steps + 1 === LANDS_AT - 8 + late - MAX_INPUT_DELAY_STEPS ? DODGE : IDLE_INPUT]);
    }
    assert.deepEqual(early.room.fight.save(), expected.save(), "the dodge ran on the server's next step");
    // Pushed past the bite: the client showed a miss, the server counts the hit (and corrects the client).
    const tooLate = playDodge(LANDS_AT - 2, late);
    assert.deepEqual({ client: tooLate.client, server: tooLate.server }, { client: MISSED, server: HIT });
  });
});
