import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AUGMENT_FITS, AUGMENTS, castTime, ELEMENTS, FORMS, OPPOSITE, rejectWord, SPELL, spellCost, spellProblems,
  type Segment, type Spell, type Word,
} from "@infinite-tower/shared";

const ALL: ReadonlySet<Word> = new Set<Word>([...FORMS, ...ELEMENTS, ...AUGMENTS]);
const STARTERS: ReadonlySet<Word> = new Set<Word>(["bolt", "fire", "earth"]);

const segment = (form: Segment["form"], elements: Segment["elements"] = [], augments: Segment["augments"] = []) =>
  ({ form, elements, augments });
const spell = (...segments: [Segment, ...Segment[]]): Spell => ({ segments });

describe("the words", () => {
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

describe("spellProblems", () => {
  test("a lone Form is a spell", () => {
    assert.deepEqual(spellProblems(spell(segment("bolt")), STARTERS), []);
  });

  test("the example chain is valid: Bolt Water, then Nova Lightning", () => {
    assert.deepEqual(spellProblems(spell(segment("bolt", ["water"]), segment("nova", ["lightning"])), ALL), []);
  });

  test("opposites can't share a stage, but may be in different segments", () => {
    assert.deepEqual(spellProblems(spell(segment("bolt", ["fire", "water"])), ALL), [
      { segment: 0, word: "water", at: 1, why: "opposite" },
    ]);
    assert.deepEqual(spellProblems(spell(segment("bolt", ["fire"]), segment("bolt", ["water"])), ALL), []);
  });

  test("an element is a set: the same one twice is rejected", () => {
    assert.deepEqual(spellProblems(spell(segment("nova", ["air", "air"])), ALL), [
      { segment: 0, word: "air", at: 1, why: "repeated" },
    ]);
  });

  test("an augment may repeat", () => {
    assert.deepEqual(spellProblems(spell(segment("bolt", [], ["amplify", "amplify", "amplify"])), ALL), []);
  });

  test("an augment that doesn't fit its Form is rejected", () => {
    assert.deepEqual(spellProblems(spell(segment("nova", [], ["split", "widen"])), ALL), [
      { segment: 0, word: "split", at: 0, why: "doesnt-fit" },
    ]);
  });

  test("every augment fits exactly its listed Forms", () => {
    for (const augment of AUGMENTS) {
      for (const form of FORMS) {
        const fits = (AUGMENT_FITS[augment] as readonly string[]).includes(form);
        assert.equal(rejectWord(augment, segment(form), 0, ALL), fits ? null : "doesnt-fit", `${augment} on ${form}`);
      }
    }
  });

  test("the decided fits", () => {
    assert.deepEqual(AUGMENT_FITS.amplify, FORMS);
    assert.deepEqual([...AUGMENT_FITS.widen].sort(), ["beam", "nova"]);
    assert.deepEqual([...AUGMENT_FITS.pierce].sort(), ["beam", "bolt"]);
    assert.deepEqual([...AUGMENT_FITS.split], ["bolt"]);
    assert.deepEqual([...AUGMENT_FITS.extend].sort(), ["beam", "imbue", "nova", "self"]);
    assert.deepEqual([...AUGMENT_FITS.swift].sort(), ["beam", "bolt", "imbue"]);
  });

  test("a word the player hasn't learned is rejected", () => {
    assert.deepEqual(spellProblems(spell(segment("beam", ["water"])), STARTERS), [
      { segment: 0, word: "beam", at: 0, why: "not-learned" },
      { segment: 0, word: "water", at: 0, why: "not-learned" },
    ]);
  });

  test("chaining needs a second Form learned", () => {
    const chain = spell(segment("bolt", ["fire"]), segment("bolt", ["earth"]));
    assert.deepEqual(spellProblems(chain, STARTERS), [{ segment: 1, word: "bolt", at: 0, why: "no-chaining" }]);
    assert.deepEqual(spellProblems(chain, new Set([...STARTERS, "nova" as const])), []);
  });

  test("a rejected word doesn't count against the words after it", () => {
    assert.deepEqual(spellProblems(spell(segment("bolt", ["fire", "water", "light"])), ALL), [
      { segment: 0, word: "water", at: 1, why: "opposite" },
    ]);
  });
});

describe("rejectWord (what the builder greys out)", () => {
  test("judges a word against the words already in its segment", () => {
    assert.equal(rejectWord("water", segment("bolt", ["fire"]), 0, ALL), "opposite");
    assert.equal(rejectWord("lightning", segment("bolt", ["fire"]), 0, ALL), null);
    assert.equal(rejectWord("widen", segment("bolt"), 0, ALL), "doesnt-fit");
    assert.equal(rejectWord("nova", segment("bolt"), 1, STARTERS), "not-learned");
  });
});

describe("spellCost", () => {
  const { cost } = SPELL;

  test("one segment: the sum of its words", () => {
    assert.equal(spellCost(spell(segment("bolt"))), cost.form);
    assert.equal(
      spellCost(spell(segment("bolt", ["fire", "air"], ["amplify"]))),
      cost.form + 2 * cost.element + cost.augment,
    );
  });

  test("grows exponentially with the number of segments", () => {
    const one = segment("bolt", ["fire"]);
    const words = cost.form + cost.element;
    assert.equal(spellCost(spell(one, one)), 2 * words * SPELL.chainGrowth);
    assert.equal(spellCost(spell(one, one, one)), 3 * words * SPELL.chainGrowth ** 2);
  });

  test("a scale makes every spell cheaper (for dev servers)", () => {
    const chain = spell(segment("bolt", ["fire"]), segment("nova", ["earth"], ["widen"]));
    assert.equal(spellCost(chain, 0.01), spellCost(chain) * 0.01);
  });
});

describe("castTime", () => {
  test("a base plus a little per word", () => {
    assert.equal(castTime(spell(segment("bolt"))), SPELL.castTime.base + SPELL.castTime.perWord);
    const chain = spell(segment("bolt", ["water"], ["swift"]), segment("nova", ["lightning"]));
    assert.ok(Math.abs(castTime(chain) - (SPELL.castTime.base + 5 * SPELL.castTime.perWord)) < 1e-9);
  });
});
