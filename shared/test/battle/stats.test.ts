import assert from "node:assert/strict";
import { test } from "node:test";
import { moveSpeed, physicalDamage, type Stats } from "@infinite-tower/shared";

const stats = (strength: number, agility: number): Stats =>
  ({ stamina: 100, mana: 0, spellpower: 10, strength, agility });

test("10 is average: the base numbers, unchanged", () => {
  assert.equal(physicalDamage(9, stats(10, 10)), 9);
  assert.equal(moveSpeed(6, stats(10, 10)), 6);
});

test("strength scales damage and agility scales speed, in proportion", () => {
  assert.equal(physicalDamage(9, stats(20, 10)), 18);
  assert.equal(moveSpeed(6, stats(10, 5)), 3);
});
