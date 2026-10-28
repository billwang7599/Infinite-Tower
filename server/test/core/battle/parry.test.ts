/**
 * Parrying, the client's fight against the server's: the Kobold Swordsman's swing, the reverse swing pressed so its
 * blade goes live a few steps before the Kobold's lands, and the input arriving on time or late (within
 * MAX_INPUT_DELAY_STEPS: it still runs on its own step). The client decides the parry in its own copy at once; the
 * server's replay must decide the same, with the same stun, on the same step.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Enemy, FIXED_DT, Health, IDLE_INPUT, liveStep, SWING, MAX_INPUT_DELAY_STEPS, PARRY, PLAYER, reverseOf,
  type EnemyDef, type PlayerInputData, type SwingDir,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSetup } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { openRoom, setupWith } from "../../fixtures/fight.js";

// Before the module's constants: they run a fight.
await initPhysics();

const KOBOLD = ENEMIES["kobold-swordsman"].def;
const ITS_SWING: SwingDir = "tlbr";
/** The Kobold, rooted to the spot, swinging `ITS_SWING` once as soon as it can. */
const ONE_SWING: EnemyDef = {
  ...KOBOLD, walkSpeed: 0,
  attacks: {
    weapon: { ...KOBOLD.attacks.weapon!, moves: [ITS_SWING], minChain: 1, maxChain: 1, firstDelay: 0, cooldown: 99 },
  },
};
const SETUP: FightSetup = setupWith(ONE_SWING, { x: 0, y: 0.05, z: 2 }, { x: 0, y: 0.05, z: 0 });

/** The step the swing lands on, nobody doing anything. */
const LANDS_AT = (() => {
  const fight = new Fight(SETUP);
  while (fight.world.require(fight.players[0]!, Health).hp === PLAYER.maxHp) fight.step([IDLE_INPUT]);
  return fight.steps;
})();
const LIVE_AFTER = liveStep(SWING.openingTime);
const PARRY_PRESS: PlayerInputData = { ...IDLE_INPUT, attack: reverseOf(ITS_SWING) };

/** Presses the reverse swing so its blade goes live `k` steps before the Kobold's lands, sent `late` ticks late. */
function playParry(k: number, late = 0) {
  const { room, client, play, tick } = openRoom(SETUP);
  const pressAt = LANDS_AT - LIVE_AFTER - k;
  for (let step = 1; step <= LANDS_AT + 30; step++) {
    play(step === pressAt ? PARRY_PRESS : IDLE_INPUT, step === pressAt ? late : 0);
  }
  for (let i = 0; i < late; i++) tick();
  const parried = (fight: Fight) => fight.world.require(fight.enemies[0]!, Enemy).state === "parried";
  const hp = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;
  return {
    client: { parried: parried(client.fight), hp: hp(client.fight) },
    server: { parried: parried(room.fight), hp: hp(room.fight) },
    room, clientFight: client.fight,
  };
}

describe("a parry, on the client and on the server", () => {
  test("the setup: the swing lands on a step of its own, after the stun would have run out", () => {
    assert.ok(LANDS_AT > LIVE_AFTER + 12, `lands at ${LANDS_AT}`);
    assert.ok(30 * FIXED_DT < PARRY.stunTime, "still stunned when the test looks");
  });

  test("on time: both decide the same parry (or hit), and the whole fight is the same", () => {
    const windowSteps = Math.round(PARRY.window / FIXED_DT);
    for (const k of [-2, 0, 3, windowSteps, windowSteps + 2]) {
      const { client, server, room, clientFight } = playParry(k);
      const inWindow = k >= 0 && k <= windowSteps;
      assert.deepEqual(client, { parried: inWindow, hp: inWindow ? PLAYER.maxHp : client.hp }, `k = ${k}`);
      if (!inWindow) assert.ok(client.hp < PLAYER.maxHp, `k = ${k}: hit`);
      assert.deepEqual(server, client, `k = ${k}`);
      assert.deepEqual(room.fight.save(), clientFight.save(), `the whole fight, k = ${k}`);
      assert.equal(room.fight.hash(), clientFight.hash(), `k = ${k}`);
    }
  });

  test("arriving 150 ms late, the swing still runs on its own step: parried on both", () => {
    const late = Math.round(0.15 / FIXED_DT);
    assert.ok(late <= MAX_INPUT_DELAY_STEPS);
    for (const k of [0, 2, 5]) {
      const { client, server, room, clientFight } = playParry(k, late);
      assert.deepEqual({ client, server }, {
        client: { parried: true, hp: PLAYER.maxHp }, server: { parried: true, hp: PLAYER.maxHp },
      }, `k = ${k}`);
      assert.deepEqual(room.fight.save(), clientFight.save(), `k = ${k}`);
    }
  });
});
