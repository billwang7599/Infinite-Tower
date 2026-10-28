import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AUGMENT_FITS, FORMS, WORDS, type Word } from "@infinite-tower/shared";
import {
  addWord, choices, NO_CHANT, quickPick, spellOf, undoWord, wordsOf, type ChantState,
} from "../../../src/ui/spells/chant.js";

const ALL: ReadonlySet<Word> = new Set(WORDS);
const allowed = (words: Word[], known = ALL, query = "") =>
  choices(words, known, query).filter((c) => c.why === null).map((c) => c.word);
const chanting = (...words: Word[]): ChantState => ({ ...NO_CHANT, open: true, words });

describe("the chant's carousel: what the next square takes", () => {
  test("first a Form", () => {
    assert.deepEqual(allowed([]), [...FORMS]);
  });

  test("after a Form, an element", () => {
    assert.deepEqual(allowed(["bolt"]), ["fire", "water", "earth", "air", "lightning", "light", "darkness"]);
  });

  test("after an element: another element, an augment that fits the Form, or a Form starting the next segment", () => {
    const next = allowed(["bolt", "fire"]);
    assert.ok(next.includes("lightning"));
    assert.ok(!next.includes("fire"), "not the same element twice");
    assert.ok(!next.includes("water"), "not its opposite");
    assert.ok(next.includes("split"));
    assert.ok(!next.includes("widen"), "Widen doesn't fit a Bolt");
    assert.ok(next.includes("nova"));
  });

  test("after an augment: another augment or a Form, no more elements", () => {
    const next = allowed(["bolt", "fire", "swift"]);
    assert.ok(next.includes("pierce"));
    assert.ok(next.includes("bolt"));
    assert.ok(!next.includes("earth"));
  });

  test("a new Form's segment is judged on its own: its elements and augments start over", () => {
    const next = allowed(["bolt", "fire", "nova", "water"]);
    assert.ok(next.includes("widen"), "Widen fits the Nova");
    assert.ok(!next.includes("split"), "Split doesn't");
    assert.ok(!next.includes("water"));
    assert.ok(!next.includes("fire"), "Fire is Water's opposite in this segment");
  });

  test("only words the player knows are offered; a known word that doesn't fit is there, with why", () => {
    const known = new Set<Word>(["bolt", "fire", "water", "widen"]);
    assert.deepEqual(choices(["bolt", "fire"], known).map((c) => c.word), ["fire", "water", "widen", "bolt"]);
    assert.deepEqual(
      choices(["bolt", "fire"], known).map((c) => c.why), ["repeated", "opposite", "doesnt-fit", "no-chaining"],
    );
    assert.deepEqual(allowed([], new Set()), []);
  });

  test("the search keeps the words that contain it", () => {
    assert.deepEqual(allowed(["bolt"], ALL, "li"), ["lightning", "light"]);
    assert.deepEqual(allowed(["bolt"], ALL, "WAT"), ["water"]);
  });
});

describe("the chant's words", () => {
  test("a number picks among the words that fit, in the order they're listed", () => {
    const listed = choices(["bolt", "fire"], ALL, "");
    const fitting = listed.filter((c) => c.why === null);
    assert.equal(quickPick(listed, 1), fitting[0]!.word);
    assert.equal(quickPick(listed, 3), fitting[2]!.word);
    assert.equal(quickPick(listed, fitting.length + 1), null);
  });

  test("a word that fits goes in; one that doesn't, or isn't known, changes nothing", () => {
    assert.deepEqual(addWord(chanting("bolt"), "fire", ALL).words, ["bolt", "fire"]);
    assert.deepEqual(addWord(chanting("bolt"), "split", ALL).words, ["bolt"], "an augment before any element");
    assert.deepEqual(addWord(chanting("bolt"), "fire", new Set(["bolt"])).words, ["bolt"]);
  });

  test("Backspace takes off the last word", () => {
    assert.deepEqual(undoWord(chanting("bolt", "fire")).words, ["bolt"]);
    assert.deepEqual(undoWord(chanting()).words, []);
  });

  test("the words become a spell, a new segment at each Form", () => {
    assert.equal(spellOf([]), null);
    assert.deepEqual(spellOf(["bolt", "water", "swift", "nova", "lightning", "fire", "widen"]), {
      segments: [
        { form: "bolt", elements: ["water"], augments: ["swift"] },
        { form: "nova", elements: ["lightning", "fire"], augments: ["widen"] },
      ],
    });
    assert.deepEqual(spellOf(["self", "light"]), { segments: [{ form: "self", elements: ["light"], augments: [] }] });
  });

  test("every augment is offered somewhere", () => {
    for (const augment of Object.keys(AUGMENT_FITS) as Word[]) {
      const form = AUGMENT_FITS[augment as keyof typeof AUGMENT_FITS][0];
      assert.ok(allowed([form, "fire"]).includes(augment), augment);
    }
  });
});

describe("a written spell", () => {
  test("is its words again, in order, for the book's builder", () => {
    const words: Word[] = ["bolt", "water", "swift", "nova", "lightning"];
    assert.deepEqual(wordsOf(spellOf(words)!), words);
  });
});
