import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  lineMoveSteps, ONE_STRIKE, strikeSteps, toSteps, type Line, type OneStrikeData, type SwingData,
} from "@infinite-tower/shared";
import { LINE_BLADES, strikeBlade } from "../../../src/visuals/battle/lines.js";
import { REST_BLADE } from "../../../src/visuals/battle/weapons.js";

const still = (line: Line, over: Partial<OneStrikeData> = {}): OneStrikeData => ({
  line, to: line, want: line, moveSteps: 0, offLineSteps: 0, stillSteps: 9, beatStep: null, pickupStep: null,
  loose: null, ...over,
});
const thrustAt = (line: Line, step: number): SwingData => ({
  attack: "light", side: "top", way: null, chain: 0, dir: { x: 0, z: 1 }, step, ...strikeSteps(1, "thrust"),
  damage: 0, poiseDamage: 0, posture: 0, perilous: null, line, punch: false, stance: null,
});

describe("One Strike's blade, drawn", () => {
  test("its three lines point it ahead at the head, the chest and the knees", () => {
    assert.ok(LINE_BLADES.high.y > LINE_BLADES.middle.y && LINE_BLADES.middle.y > LINE_BLADES.low.y);
    for (const line of ["high", "middle", "low"] as const) {
      assert.ok(LINE_BLADES[line].z > 0.5, line);
      assert.deepEqual(strikeBlade(still(line), null, 1).blade, LINE_BLADES[line]);
    }
  });

  test("moving between lines it passes between them, eased over the move", () => {
    const half = Math.round(lineMoveSteps(1) / 2);
    const { blade } = strikeBlade(still("middle", { to: "high", want: "high", moveSteps: half }), null, 1);
    assert.ok(blade.y > LINE_BLADES.middle.y && blade.y < LINE_BLADES.high.y);
  });

  test("a thrust draws the hand back as it winds up and drives it out along its line as it goes live", () => {
    const steps = strikeSteps(1, "thrust");
    const wound = strikeBlade(still("low"), thrustAt("low", steps.liveAt - 1), 1);
    const live = strikeBlade(still("low"), thrustAt("low", steps.liveAt), 1);
    assert.ok(wound.handZ < REST_BLADE.handZ);
    assert.ok(live.handZ > REST_BLADE.handZ);
    assert.deepEqual(live.blade, LINE_BLADES.low);
    assert.equal(live.exact, true);
  });

  test("knocked off line, it's knocked aside, out of every line", () => {
    const { blade } = strikeBlade(still("middle", { offLineSteps: toSteps(ONE_STRIKE.beat.offLineTime) }), null, 1);
    assert.ok(Math.abs(blade.x) > 0.6);
  });
});
