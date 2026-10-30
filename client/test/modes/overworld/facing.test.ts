import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { faceToward, type Heading } from "@infinite-tower/shared";
import { facingOnScreen, headingFromSide, mapMove, mirrorFor } from "../../../src/modes/overworld/facing.js";

describe("headingFromSide: the server's side (1 east, -1 west) for actors seen only from the side", () => {
  test("maps both ways", () => {
    assert.equal(headingFromSide(1), "east");
    assert.equal(headingFromSide(-1), "west");
  });
});

describe("mapMove: the walk keys, relative to the camera, as a move on the map", () => {
  test("facing north (no turns) the keys move along the map's axes", () => {
    assert.deepEqual(mapMove({ x: 0, z: 1 }, 0), { x: 0, z: 1 });
    assert.deepEqual(mapMove({ x: 1, z: 0 }, 0), { x: 1, z: 0 });
  });

  test("forward is always away from the camera: north, east, south, west as it turns right", () => {
    const forward = [0, 1, 2, 3].map((turns) => mapMove({ x: 0, z: 1 }, turns));
    assert.deepEqual(forward, [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }]);
  });

  test("right is a quarter turn clockwise from forward", () => {
    const right = [0, 1, 2, 3].map((turns) => mapMove({ x: 1, z: 0 }, turns));
    assert.deepEqual(right, [{ x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }]);
  });

  test("a diagonal stays the same length, so the server walks it at the same speed", () => {
    for (const turns of [0, 1, 2, 3]) {
      const m = mapMove({ x: -1, z: 1 }, turns);
      assert.equal(Math.hypot(m.x, m.z), Math.SQRT2);
    }
  });

  test("standing still is no move (no -0 on the wire)", () => {
    for (const turns of [0, 1, 2, 3]) assert.deepEqual(mapMove({ x: 0, z: 0 }, turns), { x: 0, z: 0 });
  });
});

describe("facingOnScreen: which picture a heading shows, with the camera turned", () => {
  test("facing north, north is up the screen and east is right", () => {
    const shown = (["north", "east", "south", "west"] as Heading[]).map((h) => facingOnScreen(h, 0));
    assert.deepEqual(shown, ["up", "right", "down", "left"]);
  });

  test("turned right once (looking east), east is up and north is left", () => {
    assert.equal(facingOnScreen("east", 1), "up");
    assert.equal(facingOnScreen("north", 1), "left");
    assert.equal(facingOnScreen("south", 1), "right");
    assert.equal(facingOnScreen("west", 1), "down");
  });

  test("walking forward always shows the back, whichever way the camera looks", () => {
    for (const turns of [0, 1, 2, 3]) {
      const m = mapMove({ x: 0, z: 1 }, turns);
      assert.equal(facingOnScreen(faceToward("south", m.x, m.z), turns), "up", `turns ${turns}`);
    }
  });

  test("turned around, a walker heading east is mirrored as it faces left", () => {
    assert.equal(mirrorFor(facingOnScreen("east", 2)), -1);
    assert.equal(mirrorFor(facingOnScreen("east", 0)), 1);
  });
});
