import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  BASE_STATS, Body, copyInput, emptyBag, emptyEquipment, IDLE_INPUT, maxHpOf, newCore, packFor, Player, PLAYER,
  staminaMaxOf, World, type EnemyDef, type Entity, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../../../src/modes/components.js";
import { CROSSHAIR_MIN_M, playerAim } from "../../../src/modes/battle/aim.js";
import { Blend, type BattleContext } from "../../../src/modes/battle/context.js";
import {
  arenaCamera, blocksView, CAMERA_PRESETS, CAMERA_VIEWS, cameraTuning, FLOOR_MARGIN_M, insideSelf,
  type ArenaView, type CameraTuning,
} from "../../../src/modes/battle/camera.js";
import { orbitBack, PITCH, TURN } from "../../../src/modes/orbit.js";
import { playerDoing } from "../../fixtures/players.js";

const DEG = Math.PI / 180;
const FRAME_TIME = 1 / 60;
const CENTER_HEIGHT_M = 0.9;
const SHOULDER = CAMERA_VIEWS.shoulder;
const FP = CAMERA_VIEWS.fp;

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
    view, lock, freeCamera: null, blend: new Blend(),
    actions: { lookDelta: () => ({ ...drag }) },
    polled: {
      held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragging: false, zoom: 0,
    },
    settings: { camera: { get: () => ({ sensitivity: 1 }) } },
  } as unknown as BattleContext;
  const fight = { world, arena: { radius: radiusM } } as unknown as Fight;
  return { ctx, fight, view, drag };
}

function settle(tuning: CameraTuning, me: Vec3, foe: Vec3 | null, radiusM?: number): ArenaView {
  const { ctx, fight, view } = arena(me, foe, radiusM);
  const camera = arenaCamera(ctx, tuning);
  for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
  return view;
}

function dodger(fight: Fight): (dodging: boolean) => void {
  const player = playerDoing("none", 0);
  fight.world.add(fight.world.first(LocalPlayer)![0], Player, player);
  return (dodging) => {
    player.action = dodging ? "dodge" : "none";
  };
}

const distanceOf = (view: ArenaView, me: Vec3) => Math.hypot(view.eye.x - me.x, view.eye.z - me.z);

const near = (actual: number, expected: number, what: string, within = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < within, `${what}: ${actual} isn't ${expected}`);

describe("the camera's dev flags", () => {
  test("no flag: first person, the only view", () => {
    assert.deepEqual(cameraTuning(""), FP);
    assert.deepEqual(cameraTuning("?pixel=3&outline"), FP);
  });

  test("each flag sets one number of the fight's view; pitch and fov are in degrees", () => {
    const shoulder = (flag: string) => cameraTuning(`?cam=shoulder&${flag}`);
    assert.equal(shoulder("cam.dist=5").distanceM, 5);
    assert.equal(shoulder("cam.height=2").orbitHeightM, 2);
    assert.equal(shoulder("cam.side=0.8").sideM, 0.8);
    assert.equal(shoulder("cam.look=0.5").lockLookShare, 0.5);
    near(shoulder("cam.pitch=30").lockPitchRad, 30 * DEG, "pitch");
    near(shoulder("cam.fov=60").fovRad, 60 * DEG, "fov");
    assert.equal(shoulder("cam.fade").fade, true);
    assert.equal(shoulder("cam.dist=5").sideM, SHOULDER.sideM);
    near(cameraTuning("?cam.fov=90").fovRad, 90 * DEG, "first person's fov");
    assert.equal(cameraTuning("?cam.fov=90").distanceM, FP.distanceM);
  });

  test("a preset is the fight's view in place of first person, over the shoulder's; a flag after it wins", () => {
    for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
      assert.deepEqual(cameraTuning(`?cam=${name}`), { ...SHOULDER, ...preset }, name);
    }
    assert.deepEqual(cameraTuning("?cam=shoulder"), SHOULDER);
    assert.deepEqual(cameraTuning("?cam=fp"), FP);
    const close = cameraTuning("?cam=close&cam.dist=6");
    assert.equal(close.distanceM, 6);
    assert.equal(close.lockPitchRad, SHOULDER.lockPitchRad);
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
      const { ctx, fight, view } = arena({ x: 0, y: 0, z: 0 }, null), tuning = cameraTuning(`?cam=${name}`);
      const camera = arenaCamera(ctx, tuning);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      const { distanceM, sideM, orbitHeightM, lookHeightM } = tuning, pitch = view.pitch;
      near(view.eye.x, sideM, `${name} eye x`);
      near(view.eye.z, -Math.cos(pitch) * distanceM, `${name} eye z`);
      near(view.eye.y, orbitHeightM + Math.sin(pitch) * distanceM, `${name} eye y`);
      near(view.at.x, sideM, `${name} at x`);
      near(view.at.y, lookHeightM, `${name} at y`);
      near(view.at.z, 0, `${name} at z`);
    }
  });

  test("locked, the shoulder view comes in over the shoulder and looks toward the target", () => {
    const me = { x: 0, y: 0, z: 0 }, view = settle(SHOULDER, me, { x: 0, y: 0, z: 10 });
    const { distanceM, sideM, lockPitchRad, lockLookMaxM, orbitHeightM, lookHeightM } = SHOULDER;
    near(view.pitch, lockPitchRad, "pitch");
    near(view.eye.x, sideM, "eye x");
    near(view.eye.z, -Math.cos(lockPitchRad) * distanceM, "eye z");
    near(view.eye.y, orbitHeightM + Math.sin(lockPitchRad) * distanceM, "eye y");
    near(view.at.z, lockLookMaxM, "at z");
    near(view.at.y, lookHeightM, "at y");
  });

  test("locking and unlocking ease, with no jump; unlocking keeps the view", () => {
    const me = { x: 0, y: 0.7, z: 0 }, { ctx, fight, view } = arena(me, { x: 0, y: 0.7, z: 10 });
    const camera = arenaCamera(ctx, FP), lock = ctx.lock;
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
    assert.equal(insideSelf(view.eye, me), true, "locked in first person");
    ctx.lock = null;
    assert.ok(run(240) < 0.5, "unlocking jumped");
    near(view.fovRad, FP.fovRad, "fp fov");
    assert.equal(insideSelf(view.eye, me), true, "unlocked in first person");
    ctx.lock = lock;
    assert.ok(run(240) < 0.5, "locking jumped");
    assert.equal(insideSelf(view.eye, me), true, "locked in first person");
  });

  test("freed (a pan or a drawn bow), it turns by hand off the target; held again, it eases back, with no jump", () => {
    for (const free of ["pan", "aim"] as const) {
      const me = { x: 0, y: 0.7, z: 0 }, { ctx, fight, view, drag } = arena(me, { x: 0, y: 0.7, z: 10 });
      const camera = arenaCamera(ctx, SHOULDER);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      const locked = view.yaw;
      ctx.freeCamera = free;
      drag.dx = 200;
      camera(fight, FRAME_TIME);
      near(view.yaw - locked, 200 * TURN.mouseRadPerPx, `${free}: turned by the drag`, 1e-9);
      drag.dx = 0;
      for (let i = 0; i < 60; i++) camera(fight, FRAME_TIME);
      near(view.yaw - locked, 200 * TURN.mouseRadPerPx, `${free}: stays where it was turned`, 1e-9);
      ctx.freeCamera = null;
      let biggestStepM = 0;
      for (let i = 0; i < 240; i++) {
        const before = { ...view.eye };
        camera(fight, FRAME_TIME);
        biggestStepM = Math.max(biggestStepM, Math.hypot(view.eye.x - before.x, view.eye.z - before.z));
      }
      near(view.yaw, locked, `${free}: back on the target`);
      assert.ok(biggestStepM < 0.5, `${free}: jumped ${biggestStepM} m`);
    }
  });

  test("with a side offset the wall still pulls the camera inside the arena", () => {
    const radiusM = 10, view = settle({ ...SHOULDER, sideM: 1.5 }, { x: 0, y: 0, z: -7 }, null, radiusM);
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
    const camera = arenaCamera(ctx, SHOULDER);
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
    const camera = arenaCamera(ctx, SHOULDER);
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
    const camera = arenaCamera(ctx, SHOULDER);
    drag.dy = 5000;
    camera(fight, FRAME_TIME);
    near(view.pitch, PITCH.aboveRad, "top");
    drag.dy = -5000;
    camera(fight, FRAME_TIME);
    near(view.pitch, -PITCH.belowRad, "bottom");
  });

  test("tilted under, the floor pulls the camera in instead of letting it through", () => {
    const me = { x: 0, y: 0.9, z: 0 }, { ctx, fight, view } = arena(me, null);
    const camera = arenaCamera(ctx, SHOULDER);
    view.pitch = -PITCH.belowRad;
    camera(fight, FRAME_TIME);
    assert.ok(view.eye.y >= me.y - CENTER_HEIGHT_M + FLOOR_MARGIN_M - 1e-9, "above the floor");
    assert.ok(Math.hypot(view.eye.x - SHOULDER.sideM, view.eye.z) < SHOULDER.distanceM, "pulled in");
  });

  test("in first person you look PITCH.firstPersonRad up or down at most, and the look follows the pitch", () => {
    const me = { x: 0, y: 0.7, z: 0 }, { ctx, fight, view, drag } = arena(me, null);
    const camera = arenaCamera(ctx, FP);
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

  test("a dodge looking far up, the tilt eases back inside the third person's cap", () => {
    const { ctx, fight, view } = arena({ x: 0, y: 0.7, z: 0 }, null), dodge = dodger(fight);
    const camera = arenaCamera(ctx, FP);
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    view.pitch = -PITCH.firstPersonRad;
    dodge(true);
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

describe("a dodge zooms out to the shoulder's, and back", () => {
  const me = { x: 0, y: 0, z: 0 };
  const settledEye = (tuning: CameraTuning) => settle(tuning, me, null, 40).eye;
  const sameEye = (eye: Vec3, expected: Vec3, what: string) => {
    for (const axis of ["x", "y", "z"] as const) near(eye[axis], expected[axis], `${what}, ${axis}`, 1e-3);
  };

  test("from first person or nearer than the shoulder, out to the shoulder view; then back to the fight's", () => {
    for (const tuning of [FP, cameraTuning("?cam=close"), SHOULDER, cameraTuning("?cam=both")]) {
      const { ctx, fight, view } = arena(me, null, 40), camera = arenaCamera(ctx, tuning), dodge = dodger(fight);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      dodge(true);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      const what = `${tuning.distanceM} m`;
      sameEye(view.eye, settledEye(tuning.distanceM < SHOULDER.distanceM ? SHOULDER : tuning), `rolling from ${what}`);
      dodge(false);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      sameEye(view.eye, settledEye(tuning), `after, ${what}`);
    }
  });

  test("first person eases out to the shoulder's, locked or not", () => {
    for (const foe of [null, { x: 0, y: 0, z: 10 }]) {
      const { ctx, fight, view } = arena(me, foe, 40), camera = arenaCamera(ctx, FP), dodge = dodger(fight);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      const flat = (distanceM: number, sideM: number) => Math.hypot(sideM, Math.cos(view.pitch) * distanceM);
      dodge(true);
      camera(fight, FRAME_TIME);
      const moved = distanceOf(view, me) - flat(FP.distanceM, FP.sideM);
      assert.ok(moved > 0 && moved < (SHOULDER.distanceM - FP.distanceM) / 4, `eased, moved ${moved} (${!!foe})`);
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      near(distanceOf(view, me), flat(SHOULDER.distanceM, SHOULDER.sideM), `there (${!!foe})`, 1e-3);
    }
  });
});

describe("first person", () => {
  const me = { x: 0, y: 0.7, z: 0 };

  test("the eye is just behind the player's own eyes, inside the body (so it's hidden)", () => {
    const { ctx, fight, view } = arena(me, null);
    const camera = arenaCamera(ctx, FP);
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    near(view.eye.y, me.y + FP.orbitHeightM + orbitBack(view.yaw, view.pitch).y * FP.distanceM, "eye height");
    near(view.fovRad, FP.fovRad, "fov");
    assert.equal(insideSelf(view.eye, me), true);
    assert.equal(insideSelf(settle(SHOULDER, me, null).eye, me), false);
    assert.equal(insideSelf(settle(SHOULDER, me, { x: 0, y: 0.7, z: 5 }).eye, me), false);
  });

  test("running, the eye stays fixed to the body, with no trail; out of first person the trail eases in", () => {
    const inFirstPerson = () => {
      const { ctx, fight, view } = arena({ ...me }, null), dodge = dodger(fight);
      const camera = arenaCamera(ctx, FP), body = fight.world.first(LocalPlayer, Body)![2].pos;
      for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
      return { dodge, view, body, frame: () => camera(fight, FRAME_TIME) };
    };
    const running = inFirstPerson(), standing = inFirstPerson(), stepM = PLAYER.moveSpeed * FRAME_TIME;
    const trailM = () => running.view.eye.z - running.body.z - (standing.view.eye.z - standing.body.z);
    const frame = () => {
      running.body.z += stepM;
      running.frame();
      standing.frame();
    };
    for (let i = 0; i < 60; i++) {
      frame();
      near(trailM(), 0, `frame ${i}: the eye trails`);
    }
    running.dodge(true);
    standing.dodge(true);
    for (let i = 0; i < 240; i++) {
      const before = trailM();
      frame();
      assert.ok(Math.abs(trailM() - before) < stepM, `frame ${i}: the trail jumped ${trailM() - before} m`);
    }
    assert.ok(trailM() < -stepM, `third person still trails: ${trailM()} m`);
  });

  test("it follows the body as drawn, between the fight's last two steps", () => {
    const { ctx, fight, view } = arena({ ...me }, null);
    const camera = arenaCamera(ctx, FP), [e, , body] = fight.world.first(LocalPlayer, Body)!;
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    const standing = view.eye.z - body.pos.z;
    ctx.blend.keep(fight.world, [e]);
    body.pos.z += 1;
    ctx.blend.alpha = 0.25;
    camera(fight, FRAME_TIME);
    near(view.eye.z, me.z + 0.25 + standing, "a quarter of the way into the step");
  });

  test("locked, it looks at the target", () => {
    const { ctx, fight, view } = arena(me, { x: 3, y: 0.7, z: 4 });
    const camera = arenaCamera(ctx, FP);
    for (let i = 0; i < 240; i++) camera(fight, FRAME_TIME);
    near(Math.atan2(view.at.x - view.eye.x, view.at.z - view.eye.z), Math.atan2(3, 4), "toward the target");
  });
});

describe("first person pressed against the arena's wall", () => {
  before(() => initPhysics());
  const RADIUS_M = 10;
  const STATUE: EnemyDef = {
    id: "wild-boar", name: "Statue", maxHp: 100, stats: BASE_STATS, radius: 0.5, walkSpeed: 0, turnRate: 0,
    poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
  };

  function walkedToWall(angle: number): Fight {
    const fight = new Fight({
      arena: { id: "test", radius: RADIUS_M, look: "forest-clearing" },
      players: [{
        at: { x: 0, y: 0.05, z: 0 }, vitals: { hp: maxHpOf(BASE_STATS), stamina: staminaMaxOf(BASE_STATS) },
        stats: BASE_STATS, core: newCore(), burden: "light", book: [],
        gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: emptyEquipment() },
      }],
      enemies: [{ def: STATUE, at: { x: -6 * Math.sin(angle), y: 0.05, z: -6 * Math.cos(angle) }, yaw: 0 }],
    });
    const out = { ...copyInput(IDLE_INPUT), moveX: Math.sin(angle), moveZ: Math.cos(angle) };
    for (let s = 0; s < 180; s++) fight.step([out]);
    fight.world.add(fight.players[0]!, LocalPlayer, true);
    return fight;
  }

  function centreLineMeets(eye: Vec3, at: Vec3): Vec3 {
    const length = Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z);
    const d = { x: (at.x - eye.x) / length, y: (at.y - eye.y) / length, z: (at.z - eye.z) / length };
    const A = d.x * d.x + d.z * d.z, B = eye.x * d.x + eye.z * d.z, C = eye.x * eye.x + eye.z * eye.z - RADIUS_M ** 2;
    const t = Math.min(d.y < 0 ? eye.y / -d.y : Infinity, (-B + Math.sqrt(B * B - A * C)) / A);
    return { x: eye.x + d.x * t, y: eye.y + d.y * t, z: eye.z + d.z * t };
  }

  test("whichever way you look, the eye stays inside, and the aim is the spot the crosshair shows", () => {
    for (const angle of [0, 1, 2.5, 4]) {
      const fight = walkedToWall(angle), me = fight.world.require(fight.players[0]!, Body).pos;
      const wallAngle = Math.atan2(me.x, me.z);
      assert.ok(Math.hypot(me.x, me.z) > RADIUS_M - PLAYER.radius - 0.05, `not at the wall: ${JSON.stringify(me)}`);
      const { ctx } = arena(me, null, RADIUS_M), view = ctx.view;
      ctx.freeCamera = "aim";
      const camera = arenaCamera(ctx, FP);
      for (const turned of [Math.PI, 0.75 * Math.PI, 0.5 * Math.PI, -0.5 * Math.PI, 0]) {
        for (const pitchDeg of [-80, -40, -10, 0, 20, 80]) {
          Object.assign(view, { yaw: wallAngle + turned, pitch: pitchDeg * DEG });
          for (let i = 0; i < 10; i++) camera(fight, FRAME_TIME);
          const what = `at ${angle}, turned ${turned}, pitch ${pitchDeg}`;
          assert.ok(Math.hypot(view.eye.x, view.eye.z) < RADIUS_M, `${what}: eye ${JSON.stringify(view.eye)}`);
          const spot = centreLineMeets(view.eye, view.at);
          if ((spot.x - me.x) * Math.sin(view.yaw) + (spot.z - me.z) * Math.cos(view.yaw) < CROSSHAIR_MIN_M) continue;
          const { at } = playerAim(ctx, [], me, RADIUS_M).aim;
          for (const axis of ["x", "y", "z"] as const) near(at[axis], spot[axis], `${what}: aim ${axis}`, 1e-6);
        }
      }
    }
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
