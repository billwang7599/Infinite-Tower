import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FIXED_DT, Health, IDLE_INPUT, MAX_INPUT_DELAY_STEPS, type EnemyDef, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSetup } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { FULL, openRoom, setupWith } from "../../fixtures/fight.js";

// Before the module's constants: they run a fight.
await initPhysics();

const KOBOLD = ENEMIES["kobold-swordsman"].def;
const ONE_ATTACK: EnemyDef = {
  ...KOBOLD, walkSpeed: 0,
  attacks: { weapon: { ...KOBOLD.attacks.weapon!, minChain: 1, maxChain: 1, firstDelay: 0, cooldown: 99 } },
};
const SETUP: FightSetup = setupWith(ONE_ATTACK, { x: 0, y: 0.05, z: 2 }, { x: 0, y: 0.05, z: 0 });

const ITS = (() => {
  const fight = new Fight(SETUP);
  while (fight.world.require(fight.players[0]!, Health).hp === FULL.hp) fight.step([IDLE_INPUT]);
  return { landsAt: fight.steps };
})();

function playBlock(k: number, late = 0) {
  const { room, client, play, tick } = openRoom(SETUP);
  const moveAt = ITS.landsAt - k;
  const guarding = (step: number): PlayerInputData => ({ ...IDLE_INPUT, locked: 0, block: step >= moveAt });
  let blocked = false;
  for (let step = 1; step <= ITS.landsAt + 30; step++) {
    play(guarding(step), step === moveAt ? late : 0);
    blocked ||= client.fight.events.some((e) => e.type === "block" || e.type === "parry");
  }
  for (let i = 0; i < late; i++) tick();
  const hp = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;
  return { blocked, client: hp(client.fight), server: hp(room.fight), room, clientFight: client.fight };
}

describe("a block, on the client and on the server", () => {
  test("the setup: the attack lands on a step of its own", () => {
    assert.ok(ITS.landsAt > 30, `lands at ${ITS.landsAt}`);
  });

  test("on time: both decide the same block, tap parry or hit, and the whole fight is the same", () => {
    for (const k of [-2, 0, 1, 5, 20]) {
      const { blocked, client, server, room, clientFight } = playBlock(k);
      const inTime = k >= 0;
      assert.equal(blocked, inTime, `k = ${k}`);
      assert.equal(server, client, `k = ${k}`);
      assert.deepEqual(room.fight.save(), clientFight.save(), `the whole fight, k = ${k}`);
      assert.equal(room.fight.hash(), clientFight.hash(), `k = ${k}`);
    }
  });

  test("arriving 150 ms late, the block still starts on its own step: stopped on both", () => {
    const late = Math.round(0.15 / FIXED_DT);
    assert.ok(late <= MAX_INPUT_DELAY_STEPS);
    for (const k of [0, 2, 5]) {
      const { blocked, client, server, room, clientFight } = playBlock(k, late);
      assert.ok(blocked, `k = ${k}`);
      assert.equal(server, client, `k = ${k}`);
      assert.deepEqual(room.fight.save(), clientFight.save(), `k = ${k}`);
    }
  });
});
