import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyStatus, Body, Enemy, Health, HP_REGEN_PAUSE_TIME, hpRegenPerSec, maxHpOf, moveSpeed,
  physicalTakenFactor, PLAYER,
  skillTakenFactor, Stamina, staminaRegenPerSec, STAT_POWERS, Statuses, type EnemyDef, type Stats, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import {
  ARENA, BITER, castNow, enemy, input, player, run, segment, skill, STATS, STATUE, SWORDSMAN,
} from "./fixtures.js";

await initPhysics();

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const close = (actual: number, expected: number, within = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < within, `${actual} vs ${expected}`);
const HURT_HP = 50;

function fightWith(stats: Partial<Stats>, foe: EnemyDef = STATUE, foeAt = at(0, 6), hp = HURT_HP): Fight {
  return new Fight({
    arena: ARENA, enemies: [enemy(foe, foeAt)],
    players: [player(at(0, 0), { stats: { ...STATS, ...stats }, vitals: { hp, stamina: 0 } })],
  });
}
const health = (fight: Fight) => fight.world.require(fight.players[0]!, Health);

function bitten(stats: Partial<Stats>): { lost: number } {
  const fight = fightWith(stats, BITER, at(0, 1.5));
  for (let i = 0; i < 300 && health(fight).hp === HURT_HP; i++) fight.step([input({})]);
  return { lost: HURT_HP - health(fight).hp };
}

describe("the core's stats in a fight", () => {
  test("defense cuts what a body blow takes", () => {
    const plain = bitten({}), tough = bitten({ defense: 90 });
    assert.ok(plain.lost > 0);
    close(tough.lost, plain.lost * physicalTakenFactor({ ...STATS, defense: 90 }));
  });

  test("special defense cuts a skill's damage, not a blow's", () => {
    const hit = (specialDefense: number) => {
      const foe = { ...STATUE, stats: { ...STATUE.stats, specialDefense } };
      const fight = new Fight({ arena: ARENA, players: [player(at(0, 0))], enemies: [enemy(foe, at(0, 2))] });
      castNow(fight, skill(segment("nova", ["earth"])));
      return STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;
    };
    assert.ok(hit(STATS.specialDefense) > 0);
    close(hit(90), hit(STATS.specialDefense) * skillTakenFactor({ ...STATS, specialDefense: 90 }));
    close(bitten({ specialDefense: 90 }).lost, bitten({}).lost);
  });

  test("an enemy's toughness shortens its stagger", () => {
    const staggerOf = (toughness: number) => {
      const foe = { ...SWORDSMAN, poise: 1, attacks: {}, stats: { ...SWORDSMAN.stats, toughness } };
      const fight = new Fight({ arena: ARENA, players: [player(at(0, 0))], enemies: [enemy(foe, at(0, 1.6))] });
      run(fight, 0.2);
      const e = fight.enemies[0]!;
      for (let i = 0; i < 120 && fight.world.require(e, Enemy).state !== "staggered"; i++) {
        fight.step([input({ attack: i === 0 ? "light" : null, locked: 0 })]);
      }
      return fight.world.require(e, Enemy).duration;
    };
    assert.equal(staggerOf(STATS.toughness), SWORDSMAN.staggerTime);
    close(staggerOf(4 * STATS.toughness), SWORDSMAN.staggerTime / 4 ** STAT_POWERS.toughness);
  });

  test("stamina recovery speeds the refill", () => {
    const refilled = (staminaRecovery: number) => {
      const fight = fightWith({ staminaRecovery });
      run(fight, PLAYER.staminaRegenDelay + 0.5);
      return fight.world.require(fight.players[0]!, Stamina).value;
    };
    const plain = refilled(STATS.staminaRecovery), quick = refilled(2 * STATS.staminaRecovery);
    assert.ok(plain > 0);
    const regen = (staminaRecovery: number) => staminaRegenPerSec({ ...STATS, staminaRecovery }, 1);
    close(quick, plain * (regen(2 * STATS.staminaRecovery) / regen(STATS.staminaRecovery)), 1e-3);
  });

  test("agility speeds walking by its fourth root", () => {
    const walked = (agility: number) => {
      const fight = fightWith({ agility });
      run(fight, 0.4, () => input({ moveX: 1 }));
      return fight.world.require(fight.players[0]!, Body).vel.x;
    };
    close(walked(STATS.agility), PLAYER.moveSpeed);
    close(walked(16 * STATS.agility), moveSpeed(PLAYER.moveSpeed, { ...STATS, agility: 16 * STATS.agility }));
  });
});

describe("HP regen", () => {
  const regen = { ...STATS, healthRegen: 10 };

  test("a hurt player's HP comes back on its own, at the rate the stats give", () => {
    const fight = fightWith(regen);
    run(fight, 2);
    close(health(fight).hp, HURT_HP + 2 * hpRegenPerSec(regen), 0.05);
  });

  test("up to the most and no further", () => {
    const fight = fightWith(regen, STATUE, at(0, 6), maxHpOf(STATS) - 0.1);
    run(fight, 2);
    assert.equal(health(fight).hp, health(fight).max);
  });

  test("it stops for a while after any damage", () => {
    const fight = fightWith(regen, BITER, at(0, 1.5));
    for (let i = 0; i < 300 && health(fight).hp >= HURT_HP; i++) fight.step([input({})]);
    const bit = health(fight).hp;
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    run(fight, HP_REGEN_PAUSE_TIME - 0.1);
    assert.equal(health(fight).hp, bit, "paused");
    run(fight, 0.5);
    assert.ok(health(fight).hp > bit, "back");
  });

  test("not for the dead, and not with no health regen", () => {
    const dead = fightWith(regen, STATUE, at(0, 6), 0);
    run(dead, 2);
    assert.equal(health(dead).hp, 0);
    const none = fightWith({ healthRegen: 0 });
    run(none, 2);
    assert.equal(health(none).hp, HURT_HP);
  });

  test("a burn's damage pauses it too", () => {
    const fight = fightWith(regen);
    const statuses = fight.world.require(fight.players[0]!, Statuses);
    applyStatus(statuses.on, "burning", 1, 1);
    run(fight, 1 + HP_REGEN_PAUSE_TIME - 0.1);
    assert.ok(health(fight).hp < HURT_HP);
  });
});
