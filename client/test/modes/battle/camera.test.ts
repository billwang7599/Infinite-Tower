import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Body, World, type Entity, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../../../src/modes/components.js";
import type { BattleContext } from "../../../src/modes/battle/context.js";
import {
  arenaCamera, blocksView, CAMERA, CAMERA_PRESETS, cameraTuning, insideSelf, LOCKED_VIEWS, nextLockedView,
  type ArenaView, type CameraTuning, type CameraTunings,
} from "../../../src/modes/battle/camera.js";

const DEG = Math.PI / 180;
const FRAME_TIME = 1 / 60;

function arena(me: Vec3, foe: Vec3 | null, radiusM = 20) {
  const world = new World();
  const add = (pos: Vec3): Entity => {
    const e = world.spawn();
    world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
    return e;
  };
  world.add(add(me), LocalPlayer, true);
  const lock = foe ? add(foe) : null;
  const view: ArenaView = {
    yaw: 0, pitch: CAMERA.lockPitchRad, fovRad: CAMERA.fovRad, eye: { x: 0, y: 0, z: 0 }, at: { x: 0, y: 0, z: 0 },
  };
  const ctx = {
    view, lock, lockedView: "shoulder",
    actions: { lookDelta: () => ({ dx: 0, dy: 0 }) },
    polled: { held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0 },
    settings: { camera: { get: () => ({ sensitivity: 1 }) } },
  } as unknown as BattleContext;
  const fight = { world, arena: { radius: radiusM } } as unknown as Fight;
  return { ctx, fight, view };
}

const both = (tuning: CameraTuning): CameraTunings =>
  ({ free: tuning, views: { shoulder: tuning, close: LOCKED_VIEWS.close, fp: LOCKED_VIEWS.fp } });
const LOCKED_CAMERA = LOCKED_VIEWS.shoulder;

function settle(tunings: CameraTunings, me: Vec3, foe: Vec3 | null, radiusM?: number): ArenaView {
  const { ctx, fight, view } = arena(me, foe, radiusM);
  const camera = arenaCamera(ctx, tunings);
  for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
  return view;
}

const distanceOf = (view: ArenaView, me: Vec3) => Math.hypot(view.eye.x - me.x, view.eye.z - me.z);

const near = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${what}: ${actual} isn't ${expected}`);

describe("the camera's dev flags", () => {
  test("no flag: the wide orbit unlocked, over the shoulder locked", () => {
    assert.deepEqual(cameraTuning(""), { free: CAMERA, views: LOCKED_VIEWS });
    assert.deepEqual(cameraTuning("?pixel=3&outline"), { free: CAMERA, views: LOCKED_VIEWS });
    assert.deepEqual(LOCKED_CAMERA, { ...CAMERA, ...CAMERA_PRESETS.shoulder });
  });

  test("each flag sets one number; pitch and fov are in degrees", () => {
    assert.equal(cameraTuning("?cam.dist=5").free.distanceM, 5);
    assert.equal(cameraTuning("?cam.height=2").views.shoulder.orbitHeightM, 2);
    assert.equal(cameraTuning("?cam.side=0.8").views.shoulder.sideM, 0.8);
    assert.equal(cameraTuning("?cam.look=0.5").views.shoulder.lockLookShare, 0.5);
    near(cameraTuning("?cam.pitch=30").views.shoulder.lockPitchRad, 30 * DEG, "pitch");
    near(cameraTuning("?cam.fov=60").free.fovRad, 60 * DEG, "fov");
    assert.equal(cameraTuning("?cam.fade").free.fade, true);
    assert.equal(cameraTuning("?cam.dist=5").free.sideM, CAMERA.sideM);
    assert.equal(cameraTuning("?cam.dist=5").views.shoulder.distanceM, 5);
  });

  test("a preset is the camera locked and not, and a flag after it wins", () => {
    for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
      assert.deepEqual(cameraTuning(`?cam=${name}`), both({ ...CAMERA, ...preset }), name);
    }
    const shoulder = cameraTuning("?cam=shoulder&cam.dist=6").views.shoulder;
    assert.equal(shoulder.distanceM, 6);
    assert.equal(shoulder.sideM, CAMERA_PRESETS.shoulder.sideM);
  });

  test("an unknown preset or a number that isn't one leaves the default", () => {
    for (const search of ["?cam=nope", "?cam=constructor", "?cam.dist=far&cam.side="]) {
      assert.deepEqual(cameraTuning(search), cameraTuning(""), search);
    }
  });
});

describe("arenaCamera", () => {
  test("unlocked, by default it sits MAX distance behind and above the player, looking at the player", () => {
    const view = settle(cameraTuning(""), { x: 0, y: 0, z: 0 }, null);
    const pitch = CAMERA.lockPitchRad;
    near(view.eye.x, 0, "eye x");
    near(view.eye.z, -Math.cos(pitch) * CAMERA.distanceM, "eye z");
    near(view.eye.y, CAMERA.orbitHeightM + Math.sin(pitch) * CAMERA.distanceM, "eye y");
    assert.deepEqual(view.at, { x: 0, y: CAMERA.lookHeightM, z: 0 });
  });

  test("a side offset moves the eye and the look point right of the player, the yaw (the aim) untouched", () => {
    const sideM = 0.9, view = settle(both({ ...CAMERA, sideM }), { x: 0, y: 0, z: 0 }, null);
    assert.equal(view.yaw, 0);
    near(view.eye.x, sideM, "eye x");
    near(view.at.x, sideM, "at x");
    near(view.eye.z, -Math.cos(view.pitch) * CAMERA.distanceM, "eye z");
  });

  test("with a side offset the wall still pulls the camera inside the arena", () => {
    const radiusM = 10, view = settle(both({ ...CAMERA, sideM: 1.5 }), { x: 0, y: 0, z: -7 }, null, radiusM);
    assert.ok(Math.hypot(view.eye.x, view.eye.z) <= radiusM - 0.39, `eye at ${JSON.stringify(view.eye)}`);
  });

  test("locked, by default it comes in over the shoulder", () => {
    const me = { x: 0, y: 0, z: 0 }, view = settle(cameraTuning(""), me, { x: 0, y: 0, z: 10 });
    const { distanceM, sideM, lockPitchRad, lockLookMaxM, orbitHeightM, lookHeightM } = LOCKED_CAMERA;
    near(view.pitch, lockPitchRad, "pitch");
    near(view.eye.x, sideM, "eye x");
    near(view.eye.z, -Math.cos(lockPitchRad) * distanceM, "eye z");
    near(view.eye.y, orbitHeightM + Math.sin(lockPitchRad) * distanceM, "eye y");
    near(view.at.z, lockLookMaxM, "at z");
    near(view.at.y, lookHeightM, "at y");
  });

  test("locking and unlocking ease between the two framings, with no jump", () => {
    const me = { x: 0, y: 0, z: 0 }, { ctx, fight, view } = arena(me, { x: 0, y: 0, z: 10 });
    const camera = arenaCamera(ctx, cameraTuning("")), lock = ctx.lock;
    const run = (frames: number) => {
      let biggestStepM = 0;
      for (let i = 0; i < frames; i++) {
        const before = { ...view.eye };
        camera(fight, FRAME_TIME);
        biggestStepM = Math.max(biggestStepM, Math.hypot(view.eye.x - before.x, view.eye.z - before.z));
      }
      return biggestStepM;
    };
    run(240);
    const { sideM, distanceM } = LOCKED_CAMERA;
    near(distanceOf(view, me), Math.hypot(sideM, Math.cos(view.pitch) * distanceM), "locked");
    ctx.lock = null;
    assert.ok(run(240) < 0.5, "unlocking jumped");
    near(view.eye.x, 0, "unlocked, no side");
    near(distanceOf(view, me), Math.cos(view.pitch) * CAMERA.distanceM, "unlocked");
    ctx.lock = lock;
    assert.ok(run(240) < 0.5, "locking jumped");
    near(view.eye.x, LOCKED_CAMERA.sideM, "locked again");
  });

  test("framing both looks halfway between the player and the target", () => {
    const view = settle(cameraTuning("?cam=both"), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 });
    near(view.at.x, 0, "at x");
    near(view.at.z, 5, "at z");
  });
});

describe("first person", () => {
  const fps = cameraTuning("?cam=fp"), fp = fps.free, me = { x: 0, y: 0.7, z: 0 };

  test("the eye is at the player's own eye height, inside the body (so it's hidden)", () => {
    const view = settle(fps, me, null);
    assert.deepEqual(view.eye, { x: 0, y: me.y + fp.orbitHeightM, z: 0 });
    near(view.fovRad, fp.fovRad, "fov");
    assert.equal(insideSelf(view.eye, me), true);
    assert.equal(insideSelf(settle(cameraTuning(""), me, null).eye, me), false);
    assert.equal(insideSelf(settle(cameraTuning(""), me, { x: 0, y: 0.7, z: 5 }).eye, me), false);
  });

  test("unlocked it looks where the yaw faces; locked, at the target", () => {
    near(settle(fps, me, null).at.z, fp.lookAheadM, "ahead");
    const view = settle(fps, me, { x: 3, y: 0.7, z: 4 });
    const lookX = view.at.x - view.eye.x, lookZ = view.at.z - view.eye.z;
    near(Math.atan2(lookX, lookZ), Math.atan2(3, 4), "toward the target");
  });
});

describe("the locked views", () => {
  test("V steps shoulder, close, first person and round again, only while locked on", () => {
    assert.equal(nextLockedView("shoulder", ["cycleView"], true, false), "close");
    assert.equal(nextLockedView("close", ["cycleView"], true, false), "fp");
    assert.equal(nextLockedView("fp", ["cycleView"], true, false), "shoulder");
    assert.equal(nextLockedView("close", [], true, false), "close");
    assert.equal(nextLockedView("shoulder", ["cycleView"], false, false), "shoulder");
  });

  test("a roll sends the view back to the shoulder, and it stays there", () => {
    assert.equal(nextLockedView("fp", [], true, true), "shoulder");
    assert.equal(nextLockedView("close", ["cycleView"], true, true), "shoulder");
    assert.equal(nextLockedView("shoulder", [], true, false), "shoulder");
  });

  test("each view eases in; unlocking always goes to the wide orbit, locking again to the chosen view", () => {
    const me = { x: 0, y: 0.7, z: 0 }, { ctx, fight, view } = arena(me, { x: 0, y: 0.7, z: 10 });
    const camera = arenaCamera(ctx, cameraTuning("")), lock = ctx.lock;
    const run = (frames: number) => {
      let biggestStepM = 0;
      for (let i = 0; i < frames; i++) {
        const before = { ...view.eye };
        camera(fight, FRAME_TIME);
        biggestStepM = Math.max(biggestStepM, Math.hypot(view.eye.x - before.x, view.eye.z - before.z));
      }
      return biggestStepM;
    };
    const flatOf = (t: CameraTuning) => Math.hypot(t.sideM, Math.cos(t.lockPitchRad) * t.distanceM);
    run(240);
    ctx.lockedView = "close";
    assert.ok(run(240) < 0.5, "zooming in jumped");
    near(distanceOf(view, me), flatOf(LOCKED_VIEWS.close), "close");
    ctx.lockedView = "fp";
    run(240);
    near(view.fovRad, LOCKED_VIEWS.fp.fovRad, "fp fov");
    assert.equal(insideSelf(view.eye, me), true);
    ctx.lock = null;
    run(240);
    near(view.eye.x, 0, "unlocked, no side");
    near(view.fovRad, CAMERA.fovRad, "unlocked fov");
    ctx.lock = lock;
    run(240);
    assert.equal(insideSelf(view.eye, me), true, "locked again in first person");
  });
});

describe("blocksView", () => {
  const eye = { x: 0, y: 4.5, z: -8 }, foe = { x: 0, y: 0, z: 2 }, heightM = 1.8, foeHeightM = 1.4;
  const feetAt = (t: number): Vec3 => ({ x: 0, y: 0, z: eye.z + (foe.z - eye.z) * t });

  test("a fighter that hides any of the target's height from the eye blocks it", () => {
    assert.equal(blocksView(eye, feetAt(0.8), heightM, foe, foeHeightM), true);
    assert.equal(blocksView(eye, feetAt(0.7), heightM, foe, foeHeightM), true);
  });

  test("off to the side, under the line, behind the eye or past the target, it doesn't", () => {
    assert.equal(blocksView(eye, { ...feetAt(0.8), x: 1 }, heightM, foe, foeHeightM), false);
    assert.equal(blocksView(eye, feetAt(0.3), heightM, foe, foeHeightM), false);
    assert.equal(blocksView(eye, feetAt(-0.2), heightM, foe, foeHeightM), false);
    assert.equal(blocksView(eye, feetAt(1.2), heightM, foe, foeHeightM), false);
  });
});
