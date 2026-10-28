/** The Kobold Swordsman as tuned: beatable by a player who reads its wind-ups, and no pushover for one who doesn't. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  blankSpellbook, Body, CHAIN, emptyBag, Enemy, FIXED_DT, Health, IDLE_INPUT, isSwing, liveStep, Player, PLAYER,
  reverseOf, starterEquipment, Wielder, type AttackKind, type EnemyDef, type PlayerInputData, type Spell,
} from "@infinite-tower/shared";
import { ENEMY_START, ENEMY_START_YAW, Fight, initPhysics, PLAYER_START } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/content/enemies.js";
import { fullVitals, PLAYER_STATS } from "../../../src/core/content/player.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"];
const LIVE_AFTER = liveStep(CHAIN.startupTime.opening);

const newFight = (seed: number, def: EnemyDef = KOBOLD) => new Fight({
  arena: { radius: 16 },
  players: [{ at: PLAYER_START, vitals: fullVitals(PLAYER_STATS), stats: PLAYER_STATS, burden: "light",
    gear: { bag: emptyBag(), equipment: starterEquipment() }, book: blankSpellbook() }],
  enemies: [{ def, at: ENEMY_START, yaw: ENEMY_START_YAW, seed }],
});

/**
 * Keeps about a sword's length away, facing it. Parries each swing (the reverse, its blade live two steps before
 * the Kobold's lands), blocks its stabs, and swings back, left and right, only while it's open: recovering,
 * stunned or staggered.
 */
const lastAttacks = new WeakMap<Fight, AttackKind>();
function watchful(fight: Fight): PlayerInputData {
  const me = fight.world.require(fight.players[0]!, Player), at = fight.world.require(fight.players[0]!, Body).pos;
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const mine = fight.world.require(fight.players[0]!, Wielder).swing;
  const its = fight.world.require(fight.enemies[0]!, Wielder).swing;
  if (mine) lastAttacks.set(fight, mine.attack);
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.3 ? 1 : dist < 1.5 ? -1 : 0;
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ,
  };
  const winding = kobold.state === "swordWindup" || kobold.state === "sword";
  if (winding && its && !isSwing(its.attack)) return { ...input, moveX: 0, moveZ: 0, block: true };
  if (kobold.state === "swordWindup" && its && isSwing(its.attack)) {
    const landsIn = Math.ceil((kobold.duration - kobold.stateTime) / FIXED_DT - 1e-6);
    if (landsIn === LIVE_AFTER + 2) input.attack = reverseOf(its.attack);
    return input;
  }
  const open = kobold.state === "swordRecover" || kobold.state === "parried" || kobold.state === "staggered";
  const free = me.action === "none" || (mine !== null && mine.step >= mine.letGoAt);
  if (open && free && fight.steps % 2 === 0) input.attack = (lastAttacks.get(fight) ?? "lr") === "lr" ? "rl" : "lr";
  return input;
}

describe("the Kobold Swordsman", () => {
  test("a player who reads its wind-ups beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const fight = newFight(seed);
      while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([watchful(fight)]);
      const hp = fight.world.require(fight.players[0]!, Health).hp;
      console.log(`seed ${seed}: ${fight.outcome.state} in ${(fight.steps / 60).toFixed(1)} s, ${hp} HP left`);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > PLAYER.maxHp / 3, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("swinging at it on guard gets you parried", () => {
    const fight = newFight(1);
    let parried = 0;
    for (let i = 0; i < 20 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      const input = watchful(fight);
      if (fight.world.require(fight.enemies[0]!, Enemy).state === "approach" && i % 30 === 0) input.attack = "tb";
      fight.step([input]);
      parried += fight.events.filter((e) => e.type === "parry" && e.by === fight.enemies[0]).length;
    }
    assert.ok(parried > 0);
  });
});

describe("stepping aside from a Bolt", () => {
  const BOLT: Spell = { segments: [{ form: "bolt", elements: [], augments: [] }] };
  const stepsAside = (def: EnemyDef, seed: number) => {
    const fight = newFight(seed, def);
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
  test("the boar never does", () => assert.ok(!seeds.some((seed) => stepsAside(ENEMIES["wild-boar"], seed))));
});
