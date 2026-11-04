import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { IDLE_INPUT, quantizeInput, sameInput, type PlayerInputData } from "@infinite-tower/shared";

const input = (over: Partial<PlayerInputData>): PlayerInputData => ({ ...IDLE_INPUT, ...over });

describe("sameInput", () => {
  test("the same move, aim and buttons are the same input", () => {
    assert.equal(sameInput(input({ moveX: 0.5, attack: "light" }), input({ moveX: 0.5, attack: "light" })), true);
  });

  test("another attack is another input, so pressing one while another is held is a new press", () => {
    assert.equal(sameInput(input({ attack: "light" }), input({ attack: "heavy" })), false);
  });

  test("any field that differs makes it a change (sent to the server)", () => {
    const changes: Partial<PlayerInputData>[] = [
      { moveX: 0.5 }, { moveZ: -1 }, { aimX: 1, aimZ: 0 }, { aimPitchRad: 0.3 }, { jump: true }, { attack: "light" },
      { attackHeld: true }, { dodge: true }, { way: "lr" }, { block: true }, { bag: true },
      { use: { in: "bag", x: 1, y: 0 } },
    ];
    for (const o of changes) assert.equal(sameInput(IDLE_INPUT, input(o)), false, JSON.stringify(o));
  });
});

describe("quantizeInput", () => {
  test("rounds the move and the aim to 3 decimals, the buttons as they are", () => {
    const raw = input({
      moveX: 0.70710678, moveZ: -0.70710678, aimX: 0.12345, aimZ: 0.99235, aimPitchRad: -0.45678, attack: "heavy",
    });
    const rounded = input({
      moveX: 0.707, moveZ: -0.707, aimX: 0.123, aimZ: 0.992, aimPitchRad: -0.457, attack: "heavy",
    });
    assert.deepEqual(quantizeInput(raw), rounded);
  });

  test("survives JSON unchanged, so both sides run the same numbers", () => {
    const rounded = quantizeInput(input({ moveX: Math.SQRT1_2, moveZ: -0.1, aimX: Math.sin(1), aimZ: Math.cos(1) }));
    assert.deepEqual(JSON.parse(JSON.stringify(rounded)), rounded);
  });
});
