import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Body, World, type Entity, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../../../src/modes/components.js";
import type { BattleContext } from "../../../src/modes/battle/context.js";
import {
  arenaCamera, blocksView, CAMERA_PRESETS, CAMERA_VIEWS, cameraTuning, FLOOR_MARGIN_M, insideSelf, steerZoom, ZOOM,
  type ArenaView, type CameraTuning, type CameraView,
} from "../../../src/modes/battle/camera.js";
import { orbitBack, PITCH, TURN, ZOOM_PER_NOTCH } from "../../../src/modes/orbit.js";

const DEG = Math.PI / 180;
const FRAME_TIME = 1 / 60;
const CENTER_HEIGHT_M = 0.9;
const SHOULDER = CAMERA_VIEWS.shoulder;

function arena(me: Vec3, foe: Vec3 | null, radiusM = 20) {
  const world = new World();
  const add = (pos: Vec3): Entity => {
    const e = world.spawn();
    world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: CENTER_HEIGHT_M, collider: 0 });
    return e;
  };
  world.add(add(me), LocalPlayer, true);
  const lock = foe ? add(foe) : null;
  const view: ArenaView = {
    yaw: 0, pitch: SHOULDER.lockPitchRad, fovRad: SHOULDER.fovRad, eye: { x: 0, y: 0, z: 0 }, at: { x: 0, y: 0, z: 0 },
  };
  const drag = { dx: 0, dy: 0 };
  const ctx = {
    view, lock, zoomM: SHOULDER.distanceM,
    actions: { lookDelta: () => ({ ...drag }) },
    polled: {
      held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragged: false, zoom: 0,
    },
    settings: { camera: { get: () => ({ sensitivity: 1 }) } },
  } as unknown as BattleContext;
  const fight = { world, arena: { radius: radiusM } } as unknown as Fight;
  return { ctx, fight, view, drag };
}

const withShoulder = (shoulder: CameraTuning) => ({ ...CAMERA_VIEWS, shoulder });

function settle(views: Record<CameraView, CameraTuning>, me: Vec3, foe: Vec3 | null, radiusM?: number): ArenaView {
  const { ctx, fight, view } = arena(me, foe, radiusM);
  const camera = arenaCamera(ctx, views);
  for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
  return view;
}

const distanceOf = (view: ArenaView, me: Vec3) => Math.hypot(view.eye.x - me.x, view.eye.z - me.z);

const near = (actual: number, expected: number, what: string, within = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < within, `${what}: ${actual} isn't ${expected}`);

describe("the camera's dev flags", () => {
  test("no flag: the three views as they are", () => {
    assert.deepEqual(cameraTuning(""), CAMERA_VIEWS);
    assert.deepEqual(cameraTuning("?pixel=3&outline"), CAMERA_VIEWS);
  });

  test("each flag sets one number of the shoulder view; pitch and fov are in degrees", () => {
    assert.equal(cameraTuning("?cam.dist=5").shoulder.distanceM, 5);
    assert.equal(cameraTuning("?cam.height=2").shoulder.orbitHeightM, 2);
    assert.equal(cameraTuning("?cam.side=0.8").shoulder.sideM, 0.8);
    assert.equal(cameraTuning("?cam.look=0.5").shoulder.lockLookShare, 0.5);
    near(cameraTuning("?cam.pitch=30").shoulder.lockPitchRad, 30 * DEG, "pitch");
    near(cameraTuning("?cam.fov=60").shoulder.fovRad, 60 * DEG, "fov");
    assert.equal(cameraTuning("?cam.fade").shoulder.fade, true);
    assert.equal(cameraTuning("?cam.dist=5").shoulder.sideM, SHOULDER.sideM);
    assert.deepEqual(cameraTuning("?cam.dist=5").close, CAMERA_VIEWS.close);
  });

  test("a preset is the shoulder view, and a flag after it wins", () => {
    for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
      assert.deepEqual(cameraTuning(`?cam=${name}`).shoulder, { ...SHOULDER, ...preset }, name);
    }
    const shoulder = cameraTuning("?cam=close&cam.dist=6").shoulder;
    assert.equal(shoulder.distanceM, 6);
    assert.equal(shoulder.lockPitchRad, CAMERA_PRESETS.close.lockPitchRad);
  });

  test("an unknown preset or a number that isn't one leaves the default", () => {
    for (const search of ["?cam=nope", "?cam=constructor", "?cam.dist=far&cam.side="]) {
      assert.deepEqual(cameraTuning(search), cameraTuning(""), search);
    }
  });
});

describe("the views apply locked or not", () => {
  test("unlocked, the camera keeps the view's distance and side offset; only its direction is free", () => {
    for (const name of ["shoulder", "close"] as const) {
      const { ctx, fight, view } = arena({ x: 0, y: 0, z: 0 }, null);
      ctx.zoomM = CAMERA_VIEWS[name].distanceM;
      const camera = arenaCamera(ctx, CAMERA_VIEWS);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      const { distanceM, sideM, orbitHeightM, lookHeightM } = CAMERA_VIEWS[name], pitch = view.pitch;
      near(view.eye.x, sideM, `${name} eye x`);
      near(view.eye.z, -Math.cos(pitch) * distanceM, `${name} eye z`);
      near(view.eye.y, orbitHeightM + Math.sin(pitch) * distanceM, `${name} eye y`);
      near(view.at.x, sideM, `${name} at x`);
      near(view.at.y, lookHeightM, `${name} at y`);
      near(view.at.z, 0, `${name} at z`);
    }
  });

  test("locked, the shoulder view comes in over the shoulder and looks toward the target", () => {
    const me = { x: 0, y: 0, z: 0 }, view = settle(CAMERA_VIEWS, me, { x: 0, y: 0, z: 10 });
    const { distanceM, sideM, lockPitchRad, lockLookMaxM, orbitHeightM, lookHeightM } = SHOULDER;
    near(view.pitch, lockPitchRad, "pitch");
    near(view.eye.x, sideM, "eye x");
    near(view.eye.z, -Math.cos(lockPitchRad) * distanceM, "eye z");
    near(view.eye.y, orbitHeightM + Math.sin(lockPitchRad) * distanceM, "eye y");
    near(view.at.z, lockLookMaxM, "at z");
    near(view.at.y, lookHeightM, "at y");
  });

  test("locking, unlocking and changing the view ease, with no jump; unlocking keeps the view", () => {
    const me = { x: 0, y: 0.7, z: 0 }, { ctx, fight, view } = arena(me, { x: 0, y: 0.7, z: 10 });
    const camera = arenaCamera(ctx, CAMERA_VIEWS), lock = ctx.lock;
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
    ctx.zoomM = CAMERA_VIEWS.close.distanceM;
    assert.ok(run(240) < 0.5, "zooming in jumped");
    ctx.lock = null;
    assert.ok(run(240) < 0.5, "unlocking jumped");
    const { sideM, distanceM } = CAMERA_VIEWS.close;
    near(distanceOf(view, me), Math.hypot(sideM, Math.cos(view.pitch) * distanceM), "unlocked, still close");
    ctx.zoomM = CAMERA_VIEWS.fp.distanceM;
    run(240);
    near(view.fovRad, CAMERA_VIEWS.fp.fovRad, "fp fov");
    assert.equal(insideSelf(view.eye, me), true, "unlocked in first person");
    ctx.lock = lock;
    assert.ok(run(240) < 0.5, "locking jumped");
    assert.equal(insideSelf(view.eye, me), true, "locked in first person");
  });

  test("with a side offset the wall still pulls the camera inside the arena", () => {
    const radiusM = 10, view = settle(withShoulder({ ...SHOULDER, sideM: 1.5 }), { x: 0, y: 0, z: -7 }, null, radiusM);
    assert.ok(Math.hypot(view.eye.x, view.eye.z) <= radiusM - 0.39, `eye at ${JSON.stringify(view.eye)}`);
  });

  test("framing both looks halfway between the player and the target", () => {
    const view = settle(cameraTuning("?cam=both"), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 });
    near(view.at.x, SHOULDER.sideM, "at x");
    near(view.at.z, 5, "at z");
  });
});

const turnFor = (ctx: BattleContext, look: number) => { (ctx.polled as { look: number }).look = look; };

describe("turning it by hand, up and down capped", () => {
  test("held arrows turn it at a steady rate; a drag by its pixels", () => {
    const { ctx, fight, view, drag } = arena({ x: 0, y: 0, z: 0 }, null);
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    camera(fight, FRAME_TIME);
    const start = { yaw: view.yaw, pitch: view.pitch };
    (ctx.polled as { turn: number }).turn = 1;
    for (let i = 0; i < 30; i++) camera(fight, FRAME_TIME);
    near(view.yaw - start.yaw, TURN.yawRadPerSec * 30 * FRAME_TIME, "yaw", 1e-9);
    (ctx.polled as { turn: number }).turn = 0;
    drag.dy = -20;
    camera(fight, FRAME_TIME);
    near(view.pitch - start.pitch, -20 * TURN.mouseRadPerPx, "pitch", 1e-9);
  });

  test("held down, the eye rises to PITCH.aboveRad over you and stops; held up, it sinks to belowRad under", () => {
    const me = { x: 0, y: 0.9, z: 0 }, { ctx, fight, view } = arena(me, null);
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    const turnFrames = Math.ceil(Math.PI / (TURN.pitchRadPerSec * FRAME_TIME));
    turnFor(ctx, 1);
    for (let i = 0; i < turnFrames; i++) camera(fight, FRAME_TIME);
    near(view.pitch, PITCH.aboveRad, "top");
    turnFor(ctx, -1);
    for (let i = 0; i < turnFrames; i++) {
      camera(fight, FRAME_TIME);
      assert.ok(view.eye.y >= me.y - CENTER_HEIGHT_M + FLOOR_MARGIN_M - 1e-9, `under the floor at ${view.pitch}`);
    }
    near(view.pitch, -PITCH.belowRad, "bottom");
  });

  test("a drag stops at the same caps, however far it goes", () => {
    const { ctx, fight, view, drag } = arena({ x: 0, y: 0.9, z: 0 }, null);
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    drag.dy = 5000;
    camera(fight, FRAME_TIME);
    near(view.pitch, PITCH.aboveRad, "top");
    drag.dy = -5000;
    camera(fight, FRAME_TIME);
    near(view.pitch, -PITCH.belowRad, "bottom");
  });

  test("tilted under, the floor pulls the camera in instead of letting it through", () => {
    const me = { x: 0, y: 0.9, z: 0 }, { ctx, fight, view } = arena(me, null);
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    view.pitch = -PITCH.belowRad;
    camera(fight, FRAME_TIME);
    assert.ok(view.eye.y >= me.y - CENTER_HEIGHT_M + FLOOR_MARGIN_M - 1e-9, "above the floor");
    assert.ok(Math.hypot(view.eye.x - SHOULDER.sideM, view.eye.z) < SHOULDER.distanceM, "pulled in");
  });

  test("in first person you look PITCH.firstPersonRad up or down at most, and the look follows the pitch", () => {
    const me = { x: 0, y: 0.7, z: 0 }, { ctx, fight, view, drag } = arena(me, null);
    ctx.zoomM = CAMERA_VIEWS.fp.distanceM;
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    const lookUp = () => {
      const ahead = orbitBack(view.yaw, view.pitch);
      const look = { x: view.at.x - view.eye.x, y: view.at.y - view.eye.y, z: view.at.z - view.eye.z };
      const length = Math.hypot(look.x, look.y, look.z);
      near(-(look.x * ahead.x + look.y * ahead.y + look.z * ahead.z) / length, 1, "along the pitch", 1e-6);
      return Math.asin(look.y / length);
    };
    drag.dy = -5000;
    camera(fight, FRAME_TIME);
    near(lookUp(), PITCH.firstPersonRad, "up");
    drag.dy = 5000;
    camera(fight, FRAME_TIME);
    near(lookUp(), -PITCH.firstPersonRad, "down");
  });

  test("leaving first person looking far up, the tilt eases back inside the third person's cap", () => {
    const { ctx, fight, view } = arena({ x: 0, y: 0.7, z: 0 }, null);
    ctx.zoomM = CAMERA_VIEWS.fp.distanceM;
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    view.pitch = -PITCH.firstPersonRad;
    ctx.zoomM = SHOULDER.distanceM;
    let biggestStep = 0;
    for (let i = 0; i < 240; i++) {
      const before = view.pitch;
      camera(fight, FRAME_TIME);
      biggestStep = Math.max(biggestStep, Math.abs(view.pitch - before));
    }
    near(view.pitch, -PITCH.belowRad, "inside the cap");
    assert.ok(biggestStep < 0.1, `jumped ${biggestStep}`);
  });
});

describe("zooming: the wheel, V and a roll", () => {
  const { shoulder, close, fp } = CAMERA_VIEWS;
  const wheel = (zoomM: number, zoom: number, pressed: string[] = [], dodging = false) =>
    steerZoom(zoomM, { pressed: pressed as never[], zoom }, dodging, CAMERA_VIEWS);

  test("a notch out zooms out by ZOOM_PER_NOTCH, up to ZOOM.maxM; a share of a notch by its share", () => {
    near(wheel(shoulder.distanceM, 1), shoulder.distanceM * ZOOM_PER_NOTCH, "a notch");
    near(wheel(shoulder.distanceM, 0.5), shoulder.distanceM * ZOOM_PER_NOTCH ** 0.5, "half a notch");
    assert.equal(wheel(ZOOM.maxM - 0.1, 3), ZOOM.maxM);
    assert.equal(wheel(shoulder.distanceM, 0), shoulder.distanceM);
  });

  test("zooming in stops at the close view; one more notch goes into first person, and out of it back to close", () => {
    assert.equal(wheel(close.distanceM + 0.2, -2), close.distanceM);
    assert.equal(wheel(close.distanceM, -0.3), fp.distanceM);
    assert.equal(wheel(fp.distanceM, -1), fp.distanceM);
    assert.equal(wheel(fp.distanceM, 0.3), close.distanceM);
  });

  test("V zooms in to the next of shoulder, close and first person, then round to the shoulder again", () => {
    assert.equal(wheel(ZOOM.maxM, 0, ["cycleView"]), shoulder.distanceM);
    assert.equal(wheel(shoulder.distanceM, 0, ["cycleView"]), close.distanceM);
    assert.equal(wheel((shoulder.distanceM + close.distanceM) / 2, 0, ["cycleView"]), close.distanceM);
    assert.equal(wheel(close.distanceM, 0, ["cycleView"]), fp.distanceM);
    assert.equal(wheel(fp.distanceM, 0, ["cycleView"]), shoulder.distanceM);
  });

  test("a roll goes back to the shoulder's distance only from nearer; zoomed out further, it stays", () => {
    assert.equal(wheel(fp.distanceM, 0, [], true), shoulder.distanceM);
    assert.equal(wheel(close.distanceM, -1, ["cycleView"], true), shoulder.distanceM);
    assert.equal(wheel(7, 0, [], true), 7);
  });

  test("the camera eases to a new distance, locked or not", () => {
    for (const foe of [null, { x: 0, y: 0, z: 10 }]) {
      const me = { x: 0, y: 0, z: 0 }, { ctx, fight, view } = arena(me, foe, 40);
      const camera = arenaCamera(ctx, CAMERA_VIEWS);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      const flat = (distanceM: number) => Math.hypot(SHOULDER.sideM, Math.cos(view.pitch) * distanceM);
      ctx.zoomM = ZOOM.maxM;
      camera(fight, FRAME_TIME);
      const moved = distanceOf(view, me) - flat(SHOULDER.distanceM);
      assert.ok(moved > 0 && moved < (ZOOM.maxM - SHOULDER.distanceM) / 4, `eased, moved ${moved} (${!!foe})`);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      near(distanceOf(view, me), flat(ZOOM.maxM), `there (${!!foe})`, 1e-3);
    }
  });
});

describe("first person", () => {
  const me = { x: 0, y: 0.7, z: 0 }, fp = CAMERA_VIEWS.fp;

  test("the eye is just behind the player's own eyes, inside the body (so it's hidden)", () => {
    const { ctx, fight, view } = arena(me, null);
    ctx.zoomM = fp.distanceM;
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    near(view.eye.y, me.y + fp.orbitHeightM + orbitBack(view.yaw, view.pitch).y * fp.distanceM, "eye height");
    near(view.fovRad, fp.fovRad, "fov");
    assert.equal(insideSelf(view.eye, me), true);
    assert.equal(insideSelf(settle(CAMERA_VIEWS, me, null).eye, me), false);
    assert.equal(insideSelf(settle(CAMERA_VIEWS, me, { x: 0, y: 0.7, z: 5 }).eye, me), false);
  });

  test("locked, it looks at the target", () => {
    const { ctx, fight, view } = arena(me, { x: 3, y: 0.7, z: 4 });
    ctx.zoomM = fp.distanceM;
    const camera = arenaCamera(ctx, CAMERA_VIEWS);
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    near(Math.atan2(view.at.x - view.eye.x, view.at.z - view.eye.z), Math.atan2(3, 4), "toward the target");
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
