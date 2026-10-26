import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { faceToward, facingFromSide } from "../../src/overworld/facing.js";

describe("faceToward: which way an overworld walker faces", () => {
  test("walking straight turns to that way: +z is up the screen", () => {
    assert.equal(faceToward("down", 1, 0), "right");
    assert.equal(faceToward("down", -1, 0), "left");
    assert.equal(faceToward("down", 0, 1), "up");
    assert.equal(faceToward("up", 0, -1), "down");
  });

  test("standing still, or barely moving, keeps the way it faced", () => {
    assert.equal(faceToward("up", 0, 0), "up");
    assert.equal(faceToward("left", 0.05, -0.05), "left");
  });

  test("on a diagonal it keeps facing a way it's still walking, so it doesn't flicker", () => {
    assert.equal(faceToward("up", -1, 1), "up");
    assert.equal(faceToward("left", -1, 1), "left");
    assert.equal(faceToward("down", 0.7, -0.7), "down");
  });

  test("turning onto a diagonal from elsewhere faces the stronger way, sideways on a tie", () => {
    assert.equal(faceToward("down", -1, 1), "left");
    assert.equal(faceToward("right", -0.4, 1), "up");
    assert.equal(faceToward("up", 1, -0.4), "right");
  });

  test("a sideways nudge under the dead zone doesn't count as walking that way", () => {
    assert.equal(faceToward("left", 0.05, 1), "up");
  });
});

describe("facingFromSide: the server's side (1 right, -1 left) for actors seen only from the side", () => {
  test("maps both ways", () => {
    assert.equal(facingFromSide(1), "right");
    assert.equal(facingFromSide(-1), "left");
  });
});
