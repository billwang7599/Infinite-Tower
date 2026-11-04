import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { floorReach, orbitBack, orbitUp, TURN, turnBy } from "../../src/modes/orbit.js";

const dot = (a: { x: number; y: number; z: number }, b: typeof a) => a.x * b.x + a.y * b.y + a.z * b.z;
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
  test("level, the eye is behind the pivot and the view upright; straight down it's above, up the way it faces", () => {
    const back = orbitBack(0, 0), up = orbitUp(0, 0);
    near(back.z, -1, "behind");
    near(up.y, 1, "upright");
    const top = orbitBack(0, Math.PI / 2), topUp = orbitUp(0, Math.PI / 2);
    near(top.y, 1, "above");
    near(topUp.z, 1, "screen top ahead");
  });

  test("all the way round, the up stays square to the look and never jumps (no flip over the poles)", () => {
    for (const yaw of [0, 1, -2.5]) {
      let last = orbitUp(yaw, 0);
      for (let i = 1; i <= 720; i++) {
        const pitch = (i / 720) * 2 * Math.PI, up = orbitUp(yaw, pitch);
        near(dot(up, orbitBack(yaw, pitch)), 0, "square");
        near(Math.hypot(up.x, up.y, up.z), 1, "unit");
        assert.ok(dot(up, last) > 0.999, `up jumped at ${pitch}`);
        last = up;
      }
    }
  });
});

describe("floorReach: how far out the eye may go and stay above the floor", () => {
  test("looking down from above, all the way; from below, pulled in to the floor's margin", () => {
    assert.equal(floorReach(1.5, 0.3, 0, 5, 0.2), 5);
    near(floorReach(1.5, -0.5, 0, 5, 0.2), (1.5 - 0.2) / 0.5, "pulled in");
    assert.equal(floorReach(0.1, -1, 0, 5, 0.2), 0);
  });
});
