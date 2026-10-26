import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { battleToasts, type BattleOutcome } from "../../src/game/battle-toasts.js";

const WIN: BattleOutcome = { won: true, accepted: true, loot: {}, leftBehind: {}, lost: {} };
const LOSS: BattleOutcome = { won: false, accepted: true, loot: {}, leftBehind: {}, lost: {} };
const REFUSED: BattleOutcome = { won: false, accepted: false, loot: {}, leftBehind: {}, lost: {} };

describe("battleToasts", () => {
  test("a win says what was found", () => {
    const toasts = battleToasts({ ...WIN, loot: { "boar-meat": 2, "boar-hide": 1 } });
    assert.deepEqual(toasts, ["You found 2 boar meat, boar hide."]);
  });

  test("a win that dropped nothing says nothing", () => {
    assert.deepEqual(battleToasts(WIN), []);
  });

  test("a win with a full bag: only what fit is found, then what was left behind", () => {
    const toasts = battleToasts({
      ...WIN, loot: { "boar-meat": 3, "boar-hide": 1, "boar-tusk": 1 }, leftBehind: { "boar-meat": 1, "boar-hide": 1 },
    });
    assert.deepEqual(toasts, [
      "You found 2 boar meat, boar tusk.",
      "No room in your bag: you leave boar meat, boar hide behind.",
    ]);
  });

  test("a win where nothing fit only says what was left behind", () => {
    const dropped = { "boar-meat": 2, "boar-tusk": 1 };
    const toasts = battleToasts({ ...WIN, loot: dropped, leftBehind: dropped });
    assert.deepEqual(toasts, ["No room in your bag: you leave 2 boar meat, boar tusk behind."]);
  });

  test("dying with items says you died and what is gone", () => {
    const toasts = battleToasts({ ...LOSS, lost: { "boar-meat": 4, "boar-tusk": 1 } });
    assert.deepEqual(toasts, ["You died. Everything you carried is gone: 4 boar meat, boar tusk."]);
  });

  test("dying with an empty bag still says you died", () => {
    assert.deepEqual(battleToasts(LOSS), ["You died."]);
  });

  test("a refused win says so first, then what is gone", () => {
    const toasts = battleToasts({ ...REFUSED, lost: { "boar-hide": 1 } });
    assert.deepEqual(toasts, ["The server didn't accept that win.", "Everything you carried is gone: boar hide."]);
  });

  test("a refused win with an empty bag only says it was refused", () => {
    assert.deepEqual(battleToasts(REFUSED), ["The server didn't accept that win."]);
  });
});
