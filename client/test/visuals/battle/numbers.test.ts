import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DAMAGE_TYPES } from "@infinite-tower/shared";
import type { FightEvent } from "@infinite-tower/shared/fight";
import {
  DAMAGE_COLOUR, DAMAGE_NUMBERS, damageNumbers, numberLook, SKILL_COLOUR,
} from "../../../src/visuals/battle/numbers.js";

type Hit = Extract<FightEvent, { type: "hit" }>;
const AT = { x: 1, y: 2, z: 3 };
const hit = (over: Partial<Hit>): Hit =>
  ({ type: "hit", by: 0, target: 1, team: "enemy", damage: 0, weapon: true, ...over });

describe("floating damage numbers", () => {
  test("a weapon's hit shows one number per type it dealt, each in its type's colour, left to right", () => {
    const numbers = damageNumbers(hit({ damage: 9, byType: { slash: 8, stab: 0, blunt: 1 } }), AT);
    assert.deepEqual(numbers.map((n) => [n.text, n.colour]), [["8", DAMAGE_COLOUR.slash], ["1", DAMAGE_COLOUR.blunt]]);
    assert.deepEqual(numbers.map((n) => n.slot), [0, 1]);
    for (const n of numbers) assert.deepEqual([n.at, n.slots, n.age], [AT, 2, 0]);
  });

  test("the three types' colours and a skill's are all different", () => {
    const colours = [...DAMAGE_TYPES.map((type) => DAMAGE_COLOUR[type]), SKILL_COLOUR];
    assert.equal(new Set(colours).size, colours.length);
  });

  test("a hit with no types (a skill's) shows one number in the skill colour; one that dealt nothing, none", () => {
    assert.deepEqual(damageNumbers(hit({ damage: 12, weapon: false }), AT).map((n) => [n.text, n.colour]),
      [["12", SKILL_COLOUR]]);
    assert.deepEqual(damageNumbers(hit({ damage: 0, byType: { slash: 0, stab: 0, blunt: 0 } }), AT), []);
    assert.deepEqual(damageNumbers(hit({ damage: 0, weapon: false }), AT), []);
  });

  test("amounts show one decimal place at most", () => {
    const numbers = damageNumbers(hit({ damage: 11.25, byType: { slash: 10, stab: 0, blunt: 1.25 } }), AT);
    assert.deepEqual(numbers.map((n) => n.text), ["10", "1.3"]);
  });

  test("a number rises and fades over its life, then it's gone", () => {
    const [n] = damageNumbers(hit({ damage: 5, byType: { slash: 0, stab: 5, blunt: 0 } }), AT);
    const at = (age: number) => numberLook({ ...n!, age });
    assert.deepEqual(at(0), { risePx: 0, alpha: 1 });
    const half = at(DAMAGE_NUMBERS.lifeTime / 2)!, late = at(DAMAGE_NUMBERS.lifeTime * 0.95)!;
    assert.ok(half.risePx > 0 && late.risePx > half.risePx && late.risePx <= DAMAGE_NUMBERS.risePx);
    assert.ok(late.alpha < 1 && late.alpha > 0);
    assert.equal(at(DAMAGE_NUMBERS.lifeTime), null);
  });
});
