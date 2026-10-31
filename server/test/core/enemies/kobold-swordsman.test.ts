import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, IDLE_INPUT, Player, Wielder, type EnemyDef, type PlayerInputData, type Skill,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;

const TAP_LEAD_STEPS = 6;

function reader(fight: Fight): PlayerInputData {
  const at = fight.world.require(fight.players[0]!, Body).pos, me = fight.world.require(fight.players[0]!, Player);
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const swing = fight.world.require(fight.enemies[0]!, Wielder).swing;
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.2 ? 1 : dist < 1.4 ? -1 : 0;
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ, locked: 0,
    way: Math.floor(fight.steps / 20) % 2 === 0 ? "lr" : "rl",
  };
  if (swing && swing.step < swing.liveAt) {
    input.block = swing.liveAt - swing.step <= TAP_LEAD_STEPS;
    return input;
  }
  const even = fight.steps % 2 === 0;
  if (kobold.state === "staggered" || kobold.state === "weaponRecover") input.attack = even ? "light" : null;
  else if (kobold.state === "approach" && me.action === "none") input.kick = even && dist < 1.6;
  return input;
}

const play = (seed: number, next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(KOBOLD, seed);
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp };
};

describe("the Kobold Swordsman", () => {
  test("winds up its swings as long as it used to: the first a long tell, the ones after it shorter", () => {
    assert.equal(KOBOLD.attacks.weapon!.windup, 1.1);
    assert.equal(KOBOLD.attacks.weapon!.chainWindup, 0.45);
  });

  test("a player who reads it beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const { fight, hp } = play(seed, reader);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 4, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who only holds a block loses: it kicks the block open and cuts", () => {
    const { fight } = play(1, (f) => ({ ...reader(f), block: true, attack: null, kick: false }));
    assert.equal(fight.outcome.state, "lost");
  });

  test("a player who only swings at it loses", () => {
    const { fight } = play(1, (f) => ({ ...reader(f), block: false, attack: f.steps % 2 === 0 ? "light" : null }));
    assert.equal(fight.outcome.state, "lost");
  });

  test("its own blade never drops, even on the lowest roll", () => {
    assert.equal(KOBOLD.wielder?.hands.rightHand, "kobold-blade");
    assert.deepEqual(rollDrops("kobold-swordsman", () => 0), { "kobold-swordsman-essence": 1 }, "only its essence");
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
