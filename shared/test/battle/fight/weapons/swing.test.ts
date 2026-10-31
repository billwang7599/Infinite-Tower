import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  ActiveHit, attackShape, Health, physicalDamage, WEAPONS, Wielder, type EnemyDef, type WeaponId,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, IDLE, player, SWORDSMAN } from "../fixtures.js";

const ARM = SWORDSMAN.wielder!.armReachM;

before(() => initPhysics());

const newFight = (def: EnemyDef) => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [enemy(def, { x: 0, y: 0.05, z: 2 })],
});

const holding = (hands: NonNullable<EnemyDef["wielder"]>["hands"], armReachM = ARM): EnemyDef =>
  ({ ...SWORDSMAN, wielder: { hands, armReachM } });

function firstHit(def: EnemyDef) {
  const fight = newFight(def), e = fight.enemies[0]!, me = fight.world.require(fight.players[0]!, Health);
  for (let i = 0; i < 3 / Fight.STEP_SECONDS && me.hp === me.max; i++) fight.step([IDLE]);
  return { hitbox: fight.world.get(e, ActiveHit), dealt: me.max - me.hp };
}

function watch(fight: Fight, seconds = 3) {
  const e = fight.enemies[0]!, out: { hit: boolean; swingStep: number | null }[] = [];
  for (let i = 0; i < seconds / Fight.STEP_SECONDS; i++) {
    fight.step([IDLE]);
    const swing = fight.world.get(e, Wielder)?.swing ?? null;
    out.push({ hit: fight.world.has(e, ActiveHit), swingStep: swing && swing.step - 1 });
  }
  return out;
}

describe("an enemy wielding a weapon", () => {
  test("attacks through the player's weapon system: its blade is up exactly while its attack is live", () => {
    const fight = newFight(SWORDSMAN), e = fight.enemies[0]!;
    let hitbox = null;
    const seen = [];
    for (let i = 0; i < 3 / Fight.STEP_SECONDS; i++) {
      fight.step([IDLE]);
      const swing = fight.world.require(e, Wielder).swing;
      hitbox ??= fight.world.get(e, ActiveHit) ?? null;
      if (swing) {
        const evaluated = swing.step - 1;
        const live = evaluated >= swing.liveAt && evaluated < swing.liveUntil;
        assert.equal(fight.world.has(e, ActiveHit), live, `step ${evaluated} of its swing`);
        seen.push(live);
      }
    }
    assert.ok(seen.includes(true) && seen.includes(false), "it wound up and swung");
    assert.equal(hitbox?.range, attackShape(hitbox!.side, ARM, WEAPONS.sword).range, "its arm and the sword's reach");
    assert.equal(hitbox?.attack, "light");
    assert.ok(fight.world.require(fight.players[0]!, Health).hp < fight.world.require(fight.players[0]!, Health).max);
  });

  test("swings the same with the weapon in either hand", () => {
    const left = watch(newFight(holding({ leftHand: "sword" })));
    assert.deepEqual(left, watch(newFight(SWORDSMAN)));
    assert.ok(left.some((s) => s.hit));
  });

  test("with nothing in its hands, never swings", () => {
    const fight = newFight(holding({}));
    assert.ok(watch(fight).every((s) => !s.hit && s.swingStep === null));
    assert.equal(fight.world.require(fight.players[0]!, Health).hp, fight.world.require(fight.players[0]!, Health).max);
  });

  test("hits for its weapon's damage, at the wielder's strength", () => {
    for (const item of ["sword", "kobold-blade"] satisfies WeaponId[]) {
      const { dealt } = firstHit(holding({ rightHand: item }));
      assert.equal(dealt, physicalDamage(WEAPONS[item].damage, SWORDSMAN.stats), item);
    }
  });

  test("reaches as far as its own arm plus the blade", () => {
    const { hitbox } = firstHit(holding({ rightHand: "sword" }, ARM + 0.3));
    assert.equal(hitbox?.range, attackShape(hitbox!.side, ARM + 0.3, WEAPONS.sword).range);
  });
});
