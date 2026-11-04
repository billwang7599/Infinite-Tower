import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT, type Vec3 } from "@infinite-tower/shared";
import type { Polled } from "../../../src/core/actions.js";
import { closestFoe, lockYaw, pointedFoe, steerLock, type Foe } from "../../../src/modes/battle/lock.js";
import { readPlayerInput } from "../../../src/modes/battle/input.js";

const at = (x: number, z: number, y = 0.5): Vec3 => ({ x, y, z });
const player = at(0, -4);
const aim = { eye: at(0, -10, 3), at: at(0, 0) };

const current: Foe = { e: 1, pos: at(0, 0) };
const left: Foe = { e: 2, pos: at(-3, 0) };
const right: Foe = { e: 3, pos: at(3, 0) };
const far: Foe = { e: 4, pos: at(0, 6) };
const near: Foe = { e: 5, pos: at(0, -2) };
const foes = [current, left, right, far, near];

const polled = (pressed: Polled["pressed"], move = { x: 0, z: 0 }): Polled =>
  ({ held: new Set(), pressed, flicks: [], move, turn: 0, look: 0, dragged: false, zoom: 0 });
const steer = (pressed: Polled["pressed"], dragged = false) => ({ pressed, dragged });

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

describe("steerLock", () => {
  test("unlocked, the lock key locks the enemy the camera points at; locked, it lets go", () => {
    assert.equal(steerLock(null, steer(["lockOn"]), foes, aim, player), current.e);
    assert.equal(steerLock(left.e, steer(["lockOn"]), foes, aim, player), null);
    assert.equal(steerLock(null, steer([]), foes, aim, player), null);
  });

  test("lock closest locks the enemy nearest the player, locked or not", () => {
    assert.equal(steerLock(null, steer(["lockClosest"]), foes, aim, player), near.e);
    assert.equal(steerLock(left.e, steer(["lockClosest"]), foes, aim, player), near.e);
  });

  test("the target dying ends the lock, without jumping to another", () => {
    assert.equal(steerLock(left.e, steer([]), [current, right], aim, player), null);
  });

  test("an arrow pressed while locked lets go (it turns the camera instead); unlocked they lock nothing", () => {
    for (const arrow of ["turnLeft", "turnRight", "lookUp", "lookDown"] as const) {
      assert.equal(steerLock(current.e, steer([arrow]), foes, aim, player), null, arrow);
      assert.equal(steerLock(null, steer([arrow]), foes, aim, player), null, arrow);
    }
  });

  test("dragging the camera lets go of the lock; the lock key in the same step locks again", () => {
    assert.equal(steerLock(current.e, steer([], true), foes, aim, player), null);
    assert.equal(steerLock(current.e, steer(["lockOn"], true), foes, aim, player), current.e);
  });
});

describe("moving while locked", () => {
  const target = at(5, 0);
  const from = at(0, 0);

  test("the player faces the target", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled([]), lockYaw(from, target)!, "tb", input);
    assert.ok(Math.abs(input.aimX - 1) < 1e-9 && Math.abs(input.aimZ) < 1e-9);
  });

  test("forward goes at the target, right and left circle it", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled([], { x: 0, z: 1 }), lockYaw(from, target)!, "tb", input);
    assert.ok(Math.abs(input.moveX - 1) < 1e-9 && Math.abs(input.moveZ) < 1e-9);
    readPlayerInput(polled([], { x: 1, z: 0 }), lockYaw(from, target)!, "tb", input);
    assert.ok(Math.abs(input.moveX) < 1e-9 && Math.abs(input.moveZ + 1) < 1e-9);
  });

  test("standing on the target there's no way to face: null", () => {
    assert.equal(lockYaw(from, at(0, 0, 3)), null);
  });
});
