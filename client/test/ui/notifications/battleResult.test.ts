import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { battleResultLines, type BattleOutcome } from "../../../src/ui/notifications/battleResult.js";

const WIN: BattleOutcome = { won: true, lost: {} };
const LOSS: BattleOutcome = { won: false, lost: {} };

describe("battleResultLines", () => {
  test("a win says nothing: its drops were in the arena", () => {
    assert.deepEqual(battleResultLines(WIN), []);
  });

  test("dying with items says you died and what is gone", () => {
    const said = battleResultLines({ ...LOSS, lost: { "boar-meat": 4, "boar-tusk": 1 } });
    assert.deepEqual(said, ["You died. Lost for good: 4 boar meat, boar tusk."]);
  });

  test("dying with an empty bag still says you died", () => {
    assert.deepEqual(battleResultLines(LOSS), ["You died."]);
  });

  test("a duel says who won, and nothing about dying or items", () => {
    assert.deepEqual(battleResultLines({ ...WIN, duel: "Bee" }), ["You won the duel against Bee."]);
    assert.deepEqual(battleResultLines({ ...LOSS, duel: "Bee" }), ["You lost the duel against Bee."]);
  });
});
