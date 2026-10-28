import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { ActiveHit, attackShape, Health, WEAPONS, Wielder, type EnemyDef } from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, IDLE, player, SWORDSMAN } from "../fixtures.js";

before(() => initPhysics());

const newFight = (def: EnemyDef) => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [enemy(def, { x: 0, y: 0.05, z: 2 })],
});

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
  test("swings it through the player's weapon system: its blade is up exactly while its swing is live", () => {
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
    assert.equal(hitbox?.range, attackShape("lr", WEAPONS.sword).range, "the sword's reach");
    assert.equal(hitbox?.attack, "lr");
    assert.ok(fight.world.require(fight.players[0]!, Health).hp < fight.world.require(fight.players[0]!, Health).max);
  });

  test("swings the same with the weapon in either hand", () => {
    const left = watch(newFight({ ...SWORDSMAN, hands: { leftHand: "sword" } }));
    assert.deepEqual(left, watch(newFight(SWORDSMAN)));
    assert.ok(left.some((s) => s.hit));
  });

  test("with nothing in its hands, never swings", () => {
    const fight = newFight({ ...SWORDSMAN, hands: undefined });
    assert.ok(watch(fight).every((s) => !s.hit && s.swingStep === null));
    assert.equal(fight.world.require(fight.players[0]!, Health).hp, fight.world.require(fight.players[0]!, Health).max);
  });
});
