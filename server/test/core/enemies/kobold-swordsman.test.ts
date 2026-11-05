import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, feltHeft, FIXED_DT, Health, HYBRID, IDLE_INPUT, wayStepsAfter, WEAPONS, Wielder, type EnemyDef,
  type PlayerInputData, type Skill,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;

const PERFECT_LEAD_STEPS = 6;
const SEEDS = [1, 2, 3, 1234, 99999];

function reader(fight: Fight): PlayerInputData {
  const at = fight.world.require(fight.players[0]!, Body).pos;
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const swing = fight.world.require(fight.enemies[0]!, Wielder).swing;
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.2 ? 1 : dist < 1.4 ? -1 : 0;
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ, locked: 0,
    way: Math.floor(fight.steps / 20) % 2 === 0 ? "lr" : "rl",
  };
  if (swing && swing.step < swing.liveAt) {
    input.block = swing.liveAt - swing.step <= PERFECT_LEAD_STEPS;
    return input;
  }
  const even = fight.steps % 2 === 0;
  if (kobold.state === "staggered" || kobold.state === "weaponRecover") input.attack = even ? "light" : null;
  return input;
}

const play = (seed: number, next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(KOBOLD, seed);
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp };
};

describe("the Kobold Swordsman", () => {
  test("winds up as long as it did with its heavier blade: the first a long tell, the ones after it shorter", () => {
    const felt = feltHeft(WEAPONS["kobold-blade"], KOBOLD.stats.strength), def = KOBOLD.attacks.weapon!;
    assert.ok(Math.abs(def.windup * felt - 1.43) < 0.01, `${def.windup * felt}`);
    assert.ok(Math.abs(def.chainWindup * felt - 0.58) < 0.01, `${def.chainWindup * felt}`);
  });

  test("its blade weighs as the Basic Sword: its first swing winds up the def's seconds, slower than a stick's", () => {
    const fight = fightWith(KOBOLD, 1), wielder = fight.world.require(fight.enemies[0]!, Wielder);
    for (let i = 0; i < 10 / FIXED_DT && wielder.swing?.step !== 1; i++) fight.step([IDLE_INPUT]);
    assert.equal(wielder.swing?.step, 1);
    const extra = wielder.swing!.attack === "heavy" ? HYBRID.heavy.extraTime : 0, windup = KOBOLD.attacks.weapon!.windup;
    const liveAt = (blade: "sword" | "old-stick") =>
      wayStepsAfter(WEAPONS[blade], windup + extra, extra > 0, KOBOLD.stats.strength).liveAt;
    assert.equal(wielder.swing!.liveAt, liveAt("sword"));
    assert.ok(liveAt("sword") > liveAt("old-stick"));
  });

  test("a player who reads it beats it, whatever its seed", () => {
    for (const seed of SEEDS) {
      const { fight, hp } = play(seed, reader);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 4, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who only holds a block loses: its blows wear the stamina down, the guard breaks and it cuts", () => {
    const { fight } = play(1, (f) => ({ ...reader(f), block: true, attack: null }));
    assert.equal(fight.outcome.state, "lost");
  });

  test("a player who only swings at it mostly loses", () => {
    const masher = (f: Fight): PlayerInputData =>
      ({ ...reader(f), block: false, attack: f.steps % 2 === 0 ? "light" : null });
    const lost = SEEDS.filter((seed) => play(seed, masher).fight.outcome.state === "lost").length;
    assert.ok(lost > SEEDS.length / 2, `lost ${lost} of ${SEEDS.length}`);
  });

  test("its own blade never drops: only its essence, besides treasure", () => {
    assert.equal(KOBOLD.wielder?.hands.rightHand, "kobold-blade");
    assert.deepEqual(ENEMIES["kobold-swordsman"].drops.map((d) => d.item), ["kobold-swordsman-essence"]);
  });
});

describe("stepping aside from a Bolt", () => {
  const BOLT: Skill = { segments: [{ form: "bolt", elements: [], modifiers: [] }] };
  const stepsAside = (def: EnemyDef, seed: number) => {
    const fight = fightWith(def, seed);
    const aimed = { ...IDLE_INPUT, aimX: 0, aimZ: 1 };
    fight.step([{ ...aimed, chant: true }]);
    fight.step([{ ...aimed, cast: BOLT }]);
    for (let i = 0; i < 1 / FIXED_DT; i++) {
      fight.step([aimed]);
      if (fight.world.require(fight.enemies[0]!, Enemy).state === "sidestep") return true;
    }
    return false;
  };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

  test("the Kobold sometimes does", () => assert.ok(seeds.some((seed) => stepsAside(KOBOLD, seed))));
  test("the boar never does", () => assert.ok(!seeds.some((seed) => stepsAside(ENEMIES["wild-boar"].def, seed))));
});
