import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT, type Vec3 } from "@infinite-tower/shared";
import type { Polled } from "../../../src/core/actions.js";
import { closestFoe, lockYaw, retarget, steerLock, type Foe } from "../../../src/modes/battle/lock.js";
import { readPlayerInput } from "../../../src/modes/battle/input.js";

const at = (x: number, z: number, y = 0.5): Vec3 => ({ x, y, z });
const player = at(0, -4);
const eye = { pos: at(0, -10, 3), yaw: 0 };

const current: Foe = { e: 1, pos: at(0, 0) };
const left: Foe = { e: 2, pos: at(-3, 0) };
const right: Foe = { e: 3, pos: at(3, 0) };
const far: Foe = { e: 4, pos: at(0, 6) };
const near: Foe = { e: 5, pos: at(0, -2) };
const foes = [current, left, right, far, near];

const polled = (pressed: Polled["pressed"], move = { x: 0, z: 0 }): Polled =>
  ({ held: new Set(), pressed, move, turn: 0, look: 0 });

describe("closestFoe", () => {
  test("the living enemy nearest the player, or none", () => {
    assert.equal(closestFoe(foes, player), near.e);
    assert.equal(closestFoe([left, far], player), left.e);
    assert.equal(closestFoe([], player), null);
  });
});

describe("retarget", () => {
  test("each arrow picks the enemy next to the locked one that way on screen; farther away is higher up", () => {
    assert.equal(retarget(current.e, foes, eye, "left", player), left.e);
    assert.equal(retarget(current.e, foes, eye, "right", player), right.e);
    assert.equal(retarget(current.e, foes, eye, "up", player), far.e);
    assert.equal(retarget(current.e, foes, eye, "down", player), near.e);
  });

  test("with nobody that way, the lock stays", () => {
    assert.equal(retarget(left.e, foes, eye, "left", player), left.e);
    assert.equal(retarget(current.e, [current, right], eye, "left", player), current.e);
  });

  test("an enemy behind the camera is still left or right of the target", () => {
    const behindLeft: Foe = { e: 6, pos: at(-2, -14) };
    assert.equal(retarget(current.e, [current, behindLeft], eye, "left", player), behindLeft.e);
  });

  test("a tie on screen goes to the enemy closest to the player", () => {
    const along = (t: number, nudge: number): Vec3 => ({
      x: eye.pos.x + (left.pos.x - eye.pos.x) * t + nudge, y: eye.pos.y + (left.pos.y - eye.pos.y) * t,
      z: eye.pos.z + (left.pos.z - eye.pos.z) * t,
    });
    const hidden: Foe = { e: 7, pos: along(2, 0.01) };
    assert.equal(retarget(current.e, [current, hidden, left], eye, "left", player), left.e);
  });
});

describe("steerLock", () => {
  test("the lock key locks the closest enemy, and lets go when locked", () => {
    assert.equal(steerLock(null, ["lockOn"], foes, eye, player), near.e);
    assert.equal(steerLock(left.e, ["lockOn"], foes, eye, player), null);
    assert.equal(steerLock(null, [], foes, eye, player), null);
  });

  test("lock closest locks the closest enemy, locked or not", () => {
    assert.equal(steerLock(null, ["lockClosest"], foes, eye, player), near.e);
    assert.equal(steerLock(left.e, ["lockClosest"], foes, eye, player), near.e);
  });

  test("the target dying ends the lock, without jumping to another", () => {
    assert.equal(steerLock(left.e, [], [current, right], eye, player), null);
  });

  test("locked, the arrows retarget; unlocked they don't lock anything", () => {
    assert.equal(steerLock(current.e, ["turnLeft"], foes, eye, player), left.e);
    assert.equal(steerLock(current.e, ["lookUp"], foes, eye, player), far.e);
    assert.equal(steerLock(current.e, ["lookUp", "lookDown"], foes, eye, player), current.e);
    assert.equal(steerLock(null, ["turnLeft"], foes, eye, player), null);
  });
});

describe("moving while locked", () => {
  const target = at(5, 0);
  const from = at(0, 0);

  test("the player faces the target", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled([]), lockYaw(from, target)!, { guard: null, way: null }, input);
    assert.ok(Math.abs(input.aimX - 1) < 1e-9 && Math.abs(input.aimZ) < 1e-9);
  });

  test("forward goes at the target, right and left circle it", () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(polled([], { x: 0, z: 1 }), lockYaw(from, target)!, { guard: null, way: null }, input);
    assert.ok(Math.abs(input.moveX - 1) < 1e-9 && Math.abs(input.moveZ) < 1e-9);
    readPlayerInput(polled([], { x: 1, z: 0 }), lockYaw(from, target)!, { guard: null, way: null }, input);
    assert.ok(Math.abs(input.moveX) < 1e-9 && Math.abs(input.moveZ + 1) < 1e-9);
  });

  test("standing on the target there's no way to face: null", () => {
    assert.equal(lockYaw(from, at(0, 0, 3)), null);
  });
});
