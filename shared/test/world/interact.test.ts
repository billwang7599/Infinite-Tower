import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { INTERACT_LOOK_RAD, INTERACT_RANGE_M, inView, type Vec2 } from "@infinite-tower/shared";

const me: Vec2 = { x: 1, z: -4 };
const NORTH: Vec2 = { x: 0, z: 1 };
const pile = (id: number, awayM: number, offRad = 0) =>
  ({ id, x: me.x + Math.sin(offRad) * awayM, z: me.z + Math.cos(offRad) * awayM });

describe("inView: the same on the overworld and in an arena", () => {
  test("a pile in reach and in front of where you face", () => {
    const ahead = pile(1, INTERACT_RANGE_M - 0.05);
    assert.equal(inView(me, NORTH, [ahead]), ahead);
  });

  test("not out of reach, however straight ahead", () => {
    assert.equal(inView(me, NORTH, [pile(1, INTERACT_RANGE_M + 0.05)]), null);
  });

  test("not further round than INTERACT_LOOK_RAD either side, nor behind", () => {
    const edge = INTERACT_LOOK_RAD;
    assert.notEqual(inView(me, NORTH, [pile(1, 1, edge - 0.02)]), null);
    assert.notEqual(inView(me, NORTH, [pile(1, 1, -edge + 0.02)]), null);
    assert.equal(inView(me, NORTH, [pile(1, 1, edge + 0.02)]), null);
    assert.equal(inView(me, NORTH, [pile(1, 1, -edge - 0.02)]), null);
    assert.equal(inView(me, NORTH, [pile(1, 1, Math.PI)]), null);
  });

  test("of several, the one nearest the view's centre line, not the nearest", () => {
    const near = pile(1, 0.5, INTERACT_LOOK_RAD * 0.8), centred = pile(2, 1.5, -INTERACT_LOOK_RAD * 0.1);
    assert.equal(inView(me, NORTH, [near, centred]), centred);
    assert.equal(inView(me, NORTH, [centred, near]), centred);
  });

  test("faces any way: the aim is a direction on the ground", () => {
    const west = pile(1, 1, -Math.PI / 2);
    assert.equal(inView(me, { x: -1, z: 0 }, [west]), west);
    assert.equal(inView(me, NORTH, [west]), null);
  });

  test("a wider reach and look, as the server allows for lag", () => {
    const off = pile(1, INTERACT_RANGE_M + 0.5, INTERACT_LOOK_RAD + 0.1);
    assert.equal(inView(me, NORTH, [off]), null);
    assert.equal(inView(me, NORTH, [off], INTERACT_RANGE_M + 1, INTERACT_LOOK_RAD + 0.2), off);
  });
});
