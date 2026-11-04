import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT } from "@infinite-tower/shared";
import type { Polled } from "../../../src/core/actions.js";
import { readPlayerInput } from "../../../src/modes/battle/input.js";

const polled = (over: Partial<Polled>): Polled =>
  ({ held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, ...over });

describe("the arena's keys into the fight's input", () => {
  test("the light attack is pressed on the step it goes down and held while it stays down", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled({ pressed: ["lightAttack"], held: new Set(["lightAttack"]) }), 0, "tb", input);
    assert.deepEqual([input.attack, input.attackHeld], ["light", true]);
    readPlayerInput(polled({ held: new Set(["lightAttack"]) }), 0, "tb", input);
    assert.deepEqual([input.attack, input.attackHeld], [null, true]);
    readPlayerInput(polled({}), 0, "tb", input);
    assert.deepEqual([input.attack, input.attackHeld], [null, false]);
  });

  test("a heavy held isn't the light attack held", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled({ held: new Set(["heavyAttack"]) }), 0, "tb", input);
    assert.equal(input.attackHeld, false);
  });
});
