import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVERAGE_STAT, BASE_STATS, CARRY_LIMIT_AT_AVERAGE, carryLimit, DEFENSE_OFFSET, grownVitals, HIDDEN_STATS,
  HP_PER_VITALITY, HP_REGEN_DIVISOR, hpRegenPerSec, KNOCKBACK_TAKEN, knockbackTakenFactor, maxHpOf, moveSpeed, physicalDamage, physicalTakenFactor, PLAYER,
  SHOWN_STATS, skillDamage, skillTakenFactor, STAMINA_PER_POINT, staminaMaxOf, staminaRegenPerSec, STAT_KEYS, stunTime,
} from "@infinite-tower/shared";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual}`);
const times = (k: number) => k * AVERAGE_STAT;

test("every stat starts at the average; the hidden ones aren't among the shown ones", () => {
  assert.ok((HIDDEN_STATS as readonly string[]).includes("steadiness"));
  for (const stat of STAT_KEYS) assert.equal(BASE_STATS[stat], AVERAGE_STAT, stat);
  assert.deepEqual([...STAT_KEYS].sort(), [...SHOWN_STATS, ...HIDDEN_STATS].sort());
  for (const stat of HIDDEN_STATS) assert.ok(!(SHOWN_STATS as readonly string[]).includes(stat));
});

test("at the base stats every formula gives the base numbers", () => {
  assert.equal(physicalDamage(9, BASE_STATS), 9);
  assert.equal(skillDamage(10, BASE_STATS), 10);
  assert.equal(moveSpeed(6, BASE_STATS), 6);
  assert.equal(physicalTakenFactor(BASE_STATS), 1);
  assert.equal(skillTakenFactor(BASE_STATS), 1);
  assert.equal(stunTime(0.5, BASE_STATS), 0.5);
  assert.equal(staminaRegenPerSec(BASE_STATS, 1), PLAYER.staminaRegenPerSec);
  assert.equal(knockbackTakenFactor(BASE_STATS), 1);
});

test("strength and steadiness shrink the knockback a player takes, never past the floor", () => {
  close(knockbackTakenFactor({ ...BASE_STATS, strength: times(16) }), 1 / 16 ** KNOCKBACK_TAKEN.strengthPower);
  close(knockbackTakenFactor({ ...BASE_STATS, steadiness: times(4) }), 1 / 4 ** KNOCKBACK_TAKEN.steadinessPower);
  const both = { ...BASE_STATS, strength: times(16), steadiness: times(4) };
  close(knockbackTakenFactor(both), 1 / (16 ** KNOCKBACK_TAKEN.strengthPower * 4 ** KNOCKBACK_TAKEN.steadinessPower));
  const huge = { ...BASE_STATS, strength: times(1e6), steadiness: times(1e6) };
  assert.equal(knockbackTakenFactor(huge), KNOCKBACK_TAKEN.min);
});

test("HP comes from vitality, and the stamina bar from stamina", () => {
  assert.equal(maxHpOf(BASE_STATS), HP_PER_VITALITY * AVERAGE_STAT);
  assert.equal(maxHpOf({ ...BASE_STATS, vitality: 25 }), 25 * HP_PER_VITALITY);
  assert.equal(staminaMaxOf({ ...BASE_STATS, stamina: 25 }), 25 * STAMINA_PER_POINT);
});

test("strength and skillpower scale damage by their square root", () => {
  close(physicalDamage(9, { ...BASE_STATS, strength: times(4) }), 18);
  close(skillDamage(10, { ...BASE_STATS, skillpower: times(4) }), 20);
  assert.equal(skillDamage(10, { ...BASE_STATS, skillpower: 0 }), 0);
});

test("defense cuts physical damage taken, special defense skill damage, never to nothing", () => {
  const tough = { ...BASE_STATS, defense: 90, specialDefense: 40 };
  close(physicalTakenFactor(tough), (DEFENSE_OFFSET + AVERAGE_STAT) / (DEFENSE_OFFSET + 90));
  close(skillTakenFactor(tough), (DEFENSE_OFFSET + AVERAGE_STAT) / (DEFENSE_OFFSET + 40));
  assert.ok(physicalTakenFactor({ ...BASE_STATS, defense: 1e6 }) > 0);
});

test("toughness shortens stuns, stamina recovery speeds stamina's refill", () => {
  close(stunTime(1, { ...BASE_STATS, toughness: times(2) }), 0.5);
  close(staminaRegenPerSec({ ...BASE_STATS, staminaRecovery: times(2) }, 1), 2 * PLAYER.staminaRegenPerSec);
});

test("a status's regen factor scales stamina's refill", () => {
  close(staminaRegenPerSec(BASE_STATS, 1.5), 1.5 * PLAYER.staminaRegenPerSec);
});

test("HP regen grows with vitality and health regen alike", () => {
  close(hpRegenPerSec(BASE_STATS), (AVERAGE_STAT * AVERAGE_STAT) / HP_REGEN_DIVISOR);
  close(hpRegenPerSec({ ...BASE_STATS, vitality: times(2) }), 2 * hpRegenPerSec(BASE_STATS));
  close(hpRegenPerSec({ ...BASE_STATS, healthRegen: times(2) }), 2 * hpRegenPerSec(BASE_STATS));
});

test("agility and the carry limit grow by strength's and agility's fourth root", () => {
  close(moveSpeed(6, { ...BASE_STATS, agility: times(16) }), 12);
  assert.equal(carryLimit(BASE_STATS), CARRY_LIMIT_AT_AVERAGE);
  close(carryLimit({ ...BASE_STATS, strength: times(16) }), 2 * CARRY_LIMIT_AT_AVERAGE);
});

test("when the stats grow, so do the bars and what's in them; when they shrink, only what's over is cut", () => {
  const bigger = { ...BASE_STATS, vitality: 12, stamina: 11 }, smaller = { ...BASE_STATS, vitality: 8 };
  assert.deepEqual(grownVitals({ hp: 50, stamina: 30 }, BASE_STATS, bigger), {
    hp: 50 + 2 * HP_PER_VITALITY, stamina: 30 + STAMINA_PER_POINT,
  });
  assert.deepEqual(grownVitals({ hp: 50, stamina: 30 }, BASE_STATS, smaller), { hp: 50, stamina: 30 });
  assert.deepEqual(grownVitals({ hp: 95, stamina: 30 }, BASE_STATS, smaller), { hp: maxHpOf(smaller), stamina: 30 });
});
