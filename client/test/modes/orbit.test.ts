import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { floorReach, orbitBack, TURN, turnBy, ZOOM_PER_NOTCH, zoomBy } from "../../src/modes/orbit.js";

const near = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: ${actual} isn't ${expected}`);

describe("turnBy: how far held keys and a drag turn the camera", () => {
  test("keys turn at a steady rate, a drag by its pixels, both scaled by the sensitivity", () => {
    const keys = turnBy({ turn: 1, look: -1 }, { dx: 0, dy: 0 }, 0.5, 1);
    near(keys.yaw, TURN.yawRadPerSec * 0.5, "yaw");
    near(keys.pitch, -TURN.pitchRadPerSec * 0.5, "pitch");
    const drag = turnBy({ turn: 0, look: 0 }, { dx: 10, dy: -4 }, 0.5, 2);
    near(drag.yaw, 10 * TURN.mouseRadPerPx * 2, "drag yaw");
    near(drag.pitch, -4 * TURN.mouseRadPerPx * 2, "drag pitch");
  });
});

describe("the orbit's frame", () => {
  test("level, the eye is behind the pivot; tilted up, it's above", () => {
    near(orbitBack(0, 0).z, -1, "behind");
    near(orbitBack(0, Math.PI / 2).y, 1, "above");
  });
});

describe("zoomBy: the scroll wheel's zoom", () => {
  test("a notch out moves the camera ZOOM_PER_NOTCH times as far, a notch in as much nearer", () => {
    near(zoomBy(5, 1, 2, 10), 5 * ZOOM_PER_NOTCH, "out");
    near(zoomBy(5, -1, 2, 10), 5 / ZOOM_PER_NOTCH, "in");
    near(zoomBy(5, 2, 2, 10), 5 * ZOOM_PER_NOTCH ** 2, "two notches");
  });

  test("a trackpad's share of a notch zooms its share, so a scroll split into small ones adds up the same", () => {
    let distanceM = 5;
    for (let i = 0; i < 10; i++) distanceM = zoomBy(distanceM, 0.1, 2, 10);
    near(distanceM, zoomBy(5, 1, 2, 10), "ten tenths");
  });

  test("capped at both ends", () => {
    assert.equal(zoomBy(9.5, 3, 2, 10), 10);
    assert.equal(zoomBy(2.1, -3, 2, 10), 2);
  });
});

describe("floorReach: how far out the eye may go and stay above the floor", () => {
  test("looking down from above, all the way; from below, pulled in to the floor's margin", () => {
    assert.equal(floorReach(1.5, 0.3, 0, 5, 0.2), 5);
    near(floorReach(1.5, -0.5, 0, 5, 0.2), (1.5 - 0.2) / 0.5, "pulled in");
    assert.equal(floorReach(0.1, -1, 0, 5, 0.2), 0);
  });
});
