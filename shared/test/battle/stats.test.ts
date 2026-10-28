import assert from "node:assert/strict";
import { test } from "node:test";
import { CARRY, carryLimit, moveSpeed, physicalDamage, skillDamage, type Stats } from "@infinite-tower/shared";

const stats = (strength: number, agility: number): Stats =>
  ({ stamina: 100, skillpower: 10, strength, agility });

test("10 is average: the base numbers, unchanged", () => {
  assert.equal(physicalDamage(9, stats(10, 10)), 9);
  assert.equal(moveSpeed(6, stats(10, 10)), 6);
});

test("strength scales damage and agility scales speed, in proportion", () => {
  assert.equal(physicalDamage(9, stats(20, 10)), 18);
  assert.equal(moveSpeed(6, stats(10, 5)), 3);
});

test("the carry limit grows with strength, from a base everyone has", () => {
  assert.equal(carryLimit(stats(0, 10)), CARRY.base);
  assert.equal(carryLimit(stats(20, 10)) - carryLimit(stats(10, 10)), 10 * CARRY.perStrength);
});

test("skillpower scales skill damage the same way", () => {
  assert.equal(skillDamage(10, { ...stats(10, 10), skillpower: 20 }), 20);
  assert.equal(skillDamage(10, stats(10, 10)), 10);
});
