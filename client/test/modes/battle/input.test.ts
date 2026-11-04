import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT, type Vec2, type Vec3 } from "@infinite-tower/shared";
import type { Polled } from "../../../src/core/actions.js";
import { CROSSHAIR_MIN_M, crosshairAim, readPlayerInput, type Aimed } from "../../../src/modes/battle/input.js";

const polled = (over: Partial<Polled>): Polled =>
  ({
    held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragged: false, zoom: 0, ...over,
  });

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

  test("walking goes by the camera's yaw, the aim by its own way", () => {
    const input = copyInput(IDLE_INPUT), aim = { x: 0.6, z: 0.8 };
    readPlayerInput(polled({ move: { x: 0, z: 1 } }), Math.PI / 2, "tb", input, aim);
    assert.ok(near(input.moveX, 1) && near(input.moveZ, 0), `${input.moveX}, ${input.moveZ}`);
    assert.deepEqual([input.aimX, input.aimZ], [0.6, 0.8]);
  });
});

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const way = (x: number, z: number): Vec2 => ({ x: x / Math.hypot(x, z), z: z / Math.hypot(x, z) });
const nearWay = (got: Vec2 | null, want: Vec2) =>
  assert.ok(got && near(got.x, want.x) && near(got.z, want.z), `${JSON.stringify(got)} vs ${JSON.stringify(want)}`);

describe("aiming where the crosshair is (the screen's centre)", () => {
  const me: Vec3 = { x: 0, y: 0.9, z: 0 };
  const foeAt = (x: number, z: number, heightM = 1.8): Aimed => ({
    body: { pos: { x, y: heightM / 2, z }, vel: { x: 0, y: 0, z: 0 }, centerHeight: heightM / 2, collider: 0 },
    fighter: { team: "enemy", side: -1, radius: 0.4, heightM },
  });
  // Over the left shoulder, looking parallel to the player's way: the centre's line passes 1 m left of the player.
  const eye = { x: -1, y: 3, z: -4 }, at = { x: -1, y: 2, z: 0 };

  test("aims at the floor the crosshair shows, not parallel to the camera", () => {
    nearWay(crosshairAim(eye, at, me, [], 20), way(-1, 8));
  });

  test("aims at the foe under the crosshair, where the line first meets it", () => {
    nearWay(crosshairAim(eye, at, me, [foeAt(-1, 6)], 20), way(-1, 6 - 0.4));
  });

  test("looking over the floor, aims at the arena's wall", () => {
    const level = { x: -1, y: 3, z: 0 };
    nearWay(crosshairAim(eye, level, me, [], 10), way(-1, Math.sqrt(100 - 1)));
  });

  test("a foe between the camera and the player is looked past", () => {
    nearWay(crosshairAim(eye, at, me, [foeAt(-1, -2, 3)], 20), way(-1, 8));
  });

  test("none when what it shows is beside or behind the player", () => {
    const down = { x: 0, y: 6, z: -CROSSHAIR_MIN_M }, feet = { x: 0, y: 0, z: CROSSHAIR_MIN_M / 2 };
    assert.equal(crosshairAim(down, feet, me, [], 20), null);
  });
});
