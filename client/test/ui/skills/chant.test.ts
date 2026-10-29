import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MODIFIER_FITS, FORMS, WORDS, type Word, type WordKind } from "@infinite-tower/shared";
import {
  addWord, back, choices, KINDS, kindOpen, NO_CHANT, pickNumber, type ChantState,
} from "../../../src/ui/skills/chant.js";

const ALL: ReadonlySet<Word> = new Set(WORDS);
const allowed = (words: Word[], known = ALL, query = "") =>
  choices(words, known, query).filter((c) => c.why === null).map((c) => c.word);
const chanting = (...words: Word[]): ChantState => ({ ...NO_CHANT, open: true, words });
const inKind = (kind: WordKind, ...words: Word[]): ChantState => ({ ...chanting(...words), kind });

describe("the chant's carousel: what the next square takes", () => {
  test("first a Form", () => {
    assert.deepEqual(allowed([]), [...FORMS]);
  });

  test("after a Form, an element", () => {
    assert.deepEqual(allowed(["bolt"]), ["fire", "water", "earth", "air", "lightning", "light", "darkness"]);
  });

  test("after an element: another element, a modifier that fits the Form, or a Form starting the next segment", () => {
    const next = allowed(["bolt", "fire"]);
    assert.ok(next.includes("lightning"));
    assert.ok(!next.includes("fire"), "not the same element twice");
    assert.ok(!next.includes("water"), "not its opposite");
    assert.ok(next.includes("split"));
    assert.ok(!next.includes("widen"), "Widen doesn't fit a Bolt");
    assert.ok(next.includes("nova"));
  });

  test("after a modifier: another modifier or a Form, no more elements", () => {
    const next = allowed(["bolt", "fire", "swift"]);
    assert.ok(next.includes("pierce"));
    assert.ok(next.includes("bolt"));
    assert.ok(!next.includes("earth"));
  });

  test("a new Form's segment is judged on its own: its elements and modifiers start over", () => {
    const next = allowed(["bolt", "fire", "nova", "water"]);
    assert.ok(next.includes("widen"), "Widen fits the Nova");
    assert.ok(!next.includes("split"), "Split doesn't");
    assert.ok(!next.includes("water"));
    assert.ok(!next.includes("fire"), "Fire is Water's opposite in this segment");
  });

  test("only words the player knows are offered; a known word that doesn't fit is there, with why", () => {
    const known = new Set<Word>(["bolt", "fire", "water", "widen"]);
    assert.deepEqual(choices(["bolt", "fire"], known).map((c) => c.word), ["bolt", "fire", "water", "widen"]);
    assert.deepEqual(
      choices(["bolt", "fire"], known).map((c) => c.why), ["no-chaining", "repeated", "opposite", "doesnt-fit"],
    );
    assert.deepEqual(allowed([], new Set()), []);
  });

  test("the search keeps the words that contain it", () => {
    assert.deepEqual(allowed(["bolt"], ALL, "li"), ["lightning", "light"]);
    assert.deepEqual(allowed(["bolt"], ALL, "WAT"), ["water"]);
  });

  test("one kind's words alone, if it can come next", () => {
    assert.deepEqual(choices(["bolt", "fire"], ALL, "", "form").map((c) => c.word), [...FORMS]);
    assert.deepEqual(choices(["bolt"], ALL, "", "modifier"), []);
  });
});

describe("the chant's two steps: a kind, then one of its words", () => {
  test("the kinds keep their numbers: 1 Form, 2 Element, 3 Modifier", () => {
    assert.deepEqual(KINDS, ["form", "element", "modifier"]);
    assert.equal(NO_CHANT.kind, null);
  });

  test("a number opens a kind that can come next", () => {
    assert.equal(pickNumber(chanting(), 1, ALL).kind, "form");
    assert.equal(pickNumber(chanting("bolt"), 2, ALL).kind, "element");
    assert.equal(pickNumber(chanting("bolt", "fire"), 3, ALL).kind, "modifier");
  });

  test("a kind that can't come next, or with no word known, is shut and its number does nothing", () => {
    assert.ok(!kindOpen([], ALL, "element"));
    assert.ok(!kindOpen(["bolt"], ALL, "modifier"));
    assert.ok(!kindOpen(["bolt", "fire"], new Set<Word>(["bolt", "fire"]), "modifier"));
    assert.ok(kindOpen(["bolt", "fire"], ALL, "form"));
    const start = chanting();
    assert.equal(pickNumber(start, 2, ALL), start);
    assert.equal(pickNumber(start, 3, ALL), start);
    assert.equal(pickNumber(start, 4, ALL), start);
  });

  test("in a kind, the numbers go down its known words; one that doesn't fit keeps its number, doing nothing", () => {
    const elements = inKind("element", "bolt", "fire");
    const listed = choices(elements.words, ALL, "", "element").map((c) => c.word);
    assert.equal(listed[0], "fire");
    assert.equal(pickNumber(elements, 1, ALL), elements, "Fire is already in");
    const third = pickNumber(elements, 3, ALL);
    assert.deepEqual(third.words, ["bolt", "fire", listed[2]]);
    assert.equal(pickNumber(elements, listed.length + 1, ALL), elements);
  });

  test("a word picked goes in and goes back to the kinds, even where only one kind can come next", () => {
    const picked = pickNumber(inKind("form"), 1, ALL);
    assert.deepEqual(picked.words, [FORMS[0]]);
    assert.equal(picked.kind, null);
    assert.equal(pickNumber(picked, 1, ALL), picked, "only Element can come next, but its number is still 2");
    assert.equal(addWord(inKind("element", "bolt"), "fire", ALL).kind, null);
  });

  test("a search looks through every kind that can come next, whatever the step, and numbers its matches", () => {
    const lightning = pickNumber(chanting("bolt"), 1, ALL, "li");
    assert.deepEqual(lightning.words, ["bolt", "lightning"]);
    assert.equal(lightning.kind, null);
    assert.deepEqual(pickNumber(inKind("modifier", "bolt", "fire"), 1, ALL, " NOV ").words, ["bolt", "fire", "nova"]);
  });

  test("Backspace in a kind goes back to the kinds and keeps the words", () => {
    const back1 = back(inKind("element", "bolt", "fire"));
    assert.deepEqual(back1.words, ["bolt", "fire"]);
    assert.equal(back1.kind, null);
  });

  test("Backspace among the kinds takes off the last word", () => {
    assert.deepEqual(back(chanting("bolt", "fire")).words, ["bolt"]);
    assert.deepEqual(back(chanting()).words, []);
  });
});

describe("the chant's words", () => {
  test("a word that fits goes in; one that doesn't, or isn't known, changes nothing", () => {
    assert.deepEqual(addWord(chanting("bolt"), "fire", ALL).words, ["bolt", "fire"]);
    assert.deepEqual(addWord(chanting("bolt"), "split", ALL).words, ["bolt"], "a modifier before any element");
    assert.deepEqual(addWord(chanting("bolt"), "fire", new Set(["bolt"])).words, ["bolt"]);
  });

  test("every modifier is offered somewhere", () => {
    for (const modifier of Object.keys(MODIFIER_FITS) as Word[]) {
      const form = MODIFIER_FITS[modifier as keyof typeof MODIFIER_FITS][0];
      assert.ok(allowed([form, "fire"]).includes(modifier), modifier);
    }
  });
});
