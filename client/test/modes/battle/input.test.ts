import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT } from "@infinite-tower/shared";
import type { Polled } from "../../../src/core/actions.js";
import { readPlayerInput } from "../../../src/modes/battle/input.js";

const polled = (over: Partial<Polled>): Polled =>
  ({
    held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragging: false, zoom: 0, ...over,
  });

const AHEAD = { x: 0, z: 1, pitchRad: 0 };

describe("the arena's keys into the fight's input", () => {
  test("the light attack is pressed on the step it goes down and held while it stays down", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled({ pressed: ["lightAttack"], held: new Set(["lightAttack"]) }), 0, "tb", input, AHEAD);
    assert.deepEqual([input.attack, input.attackHeld], ["light", true]);
    readPlayerInput(polled({ held: new Set(["lightAttack"]) }), 0, "tb", input, AHEAD);
    assert.deepEqual([input.attack, input.attackHeld], [null, true]);
    readPlayerInput(polled({}), 0, "tb", input, AHEAD);
    assert.deepEqual([input.attack, input.attackHeld], [null, false]);
  });

  test("a heavy held isn't the light attack held", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled({ held: new Set(["heavyAttack"]) }), 0, "tb", input, AHEAD);
    assert.equal(input.attackHeld, false);
  });

  test("walking goes by the camera's yaw, the aim by its own way and pitch", () => {
    const input = copyInput(IDLE_INPUT), aim = { x: 0.6, z: 0.8, pitchRad: 0.25 };
    readPlayerInput(polled({ move: { x: 0, z: 1 } }), Math.PI / 2, "tb", input, aim);
    assert.ok(near(input.moveX, 1) && near(input.moveZ, 0), `${input.moveX}, ${input.moveZ}`);
    assert.deepEqual([input.aimX, input.aimZ, input.aimPitchRad], [0.6, 0.8, 0.25]);
  });
});

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
