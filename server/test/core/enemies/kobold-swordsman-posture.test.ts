import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, IDLE_INPUT, Player, POSTURE, toSteps, Wielder, type PlayerInputData,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;
const DEFLECT_LEAD_STEPS = 3;
const MIKIRI_LEAD_STEPS = 6;
const JUMP_LEAD_STEPS = 10;
const GRAB_DODGE_LEAD_STEPS = 8;

function reader(fight: Fight): PlayerInputData {
  const at = fight.world.require(fight.players[0]!, Body).pos, me = fight.world.require(fight.players[0]!, Player);
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const swing = fight.world.require(fight.enemies[0]!, Wielder).swing;
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.2 ? 1 : dist < 1.4 ? -1 : 0;
  const input: PlayerInputData = { ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ, locked: 0 };
  const even = fight.steps % 2 === 0;
  if (swing && swing.step < swing.liveAt) {
    const left = swing.liveAt - swing.step;
    if (swing.perilous === "thrust") Object.assign(input, { dodge: left === MIKIRI_LEAD_STEPS, moveX: aimX, moveZ: aimZ });
    else if (swing.perilous === "sweep") Object.assign(input, { jump: left <= JUMP_LEAD_STEPS });
    else input.block = left <= DEFLECT_LEAD_STEPS;
    return input;
  }
  if (swing?.perilous === "sweep" && !me.grounded) return { ...input, attack: even ? "light" : null };
  if (kobold.state === "guardBreak") {
    const left = toSteps(POSTURE.grab.windupTime) - Math.round(kobold.stateTime / FIXED_DT);
    return { ...input, dodge: left === GRAB_DODGE_LEAD_STEPS, moveX: aimZ, moveZ: -aimX };
  }
  if (["staggered", "weaponRecover", "recoil", "approach"].includes(kobold.state)) input.attack = even ? "light" : null;
  return input;
}

const play = (seed: number, next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(KOBOLD, seed, "posture");
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp };
};

describe("the Kobold Swordsman in Posture", () => {
  test("a player who reads it beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const { fight, hp } = play(seed, reader);
      console.log(`posture, seed ${seed}: ${fight.outcome.state} in ${(fight.steps / 60).toFixed(1)} s, ${hp} HP left`);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 4, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who only holds a guard loses: its perilous attacks and grabs go through", () => {
    const { fight } = play(1, (f) => ({ ...reader(f), block: true, attack: null, dodge: false, jump: false }));
    assert.equal(fight.outcome.state, "lost");
  });
});
