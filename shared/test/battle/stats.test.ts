import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVERAGE_STAT, BASE_HP, BASE_STAMINA, BASE_STATS, CARRY_LIMIT_AT_AVERAGE, carryLimit, grownVitals, HIDDEN_STATS,
  HP_REGEN_SHARE_PER_SEC, hpRegenPerSec, KNOCKBACK_TAKEN, knockbackTakenFactor, maxHpOf, moveSpeed, physicalDamage,
  physicalTakenFactor, PLAYER, SHOWN_STATS, skillDamage, skillTakenFactor, STAT_POWERS, staminaMaxOf,
  staminaRegenPerSec, STAT_KEYS, stunTime,
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

test("HP comes from vitality, and the stamina bar from stamina, each by the bars' power, in whole points", () => {
  assert.equal(maxHpOf(BASE_STATS), BASE_HP);
  assert.equal(maxHpOf({ ...BASE_STATS, vitality: times(4) }), Math.round(BASE_HP * 4 ** STAT_POWERS.bar));
  assert.equal(staminaMaxOf({ ...BASE_STATS, stamina: times(4) }), Math.round(BASE_STAMINA * 4 ** STAT_POWERS.bar));
  assert.equal(maxHpOf({ ...BASE_STATS, vitality: times(4) }, 160), Math.round(160 * 4 ** STAT_POWERS.bar));
});

test("the stamina bar is 100 at the start (combat v2: everything is costed against 100)", () => {
  assert.equal(staminaMaxOf(BASE_STATS), 100);
});

test("strength and skillpower scale damage by damage's power", () => {
  close(physicalDamage(9, { ...BASE_STATS, strength: times(4) }), 9 * 4 ** STAT_POWERS.damage);
  close(skillDamage(10, { ...BASE_STATS, skillpower: times(4) }), 10 * 4 ** STAT_POWERS.damage);
  assert.equal(skillDamage(10, { ...BASE_STATS, skillpower: 0 }), 0);
});

test("defense cuts physical damage taken, special defense skill damage, never to nothing", () => {
  const tough = { ...BASE_STATS, defense: times(9), specialDefense: times(4) };
  close(physicalTakenFactor(tough), 9 ** -STAT_POWERS.defense);
  close(skillTakenFactor(tough), 4 ** -STAT_POWERS.defense);
  assert.ok(physicalTakenFactor({ ...BASE_STATS, defense: 1e6 }) > 0);
});

test("toughness shortens stuns, stamina recovery speeds stamina's refill", () => {
  close(stunTime(1, { ...BASE_STATS, toughness: times(4) }), 4 ** -STAT_POWERS.toughness);
  close(staminaRegenPerSec({ ...BASE_STATS, staminaRecovery: times(4) }, 1),
    4 ** STAT_POWERS.staminaRecovery * PLAYER.staminaRegenPerSec);
});

test("a status's regen factor scales stamina's refill", () => {
  close(staminaRegenPerSec(BASE_STATS, 1.5), 1.5 * PLAYER.staminaRegenPerSec);
});

test("HP regen is a share of the most HP a second, growing with health regen", () => {
  close(hpRegenPerSec(BASE_STATS), BASE_HP * HP_REGEN_SHARE_PER_SEC);
  const hale = { ...BASE_STATS, vitality: times(4) };
  close(hpRegenPerSec(hale), maxHpOf(hale) * HP_REGEN_SHARE_PER_SEC);
  close(hpRegenPerSec({ ...BASE_STATS, healthRegen: times(2) }), 2 * hpRegenPerSec(BASE_STATS));
});

test("agility and the carry limit grow by strength's and agility's fourth root", () => {
  close(moveSpeed(6, { ...BASE_STATS, agility: times(16) }), 6 * 16 ** STAT_POWERS.move);
  assert.equal(carryLimit(BASE_STATS), CARRY_LIMIT_AT_AVERAGE);
  close(carryLimit({ ...BASE_STATS, strength: times(16) }), 16 ** STAT_POWERS.carry * CARRY_LIMIT_AT_AVERAGE);
});

test("when the stats grow, so do the bars and what's in them; when they shrink, only what's over is cut", () => {
  const bigger = { ...BASE_STATS, vitality: 12, stamina: 11 }, smaller = { ...BASE_STATS, vitality: 8 };
  assert.deepEqual(grownVitals({ hp: 50, stamina: 30 }, BASE_STATS, bigger), {
    hp: 50 + maxHpOf(bigger) - BASE_HP, stamina: 30 + staminaMaxOf(bigger) - BASE_STAMINA,
  });
  assert.deepEqual(grownVitals({ hp: 50, stamina: 30 }, BASE_STATS, smaller), { hp: 50, stamina: 30 });
  assert.deepEqual(grownVitals({ hp: 95, stamina: 30 }, BASE_STATS, smaller), { hp: maxHpOf(smaller), stamina: 30 });
});
