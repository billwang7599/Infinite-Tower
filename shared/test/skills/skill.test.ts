import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MODIFIER_FITS, MODIFIERS, releaseTime, ELEMENTS, FORMS, OPPOSITE, validateWord, SKILL, skillCost, skillOf,
  validateSkill, wordsOf, type Segment, type Skill, type Word, WORDS,
} from "@infinite-tower/shared";

const ALL: ReadonlySet<Word> = new Set(WORDS);
const STARTERS: ReadonlySet<Word> = new Set<Word>(["bolt", "fire", "earth"]);

const segment = (form: Segment["form"], elements: Segment["elements"] = [], modifiers: Segment["modifiers"] = []) =>
  ({ form, elements, modifiers });
const skill = (...segments: [Segment, ...Segment[]]): Skill => ({ segments });

describe("the words", () => {
  test("WORDS is every Form, element and modifier, once each", () => {
    assert.deepEqual([...WORDS].sort(), [...FORMS, ...ELEMENTS, ...MODIFIERS].sort());
  });

  test("opposites pair both ways; Lightning has none", () => {
    for (const element of ELEMENTS) {
      const opposite = OPPOSITE[element];
      if (opposite) assert.equal(OPPOSITE[opposite], element);
    }
    assert.equal(OPPOSITE.lightning, undefined);
    assert.equal(OPPOSITE.fire, "water");
    assert.equal(OPPOSITE.earth, "air");
    assert.equal(OPPOSITE.light, "darkness");
  });
});

describe("validateSkill", () => {
  test("a lone Form is a skill", () => {
    assert.deepEqual(validateSkill(skill(segment("bolt")), STARTERS), []);
  });

  test("the example chain is valid: Bolt Water, then Nova Lightning", () => {
    assert.deepEqual(validateSkill(skill(segment("bolt", ["water"]), segment("nova", ["lightning"])), ALL), []);
  });

  test("opposites can't share a stage, but may be in different segments", () => {
    assert.deepEqual(validateSkill(skill(segment("bolt", ["fire", "water"])), ALL), [
      { segment: 0, word: "water", at: 1, why: "opposite" },
    ]);
    assert.deepEqual(validateSkill(skill(segment("bolt", ["fire"]), segment("bolt", ["water"])), ALL), []);
  });

  test("an element is a set: the same one twice is rejected", () => {
    assert.deepEqual(validateSkill(skill(segment("nova", ["air", "air"])), ALL), [
      { segment: 0, word: "air", at: 1, why: "repeated" },
    ]);
  });

  test("a modifier may repeat", () => {
    assert.deepEqual(validateSkill(skill(segment("bolt", [], ["amplify", "amplify", "amplify"])), ALL), []);
  });

  test("no caps: any number of modifiers or segments is a skill", () => {
    const splits = Array.from({ length: 40 }, () => "split" as const);
    assert.deepEqual(validateSkill(skill(segment("bolt", [], splits)), ALL), []);
    const chain = Array.from({ length: 100 }, () => segment("nova")) as [Segment, ...Segment[]];
    assert.deepEqual(validateSkill(skill(...chain), ALL), []);
  });

  test("a modifier that doesn't fit its Form is rejected", () => {
    assert.deepEqual(validateSkill(skill(segment("nova", [], ["split", "widen"])), ALL), [
      { segment: 0, word: "split", at: 0, why: "doesnt-fit" },
    ]);
  });

  test("every modifier fits exactly its listed Forms", () => {
    for (const modifier of MODIFIERS) {
      for (const form of FORMS) {
        const fits = (MODIFIER_FITS[modifier] as readonly string[]).includes(form);
        assert.equal(validateWord(modifier, segment(form), 0, ALL), fits ? null : "doesnt-fit", `${modifier} on ${form}`);
      }
    }
  });

  test("the decided fits", () => {
    assert.deepEqual(MODIFIER_FITS.amplify, FORMS);
    assert.deepEqual([...MODIFIER_FITS.widen].sort(), ["beam", "nova"]);
    assert.deepEqual([...MODIFIER_FITS.pierce].sort(), ["beam", "bolt"]);
    assert.deepEqual([...MODIFIER_FITS.split], ["bolt"]);
    assert.deepEqual([...MODIFIER_FITS.extend].sort(), ["beam", "imbue", "nova", "self"]);
    assert.deepEqual([...MODIFIER_FITS.swift].sort(), ["beam", "bolt", "imbue"]);
  });

  test("a word the player hasn't learned is rejected", () => {
    assert.deepEqual(validateSkill(skill(segment("beam", ["water"])), STARTERS), [
      { segment: 0, word: "beam", at: 0, why: "not-learned" },
      { segment: 0, word: "water", at: 0, why: "not-learned" },
    ]);
  });

  test("chaining needs a second Form learned", () => {
    const chain = skill(segment("bolt", ["fire"]), segment("bolt", ["earth"]));
    assert.deepEqual(validateSkill(chain, STARTERS), [{ segment: 1, word: "bolt", at: 0, why: "no-chaining" }]);
    assert.deepEqual(validateSkill(chain, new Set([...STARTERS, "nova" as const])), []);
  });

  test("a rejected word doesn't count against the words after it", () => {
    assert.deepEqual(validateSkill(skill(segment("bolt", ["fire", "water", "light"])), ALL), [
      { segment: 0, word: "water", at: 1, why: "opposite" },
    ]);
  });
});

describe("validateWord (what the builder greys out)", () => {
  test("judges a word against the words already in its segment", () => {
    assert.equal(validateWord("water", segment("bolt", ["fire"]), 0, ALL), "opposite");
    assert.equal(validateWord("lightning", segment("bolt", ["fire"]), 0, ALL), null);
    assert.equal(validateWord("widen", segment("bolt"), 0, ALL), "doesnt-fit");
    assert.equal(validateWord("nova", segment("bolt"), 1, STARTERS), "not-learned");
  });
});

describe("skillCost", () => {
  const { cost } = SKILL;

  test("one segment: the sum of its words", () => {
    assert.equal(skillCost(skill(segment("bolt"))), cost.form);
    assert.equal(
      skillCost(skill(segment("bolt", ["fire", "air"], ["amplify"]))),
      cost.form + 2 * cost.element + cost.modifier,
    );
  });

  test("grows exponentially with the number of segments", () => {
    const one = segment("bolt", ["fire"]);
    const words = cost.form + cost.element;
    assert.equal(skillCost(skill(one, one)), 2 * words * SKILL.chainGrowth);
    assert.equal(skillCost(skill(one, one, one)), 3 * words * SKILL.chainGrowth ** 2);
  });

  test("a chain too long to count costs Infinity, never NaN", () => {
    const chain = Array.from({ length: 2000 }, () => segment("nova")) as [Segment, ...Segment[]];
    assert.equal(skillCost(skill(...chain)), Infinity);
    assert.equal(skillCost(skill(...chain), 0.01), Infinity);
  });

  test("a scale makes every skill cheaper (for dev servers)", () => {
    const chain = skill(segment("bolt", ["fire"]), segment("nova", ["earth"], ["widen"]));
    assert.equal(skillCost(chain, 0.01), skillCost(chain) * 0.01);
  });
});

describe("releaseTime", () => {
  test("a base plus a little per word", () => {
    assert.equal(releaseTime(skill(segment("bolt"))), SKILL.releaseTime.base + SKILL.releaseTime.perWord);
    const chain = skill(segment("bolt", ["water"], ["swift"]), segment("nova", ["lightning"]));
    assert.ok(Math.abs(releaseTime(chain) - (SKILL.releaseTime.base + 5 * SKILL.releaseTime.perWord)) < 1e-9);
  });
});

describe("skillOf: the words as they're chanted", () => {
  test("a new segment at each Form", () => {
    assert.equal(skillOf([]), null);
    assert.deepEqual(skillOf(["bolt", "water", "swift", "nova", "lightning", "fire", "widen"]), skill(
      segment("bolt", ["water"], ["swift"]), segment("nova", ["lightning", "fire"], ["widen"]),
    ));
    assert.deepEqual(skillOf(["self", "light"]), skill(segment("self", ["light"])));
  });

  test("words out of the grammar's order aren't a skill", () => {
    assert.equal(skillOf(["fire"]), null);
    assert.equal(skillOf(["bolt", "split", "fire"]), null);
    assert.equal(skillOf(["bolt", "nova"]), null);
  });

  test("wordsOf gives the words back, in order", () => {
    const words: Word[] = ["bolt", "water", "swift", "nova", "lightning"];
    assert.deepEqual(wordsOf(skillOf(words)!), words);
  });
});
