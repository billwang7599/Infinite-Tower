import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { battleResultLines, type BattleOutcome } from "../../../src/ui/notifications/battleResult.js";

const WIN: BattleOutcome = { won: true, loot: {}, lost: {} };
const LOSS: BattleOutcome = { won: false, loot: {}, lost: {} };

describe("battleResultLines", () => {
  test("a win says what was dropped, and that it lies where the fight began", () => {
    const said = battleResultLines({ ...WIN, loot: { "boar-meat": 2, "boar-hide": 1 } });
    assert.deepEqual(said, ["Dropped where the fight began: 2 boar meat, boar hide."]);
  });

  test("a win that dropped nothing says nothing", () => {
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
