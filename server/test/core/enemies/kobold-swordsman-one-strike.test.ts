import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, IDLE_INPUT, lineMoveSteps, linesApart, OneStrike, Wielder, WEAPONS,
  type PlayerInputData,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;
const LINE_STEPS = lineMoveSteps(WEAPONS.sword.heft);
const OPEN = ["staggered", "pickup"];

function reader(fight: Fight): PlayerInputData {
  const e = fight.players[0]!, it = fight.enemies[0]!;
  const at = fight.world.require(e, Body).pos, there = fight.world.require(it, Body).pos;
  const mine = fight.world.require(e, OneStrike), theirs = fight.world.require(it, OneStrike);
  const kobold = fight.world.require(it, Enemy), swing = fight.world.require(it, Wielder).swing;
  const dx = there.x - at.x, dz = there.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.6 ? 1 : dist < 2 ? -1 : 0;
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ, locked: 0, line: theirs.to,
  };
  const even = fight.steps % 2 === 0;
  if (swing?.line && swing.step < swing.liveAt) {
    const apart = linesApart(mine.line, swing.line), left = swing.liveAt - swing.step;
    return { ...input, line: apart > 0 && left <= apart * LINE_STEPS ? swing.line : mine.to };
  }
  if (kobold.state === "beat") return { ...input, line: theirs.line === "high" ? "middle" : "high" };
  const open = theirs.loose !== null || theirs.offLineSteps > 0 || OPEN.includes(kobold.state);
  if (open && dist < 3.2) return { ...input, moveX: 0, moveZ: 0, line: "high", attack: even ? "light" : null };
  return mine.want !== theirs.to && fight.world.require(e, Wielder).swing ? { ...input, line: mine.want } : input;
}

const play = (seed: number, next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(KOBOLD, seed, "one-strike");
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp };
};

describe("the Kobold Swordsman in One Strike", () => {
  test("a player who reads its line and its thrusts beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const { fight, hp } = play(seed, reader);
      const seconds = (fight.steps * FIXED_DT).toFixed(1);
      console.log(`one strike, seed ${seed}: ${fight.outcome.state} in ${seconds} s, ${hp} HP left`);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 4, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who stands at one line and never answers loses", () => {
    const { fight } = play(1, (f) => ({ ...reader(f), line: "middle", attack: null }));
    assert.equal(fight.outcome.state, "lost");
  });
});
