import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { COMPASS, compassMarks, stripShiftPx } from "../../../src/ui/hud/compassMarks.js";

const markOffsetPx = (deg: number, turns: number) => deg * COMPASS.pxPerDeg + stripShiftPx(turns);

const centred = (turns: number) => compassMarks(turns).filter((m) => markOffsetPx(m.deg, turns) === 0);
const shown = (turns: number) =>
  compassMarks(turns).filter((m) => Math.abs(markOffsetPx(m.deg, turns)) <= COMPASS.widthPx / 2);

describe("compassMarks", () => {
  test("facing north puts N at the centre, and each quarter turn right the next way round", () => {
    assert.deepEqual(centred(0).map((m) => m.label), ["N"]);
    assert.deepEqual(centred(1).map((m) => m.label), ["E"]);
    assert.deepEqual(centred(2).map((m) => m.label), ["S"]);
    assert.deepEqual(centred(3).map((m) => m.label), ["W"]);
    assert.deepEqual(centred(-1).map((m) => m.label), ["W"]);
    assert.deepEqual(centred(4).map((m) => m.label), ["N"]);
  });

  test("facing north, east is to the right and west to the left", () => {
    const at = (label: string) => markOffsetPx(shown(0).find((m) => m.label === label)!.deg, 0);
    assert.ok(at("E") > 0 && at("W") < 0);
    assert.ok(at("NE") > 0 && at("NE") < at("E"));
  });

  test("the strip shows the way faced and both ways beside it, with the diagonals between", () => {
    for (const turns of [0, 1, 2, 3, -5, 7]) {
      assert.equal(shown(turns).filter((m) => !m.label.slice(1)).length, 3, `turns ${turns}`);
      assert.equal(shown(turns).filter((m) => m.label.length === 2).length, 2, `turns ${turns}`);
    }
  });

  test("it holds marks a quarter turn past each edge, so a turn slides in marks that are already there", () => {
    for (const turns of [0, 1, -3]) {
      const offsets = compassMarks(turns).map((m) => markOffsetPx(m.deg, turns));
      const quarterPx = 90 * COMPASS.pxPerDeg;
      assert.ok(Math.min(...offsets) <= -COMPASS.widthPx / 2 - quarterPx);
      assert.ok(Math.max(...offsets) >= COMPASS.widthPx / 2 + quarterPx);
    }
  });
});
