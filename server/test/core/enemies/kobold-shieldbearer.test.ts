import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, guardOf, Health, IDLE_INPUT, strikeOf, wayStepsAfter, WEAPONS, Wielder, windupTime,
  type EnemyDef, type PlayerInputData,
} from "@infinite-tower/shared";
import { blocking, initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const SHIELDBEARER = ENEMIES["kobold-shieldbearer"].def;
const SWORDSMAN = ENEMIES["kobold-swordsman"].def;

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

function play(def: EnemyDef, seed: number, next: (fight: Fight) => PlayerInputData) {
  const fight = fightWith(def, seed), e = fight.enemies[0]!;
  const seen = { blockingSteps: 0, perfect: 0, blocked: 0, parried: 0 };
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) {
    fight.step([next(fight)]);
    if (blocking(fight.world, e)) seen.blockingSteps++;
    for (const event of fight.events) {
      if (event.type === "block" && event.target === e) seen[event.perfect ? "perfect" : "blocked"]++;
      if (event.type === "parry" && event.by === e && !event.clash) seen.parried++;
    }
  }
  const hp = fight.world.require(fight.players[0]!, Health).hp;
  return { fight, hp, ...seen, blockingShare: seen.blockingSteps / fight.steps };
}

describe("the Kobold Shieldbearer", () => {
  test("is a Kobold with a kobold blade and a shield, so it guards as a shield does", () => {
    const { rightHand, leftHand } = SHIELDBEARER.wielder!.hands;
    assert.deepEqual([rightHand, leftHand], ["kobold-blade", "wooden-shield"]);
    assert.equal(guardOf({ rightHand: "kobold-blade", leftHand: "wooden-shield" })?.kind, "shield");
    assert.equal(SHIELDBEARER.wielder?.armReachM, SWORDSMAN.wielder?.armReachM);
  });

  test("swings as the Swordsman does: a player's opening with its Kobold blade, at the Swordsman's stats", () => {
    assert.deepEqual(SHIELDBEARER.stats, SWORDSMAN.stats);
    const fight = fightWith(SHIELDBEARER, 1), wielder = fight.world.require(fight.enemies[0]!, Wielder);
    for (let i = 0; i < 10 / FIXED_DT && wielder.swing?.step !== 1; i++) fight.step([IDLE_INPUT]);
    assert.equal(wielder.swing?.step, 1);
    const strike = strikeOf(wielder.swing!.attack, wielder.swing!.way);
    const opening = wayStepsAfter(WEAPONS["kobold-blade"], windupTime(strike, "opening"), strike === "heavy",
      SWORDSMAN.stats.strength);
    assert.equal(wielder.swing!.liveAt, opening.liveAt);
  });

  test("spends more of a fight behind its guard than the Swordsman, and perfect-blocks now and then", () => {
    let perfect = 0, blocked = 0;
    for (const seed of SEEDS) {
      const it = play(SHIELDBEARER, seed, reader), swordsman = play(SWORDSMAN, seed, reader);
      const [its, theirs] = [it.blockingShare, swordsman.blockingShare];
      assert.ok(its > theirs + 0.04, `seed ${seed}: ${its.toFixed(2)} of it, the Swordsman ${theirs.toFixed(2)}`);
      assert.ok(it.perfect > 0, `seed ${seed}: no perfect block`);
      perfect += it.perfect;
      blocked += it.blocked;
    }
    assert.ok(perfect < blocked, `${perfect} perfect, ${blocked} plain`);
  });

  test("never parries: the Swordsman meets a reader's swings with its blade, it only blocks them", () => {
    const parried = (def: EnemyDef) => SEEDS.reduce((n, seed) => n + play(def, seed, reader).parried, 0);
    assert.equal(SHIELDBEARER.attacks.weapon!.parryChance, 0);
    assert.equal(parried(SHIELDBEARER), 0);
    assert.ok(parried(SWORDSMAN) > 0, "the Swordsman parries");
  });

  test("a player who reads it beats it, whatever its seed", () => {
    for (const seed of SEEDS) {
      const { fight, hp } = play(SHIELDBEARER, seed, reader);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 4, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("its shield isn't a wall: blows into it break its guard into a stagger, heavies in fewer", () => {
    const blockedUntilBroken = (attack: "light" | "heavy") => {
      const weapon = { ...SHIELDBEARER.attacks.weapon!, firstDelay: 99, perfectBlockChance: 0 };
      const fight = fightWith({ ...SHIELDBEARER, attacks: { weapon } }, 1), e = fight.enemies[0]!;
      let blocked = 0;
      while (fight.world.require(e, Enemy).state !== "staggered" && fight.steps < 30 / FIXED_DT) {
        fight.step([{ ...reader(fight), attack: fight.steps % 2 === 0 ? attack : null }]);
        blocked += fight.events.filter((ev) => ev.type === "block" && ev.target === e).length;
        assert.ok(!fight.events.some((ev) => ev.type === "hit" && ev.target === e), `${attack}: hit past its shield`);
      }
      assert.equal(fight.world.require(e, Enemy).state, "staggered", attack);
      return blocked;
    };
    const heavies = blockedUntilBroken("heavy"), lights = blockedUntilBroken("light");
    assert.ok(heavies < lights, `${heavies} heavies, ${lights} lights`);
  });

  test("a player who only holds a block loses", () => {
    const { fight } = play(SHIELDBEARER, 1, (f) => ({ ...reader(f), block: true, attack: null }));
    assert.equal(fight.outcome.state, "lost");
  });

  test("a player who only swings at it mostly loses", () => {
    const masher = (f: Fight): PlayerInputData =>
      ({ ...reader(f), block: false, attack: f.steps % 2 === 0 ? "light" : null });
    const lost = SEEDS.filter((seed) => play(SHIELDBEARER, seed, masher).fight.outcome.state === "lost").length;
    assert.ok(lost > SEEDS.length / 2, `lost ${lost} of ${SEEDS.length}`);
  });

  test("its own blade and shield never drop: only its essence, besides treasure", () => {
    assert.deepEqual(ENEMIES["kobold-shieldbearer"].drops.map((d) => d.item), ["kobold-shieldbearer-essence"]);
  });
});
