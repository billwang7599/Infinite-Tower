import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PlayerAction, Vec2, Vec3 } from "@infinite-tower/shared";
import type { Polled } from "../../../src/core/actions.js";
import {
  CROSSHAIR_MIN_M, crosshairAim, freeCamera, playerAim, type Aimed,
} from "../../../src/modes/battle/aim.js";

const polled = (over: Partial<Polled>): Polled =>
  ({
    held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragging: false, zoom: 0, ...over,
  });

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const way = (x: number, z: number): Vec2 => ({ x: x / Math.hypot(x, z), z: z / Math.hypot(x, z) });
const nearWay = (got: Vec2 | null, want: Vec2) =>
  assert.ok(got && near(got.x, want.x) && near(got.z, want.z), `${JSON.stringify(got)} vs ${JSON.stringify(want)}`);

const me: Vec3 = { x: 0, y: 0.9, z: 0 };
const foeAt = (x: number, z: number, heightM = 1.8, e = 1): Aimed => ({
  e,
  body: { pos: { x, y: heightM / 2, z }, vel: { x: 0, y: 0, z: 0 }, centerHeight: heightM / 2, collider: 0 },
  fighter: { team: "enemy", side: -1, radius: 0.4, heightM },
});
// Over the left shoulder, looking parallel to the player's way: the centre's line passes 1 m left of the player.
const eye = { x: -1, y: 3, z: -4 }, at = { x: -1, y: 2, z: 0 };

describe("aiming where the crosshair is (the screen's centre)", () => {
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

  test("its pitch goes from the player up or down to the spot the crosshair shows", () => {
    const floor = crosshairAim(eye, at, me, [], 20)!.pitchRad;
    const foe = crosshairAim(eye, at, me, [foeAt(-1, 6)], 20)!.pitchRad;
    assert.ok(near(floor, Math.atan2(-me.y, Math.hypot(1, 8))), `the floor: ${floor}`);
    assert.ok(near(foe, Math.atan2(0.6 - me.y, Math.hypot(1, 5.6))), `the foe: ${foe}`);
    const up = { x: -1, y: 3.5, z: 0 }, wall = crosshairAim(eye, up, me, [], 10)!;
    assert.ok(wall.pitchRad > 0, `looking up at the wall: ${wall.pitchRad}`);
  });

  test("none when what it shows is beside or behind the player", () => {
    const down = { x: 0, y: 6, z: -CROSSHAIR_MIN_M }, feet = { x: 0, y: 0, z: CROSSHAIR_MIN_M / 2 };
    assert.equal(crosshairAim(down, feet, me, [], 20), null);
  });
});

describe("freeCamera", () => {
  const free = (over: Partial<Polled>, action: PlayerAction = "none") => freeCamera(polled(over), action);

  test("a bow drawn or just loosed, a skill chanted, cast or streamed: the camera aims", () => {
    for (const action of ["draw", "loose", "chant", "cast", "beam"] as const) assert.equal(free({}, action), "aim");
    assert.equal(free({ dragging: true }, "cast"), "aim");
  });

  test("a right drag or a held arrow pans it; otherwise it's the lock's", () => {
    assert.equal(free({ dragging: true }), "pan");
    assert.equal(free({ turn: -1 }), "pan");
    assert.equal(free({ look: 1 }), "pan");
    assert.equal(free({}), null);
    assert.equal(free({}, "attack"), null);
  });
});

describe("the player's aim", () => {
  const view = { yaw: 0.3, pitch: 0.2, fovRad: 1, eye, at };
  const target = foeAt(3, 0, 1.8, 7);

  test("locked on (the camera the lock's, or panned): at the target, level, the fight told; walking toward it", () => {
    for (const freed of [null, "pan"] as const) {
      const got = playerAim({ lock: 7, freeCamera: freed, view }, [target], me, 20);
      assert.ok(near(got.walkYaw, Math.PI / 2), `${got.walkYaw}`);
      nearWay(got.aim, way(1, 0));
      assert.deepEqual([got.aim.pitchRad, got.locked], [0, 7]);
    }
  });

  test("aiming, the crosshair's way and pitch with the lock kept from the fight; walking by the camera", () => {
    const got = playerAim({ lock: 7, freeCamera: "aim", view }, [target], me, 20);
    assert.equal(got.walkYaw, view.yaw);
    assert.deepEqual(got.aim, crosshairAim(eye, at, me, [target], 20));
    assert.equal(got.locked, null);
  });

  test("with no target, the crosshair; where it shows nothing ahead, the camera's way, level", () => {
    const unlocked = playerAim({ lock: null, freeCamera: null, view }, [], me, 20);
    assert.deepEqual(unlocked.aim, crosshairAim(eye, at, me, [], 20));
    const down = { ...view, eye: { x: 0, y: 6, z: -CROSSHAIR_MIN_M }, at: { x: 0, y: 0, z: CROSSHAIR_MIN_M / 2 } };
    const got = playerAim({ lock: null, freeCamera: "aim", view: down }, [], me, 20);
    assert.deepEqual(got.aim, { x: Math.sin(view.yaw), z: Math.cos(view.yaw), pitchRad: 0 });
  });
});
