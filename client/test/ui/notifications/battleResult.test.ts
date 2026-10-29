import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { battleResultLines, type BattleOutcome } from "../../../src/ui/notifications/battleResult.js";

const WIN: BattleOutcome = { won: true, loot: {}, leftBehind: {}, lost: {} };
const LOSS: BattleOutcome = { won: false, loot: {}, leftBehind: {}, lost: {} };

describe("battleResultLines", () => {
  test("a win says what was found", () => {
    const said = battleResultLines({ ...WIN, loot: { "boar-meat": 2, "boar-hide": 1 } });
    assert.deepEqual(said, ["You found 2 boar meat, boar hide."]);
  });

  test("a win that dropped nothing says nothing", () => {
    assert.deepEqual(battleResultLines(WIN), []);
  });

  test("a win with a full bag: only what fit is found, then what was left behind", () => {
    const said = battleResultLines({
      ...WIN, loot: { "boar-meat": 3, "boar-hide": 1, "boar-tusk": 1 }, leftBehind: { "boar-meat": 1, "boar-hide": 1 },
    });
    assert.deepEqual(said, [
      "You found 2 boar meat, boar tusk.",
      "No room in your bag: you leave boar meat, boar hide behind.",
    ]);
  });

  test("a win where nothing fit only says what was left behind", () => {
    const dropped = { "boar-meat": 2, "boar-tusk": 1 };
    const said = battleResultLines({ ...WIN, loot: dropped, leftBehind: dropped });
    assert.deepEqual(said, ["No room in your bag: you leave 2 boar meat, boar tusk behind."]);
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
