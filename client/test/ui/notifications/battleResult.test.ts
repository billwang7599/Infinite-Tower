import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { coreName, newCore } from "@infinite-tower/shared";
import { battleResultLines, type BattleOutcome } from "../../../src/ui/notifications/battleResult.js";

const WIN: BattleOutcome = { won: true, lost: {}, core: newCore(), coreLost: null };
const LOSS: BattleOutcome = { won: false, lost: {}, core: newCore(), coreLost: null };

describe("battleResultLines", () => {
  test("a win says nothing: its drops were in the arena", () => {
    assert.deepEqual(battleResultLines(WIN), []);
  });

  test("dying with items says you died, what you dropped and where it ends up", () => {
    const said = battleResultLines({ ...LOSS, lost: { "boar-meat": 4, "boar-tusk": 1 } });
    const where = "what's left of it lands where the fight began";
    assert.deepEqual(said, [`You died and dropped 4 boar meat, boar tusk; ${where}.`]);
  });

  test("dying with an empty bag still says you died", () => {
    assert.deepEqual(battleResultLines(LOSS), ["You died."]);
  });

  test("dying says what the core lost: the essence it held, or a whole step and where that leaves it", () => {
    assert.deepEqual(battleResultLines({ ...LOSS, coreLost: "fill" }), [
      "You died.", "Your core dims: the essence it held is gone.",
    ]);
    const fellTo = { ...newCore(), steps: 2 };
    assert.deepEqual(battleResultLines({ ...LOSS, core: fellTo, coreLost: "step" }), [
      "You died.", `Your core dims: it falls back to ${coreName(fellTo)}.`,
    ]);
  });

  test("a duel says who won, and nothing about dying or items", () => {
    assert.deepEqual(battleResultLines({ ...WIN, duel: "Bee" }), ["You won the duel against Bee."]);
    assert.deepEqual(battleResultLines({ ...LOSS, duel: "Bee" }), ["You lost the duel against Bee."]);
  });

  test("a spar's win says nothing (the questbook does), and its loss only that you yielded", () => {
    assert.deepEqual(battleResultLines({ ...WIN, spar: "Bram" }), []);
    assert.deepEqual(battleResultLines({ ...LOSS, spar: "Bram" }), ["You yield to Bram."]);
  });
});
