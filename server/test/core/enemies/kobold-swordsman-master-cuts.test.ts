import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, breakerOf, Cuts, Enemy, FIXED_DT, Health, IDLE_INPUT, Player, Wielder, type PlayerInputData,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;
const COUNTER_LEAD_STEPS = 8;
const OPEN = ["staggered", "recoil", "weaponRecover"];

function reader(fight: Fight): PlayerInputData {
  const e = fight.players[0]!, it = fight.enemies[0]!;
  const at = fight.world.require(e, Body).pos, there = fight.world.require(it, Body).pos;
  const mine = fight.world.require(e, Cuts), theirs = fight.world.require(it, Cuts);
  const kobold = fight.world.require(it, Enemy), swing = fight.world.require(it, Wielder).swing;
  const dx = there.x - at.x, dz = there.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.4 ? 1 : dist < 1.8 ? -1 : 0;
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ, locked: 0, stance: breakerOf(theirs.to),
  };
  const even = fight.steps % 2 === 0;
  if (fight.world.require(e, Player).action === "grabbed") return { ...input, guardBreak: even };
  if (swing?.stance && swing.step < swing.liveAt) {
    const left = swing.liveAt - swing.step, settled = mine.moveSteps === 0;
    const counter = settled && left <= COUNTER_LEAD_STEPS && !fight.world.require(e, Wielder).swing;
    return { ...input, stance: mine.to, attack: counter ? "heavy" : null };
  }
  if (OPEN.includes(kobold.state) && dist < 2.6) return { ...input, stance: mine.to, attack: even ? "light" : null };
  return input;
}

const play = (seed: number, next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(KOBOLD, seed, "master-cuts");
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp };
};

describe("the Kobold Swordsman in Master Cuts", () => {
  test("a player who answers its guard and counters from the breaking one beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const { fight, hp } = play(seed, reader);
      const seconds = (fight.steps * FIXED_DT).toFixed(1);
      console.log(`master cuts, seed ${seed}: ${fight.outcome.state} in ${seconds} s, ${hp} HP left`);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 4, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who stands in one guard and never counters loses", () => {
    const { fight } = play(1, (f) => ({ ...reader(f), stance: "vom-tag", attack: null }));
    assert.equal(fight.outcome.state, "lost");
  });
});
