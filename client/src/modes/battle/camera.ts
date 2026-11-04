import { Body, clamp, damp, dampFactor, wrapAngle, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../components.js";
import { floorReach, orbitBack, orbitUp, turnBy } from "../orbit.js";
import type { BattleContext } from "./context.js";
import { lockYaw } from "./lock.js";

const MIN_DISTANCE = 2.5;
/** Tilted under, the eye stays this far above the floor under your feet. */
export const FLOOR_MARGIN_M = 0.25;
/** How quickly the followed point catches up with the player (see dampFactor). */
const FOLLOW_RATE = 12;
/** The camera stays this far inside the arena's wall. */
const WALL_MARGIN = 0.4;
/** Locked: how quickly the camera swings round behind the player to the target, and tilts to its pitch. */
const LOCK_TURN_RATE = 12;
/** How quickly the camera eases between framings: locking on or off, or changing the locked view (see dampFactor). */
const VIEW_EASE_RATE = 6;
/** cam.fade: how near (on the ground) the line from the eye to the target your fighter goes see-through. */
const FADE_RADIUS_M = 0.45;
/** Your own body is hidden while the eye is this near its eyes (first person). */
const INSIDE_SELF_M = 1.2;
const EYE_HEIGHT_M = 0.5;

export interface CameraTuning {
  /** Behind the player, unless the arena's edge pulls it in (never closer than MIN_DISTANCE). */
  distanceM: number;
  /** Above the player's center: where the camera orbits from, and where it looks. */
  orbitHeightM: number;
  lookHeightM: number;
  lockPitchRad: number;
  /** Locked: the camera looks this share of the way from the player to the target, at most lockLookMaxM. */
  lockLookShare: number;
  lockLookMaxM: number;
  sideM: number;
  /** The look point goes this far ahead along the view (first person looks past its own eye). */
  lookAheadM: number;
  fovRad: number;
  fade: boolean;
}

const DEG = Math.PI / 180;

const SHOULDER: CameraTuning = {
  distanceM: 5.5, orbitHeightM: 1.5, lookHeightM: 1.3, lockPitchRad: 14 * DEG, lockLookShare: 0.35, lockLookMaxM: 3,
  sideM: -1.1, lookAheadM: 0, fovRad: 0.9, fade: false,
};

const CLOSE = { ...SHOULDER, distanceM: 3, lockPitchRad: 10 * DEG };
// A little behind the eyes and looking a little down, so your own arms and blade are in view, not at your face.
const FP = {
  distanceM: 0.4, orbitHeightM: EYE_HEIGHT_M, lookHeightM: EYE_HEIGHT_M, lockPitchRad: 12 * DEG, lockLookShare: 1,
  lockLookMaxM: 100, sideM: 0, lookAheadM: 1, fovRad: 75 * DEG,
};

export type CameraView = "shoulder" | "close" | "fp";
const VIEW_ORDER: readonly CameraView[] = ["shoulder", "close", "fp"];

// For Honor style: over the left shoulder, as the sprite's guard holds the blade up on its right.
export const CAMERA_VIEWS: Record<CameraView, CameraTuning> = {
  shoulder: SHOULDER, close: CLOSE, fp: { ...SHOULDER, ...FP },
};

export function nextView(view: CameraView, pressed: readonly string[], dodging: boolean): CameraView {
  if (dodging) return "shoulder";
  if (!pressed.includes("cycleView")) return view;
  return VIEW_ORDER[(VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length]!;
}

// Dev-only presets to try against each other (`?cam=<name>`), in place of the shoulder view.
export const CAMERA_PRESETS = {
  shoulder: SHOULDER,
  close: CLOSE,
  high: { distanceM: 9, lookHeightM: 1, lockPitchRad: 40 * DEG, lockLookShare: 0.45 },
  both: { distanceM: 9, lockPitchRad: 26 * DEG, lockLookShare: 0.5, lockLookMaxM: 20, fovRad: 60 * DEG },
  fp: FP,
} satisfies Record<string, Partial<CameraTuning>>;

const FLAGS: [string, keyof CameraTuning, number][] = [
  ["cam.dist", "distanceM", 1], ["cam.height", "orbitHeightM", 1], ["cam.lookheight", "lookHeightM", 1],
  ["cam.pitch", "lockPitchRad", DEG], ["cam.look", "lockLookShare", 1], ["cam.lookmax", "lockLookMaxM", 1],
  ["cam.side", "sideM", 1], ["cam.fov", "fovRad", DEG],
];

export function cameraTuning(search: string): Record<CameraView, CameraTuning> {
  const params = new URLSearchParams(search), name = params.get("cam") ?? "";
  const preset = Object.hasOwn(CAMERA_PRESETS, name) ? CAMERA_PRESETS[name as keyof typeof CAMERA_PRESETS] : null;
  const shoulder: CameraTuning = { ...CAMERA_VIEWS.shoulder, ...preset };
  for (const [flag, key, scale] of FLAGS) {
    const raw = params.get(flag), value = Number(raw);
    if (raw && Number.isFinite(value)) (shoulder[key] as number) = value * scale;
  }
  if (params.has("cam.fade")) shoulder.fade = true;
  return { ...CAMERA_VIEWS, shoulder };
}

export const insideSelf = (eye: Vec3, me: Vec3): boolean =>
  Math.hypot(eye.x - me.x, eye.y - me.y - EYE_HEIGHT_M, eye.z - me.z) < INSIDE_SELF_M;

/** A fighter is its feet and height; it blocks when it hides any of the target's height, seen from the eye. */
export function blocksView(eye: Vec3, me: Vec3, meHeightM: number, target: Vec3, targetHeightM: number): boolean {
  const lx = target.x - eye.x, lz = target.z - eye.z, mx = me.x - eye.x, mz = me.z - eye.z;
  const t = (mx * lx + mz * lz) / Math.max(1e-6, lx * lx + lz * lz);
  if (t <= 0 || t >= 1 || Math.hypot(mx - lx * t, mz - lz * t) >= FADE_RADIUS_M) return false;
  const lineY = (y: number) => eye.y + (y - eye.y) * t;
  return lineY(target.y) <= me.y + meHeightM && lineY(target.y + targetHeightM) >= me.y;
}

const EASED = [
  "distanceM", "orbitHeightM", "lookHeightM", "lockPitchRad", "lockLookShare", "lockLookMaxM", "sideM", "lookAheadM",
  "fovRad",
] as const;

/** yaw, pitch: radians (orbitBack). */
export interface ArenaView { yaw: number; pitch: number; fovRad: number; eye: Vec3; at: Vec3; up: Vec3 }

export function arenaCamera(
  ctx: BattleContext, views: Record<CameraView, CameraTuning>,
): (fight: Fight, dt: number) => void {
  const focus = { x: 0, y: 0, z: 0 }, lookShift = { x: 0, z: 0 }, tuning = { ...views.shoulder };
  /** On a new fight, the camera jumps to the player instead of gliding over from where the last fight ended. */
  let followed: Fight | null = null;

  return (fight, dt) => {
    const view = ctx.view, world = fight.world;
    const drag = ctx.actions.lookDelta();
    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].pos;

    // Follow a smoothed point on the player; unlocked, rotation itself is not smoothed (aiming must feel direct).
    const target = ctx.lock === null ? null : world.get(ctx.lock, Body)?.pos ?? null;
    const fresh = fight !== followed;
    if (fresh) {
      Object.assign(focus, p);
      lookShift.x = lookShift.z = 0;
      followed = fight;
    }
    const goal = views[ctx.cameraView];
    for (const key of EASED) {
      tuning[key] = fresh ? goal[key] : damp(tuning[key], goal[key], VIEW_EASE_RATE, dt);
    }
    const k = dampFactor(FOLLOW_RATE, dt);
    focus.x += (p.x - focus.x) * k;
    focus.y += (p.y - focus.y) * k;
    focus.z += (p.z - focus.z) * k;

    if (target) {
      const turn = dampFactor(LOCK_TURN_RATE, dt), goal = lockYaw(p, target);
      if (goal !== null) view.yaw = wrapAngle(view.yaw + wrapAngle(goal - view.yaw) * turn);
      view.pitch = wrapAngle(view.pitch + wrapAngle(tuning.lockPitchRad - view.pitch) * turn);
      const tx = target.x - focus.x, tz = target.z - focus.z;
      const share = Math.min(tuning.lockLookShare, tuning.lockLookMaxM / Math.max(1e-3, Math.hypot(tx, tz)));
      lookShift.x += (tx * share - lookShift.x) * turn;
      lookShift.z += (tz * share - lookShift.z) * turn;
    } else {
      const turned = turnBy(ctx.polled, drag, dt, ctx.settings.camera.get().sensitivity);
      view.yaw = wrapAngle(view.yaw + turned.yaw);
      view.pitch = wrapAngle(view.pitch + turned.pitch);
      const fade = 1 - dampFactor(LOCK_TURN_RATE, dt);
      lookShift.x *= fade;
      lookShift.z *= fade;
    }

    const fx = Math.sin(view.yaw), fz = Math.cos(view.yaw), back = orbitBack(view.yaw, view.pitch);
    const ox = focus.x + fz * tuning.sideM, oy = focus.y + tuning.orbitHeightM, oz = focus.z - fx * tuning.sideM;
    // Pull the camera in so it never leaves the arena (the standing stones would block the view).
    // Solve |o + g*s| = reach for the largest s along the eye's flat way g: s = b + sqrt(b² - |o|² + reach²), b = -o·g.
    const reach = fight.arena.radius - WALL_MARGIN, flat = Math.hypot(back.x, back.z);
    const b = flat > 0 ? -(ox * back.x + oz * back.z) / flat : 0;
    const maxFlat = b + Math.sqrt(Math.max(0, b * b - (ox * ox + oz * oz) + reach * reach));
    const wallDist = clamp(
      maxFlat / Math.max(0.05, flat), Math.min(MIN_DISTANCE, tuning.distanceM), tuning.distanceM,
    );
    const dist = floorReach(oy, back.y, focus.y - row[2].centerHeight, wallDist, FLOOR_MARGIN_M);
    Object.assign(view.eye, { x: ox + back.x * dist, y: oy + back.y * dist, z: oz + back.z * dist });
    const ahead = tuning.lookAheadM;
    Object.assign(view.at, {
      x: ox + lookShift.x - back.x * ahead, y: focus.y + tuning.lookHeightM - back.y * ahead,
      z: oz + lookShift.z - back.z * ahead,
    });
    Object.assign(view.up, orbitUp(view.yaw, view.pitch));
    view.fovRad = tuning.fovRad;
  };
}
