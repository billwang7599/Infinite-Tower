import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT, type Vec3 } from "@infinite-tower/shared";
import type { Polled } from "../../../src/core/actions.js";
import {
  closestFoe, inViewFoe, lockYaw, pointedFoe, steerLock, type Foe,
} from "../../../src/modes/battle/lock.js";
import { readPlayerInput } from "../../../src/modes/battle/input.js";

const at = (x: number, z: number, y = 0.5): Vec3 => ({ x, y, z });
const player = at(0, -4);
const aim = { eye: at(0, -10, 3), at: at(0, 0), fovRad: Math.PI / 2 };

const current: Foe = { e: 1, pos: at(0, 0) };
const left: Foe = { e: 2, pos: at(-3, 0) };
const right: Foe = { e: 3, pos: at(3, 0) };
const far: Foe = { e: 4, pos: at(0, 6) };
const near: Foe = { e: 5, pos: at(0, -2) };
const foes = [current, left, right, far, near];

const polled = (pressed: Polled["pressed"], move = { x: 0, z: 0 }): Polled =>
  ({ held: new Set(), pressed, flicks: [], move, turn: 0, look: 0, dragging: false, zoom: 0 });
const steer = (pressed: Polled["pressed"], free = false, wasFree = free) => ({ pressed, free, wasFree });
const looking = (x: number, z: number) => ({ ...aim, at: at(x, z) });

describe("closestFoe", () => {
  test("the living enemy nearest the player, or none", () => {
    assert.equal(closestFoe(foes, player), near.e);
    assert.equal(closestFoe([left, far], player), left.e);
    assert.equal(closestFoe([], player), null);
  });
});

describe("pointedFoe", () => {
  test("the enemy nearest where the camera points (the screen's middle), not the one nearest the player", () => {
    assert.equal(pointedFoe(foes, aim), current.e);
    const turned = { eye: aim.eye, at: { x: -3, y: 0.5, z: 0 } };
    assert.equal(pointedFoe(foes, turned), left.e);
    const atRight = { eye: aim.eye, at: right.pos };
    assert.equal(pointedFoe([near, right], atRight), right.e, "near is closer, but further off the middle");
  });

  test("one behind the camera still counts when nobody is in front; with nobody alive, none", () => {
    const behind = { eye: aim.eye, at: { x: 0, y: 3, z: -20 } };
    assert.equal(pointedFoe([right], behind), right.e);
    assert.equal(pointedFoe([], aim), null);
  });
});

describe("inViewFoe", () => {
  test("of the enemies in the camera's view, the one nearest its middle", () => {
    assert.equal(inViewFoe(foes, aim), current.e);
    assert.equal(inViewFoe([left, right], looking(-3, 0)), left.e);
  });

  test("none in view (behind, or past the edge of the picture): none", () => {
    assert.equal(inViewFoe(foes, { ...aim, at: at(0, -20) }), null, "behind");
    const narrow = { ...aim, fovRad: 10 * Math.PI / 180 };
    assert.equal(inViewFoe([left, right], narrow), null, "past the edge");
    assert.equal(inViewFoe([], aim), null);
  });
});

describe("steerLock: always locked on", () => {
  test("Q switches hands, not targets: the target stays", () => {
    assert.equal(steerLock(current.e, steer(["switchHand"]), [current, left, far], aim, player), current.e);
  });

  test("lock closest locks the enemy nearest the player", () => {
    assert.equal(steerLock(left.e, steer(["lockClosest"]), foes, aim, player), near.e);
  });

  test("the arrows don't let go", () => {
    for (const arrow of ["turnLeft", "turnRight", "lookUp", "lookDown"] as const) {
      assert.equal(steerLock(current.e, steer([arrow]), foes, aim, player), current.e, arrow);
    }
  });

  test("with no target (the fight starting, it dead), the enemy in view nearest the middle, else the closest", () => {
    assert.equal(steerLock(null, steer([]), foes, aim, player), current.e);
    assert.equal(steerLock(left.e, steer([]), [current, right], looking(3, 0), player), right.e);
    assert.equal(steerLock(left.e, steer([]), [far, near], { ...aim, at: at(0, -20) }, player), near.e);
    assert.equal(steerLock(null, steer([]), [], aim, player), null);
  });

  test("the camera free (a pan or a drawn bow), the target is kept wherever it looks", () => {
    assert.equal(steerLock(current.e, steer([], true, false), foes, looking(-3, 0), player), current.e);
    assert.equal(steerLock(current.e, steer([], true), foes, looking(-3, 0), player), current.e);
  });

  test("as it's let go, it locks the enemy in view nearest the middle; with none in view, the old target", () => {
    assert.equal(steerLock(current.e, steer([], false, true), foes, looking(-3, 0), player), left.e);
    const away = { ...aim, at: at(0, -20) };
    assert.equal(steerLock(current.e, steer([], false, true), foes, away, player), current.e);
    assert.equal(steerLock(left.e, steer([], false, true), [far, near], away, player), near.e, "the old one died");
  });
});

describe("moving while locked", () => {
  const target = at(5, 0);
  const from = at(0, 0);

  test("forward goes at the target, right and left circle it", () => {
    const input = copyInput(IDLE_INPUT);
    const aim = { x: 1, z: 0, at: { x: 5, y: 0.9, z: 0 } };
    readPlayerInput(polled([], { x: 0, z: 1 }), lockYaw(from, target)!, "tb", input, aim);
    assert.ok(Math.abs(input.moveX - 1) < 1e-9 && Math.abs(input.moveZ) < 1e-9);
    readPlayerInput(polled([], { x: 1, z: 0 }), lockYaw(from, target)!, "tb", input, aim);
    assert.ok(Math.abs(input.moveX) < 1e-9 && Math.abs(input.moveZ + 1) < 1e-9);
  });

  test("standing on the target there's no way to face: null", () => {
    assert.equal(lockYaw(from, at(0, 0, 3)), null);
  });
});
