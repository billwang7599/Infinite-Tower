import { Body, clamp, damp, dampFactor, wrapAngle, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../components.js";
import type { BattleContext } from "./context.js";
import { lockYaw } from "./lock.js";

// Turn rates at 100% sensitivity; Settings → Camera scales all three (settings/camera.ts).
const YAW_RAD_PER_SEC = 2.6;
const PITCH_RAD_PER_SEC = 1.4;
const MOUSE_RAD_PER_PX = 0.0025;
const PITCH_MIN_RAD = -0.05;
const PITCH_MAX_RAD = 1.1;
const MIN_DISTANCE = 2.5;
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
const EYE_HEIGHT_M = 0.75;

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
  /** The look point goes this far ahead along the yaw (first person looks past its own eye). */
  lookAheadM: number;
  fovRad: number;
  fade: boolean;
}

export const CAMERA: CameraTuning = {
  distanceM: 8.5, orbitHeightM: 1.2, lookHeightM: 1.3, lockPitchRad: 0.3, lockLookShare: 0.35, lockLookMaxM: 3,
  sideM: 0, lookAheadM: 0, fovRad: 0.9, fade: false,
};

const DEG = Math.PI / 180;

const SHOULDER = { distanceM: 5.5, orbitHeightM: 1.5, lookHeightM: 1.3, lockPitchRad: 14 * DEG, sideM: -1.1 };

const CLOSE = { ...SHOULDER, distanceM: 3, lockPitchRad: 10 * DEG };
const FP = {
  distanceM: 0, orbitHeightM: EYE_HEIGHT_M, lookHeightM: EYE_HEIGHT_M, lockPitchRad: 0, lockLookShare: 1,
  lockLookMaxM: 100, lookAheadM: 1, fovRad: 75 * DEG,
};

export type LockedView = "shoulder" | "close" | "fp";
const VIEW_ORDER: readonly LockedView[] = ["shoulder", "close", "fp"];

// Locked on, For Honor style: over the left shoulder, as the sprite's guard holds the blade up on its right.
export const LOCKED_VIEWS: Record<LockedView, CameraTuning> = {
  shoulder: { ...CAMERA, ...SHOULDER }, close: { ...CAMERA, ...CLOSE }, fp: { ...CAMERA, ...FP },
};

export interface CameraTunings { free: CameraTuning; views: Record<LockedView, CameraTuning> }

export function nextLockedView(
  view: LockedView, pressed: readonly string[], locked: boolean, dodging: boolean,
): LockedView {
  if (dodging) return "shoulder";
  if (!locked || !pressed.includes("cycleView")) return view;
  return VIEW_ORDER[(VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length]!;
}

// Dev-only presets to try against each other (`?cam=<name>`): the camera unlocked and in the shoulder view.
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

export function cameraTuning(search: string): CameraTunings {
  const params = new URLSearchParams(search), name = params.get("cam") ?? "";
  const preset = Object.hasOwn(CAMERA_PRESETS, name) ? CAMERA_PRESETS[name as keyof typeof CAMERA_PRESETS] : null;
  const tunings = {
    free: { ...CAMERA, ...preset },
    views: { ...LOCKED_VIEWS, shoulder: preset ? { ...CAMERA, ...preset } : { ...LOCKED_VIEWS.shoulder } },
  };
  for (const tuning of [tunings.free, tunings.views.shoulder]) {
    for (const [flag, key, scale] of FLAGS) {
      const raw = params.get(flag), value = Number(raw);
      if (raw && Number.isFinite(value)) (tuning[key] as number) = value * scale;
    }
    if (params.has("cam.fade")) tuning.fade = true;
  }
  return tunings;
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

/** yaw, pitch: radians. */
export interface ArenaView { yaw: number; pitch: number; fovRad: number; eye: Vec3; at: Vec3 }

export function arenaCamera(ctx: BattleContext, { free, views }: CameraTunings): (fight: Fight, dt: number) => void {
  const focus = { x: 0, y: 0, z: 0 }, lookShift = { x: 0, z: 0 }, tuning = { ...free };
  /** On a new fight, the camera jumps to the player instead of gliding over from where the last fight ended. */
  let followed: Fight | null = null;

  return (fight, dt) => {
    const view = ctx.view, world = fight.world;
    const { dx, dy } = ctx.actions.lookDelta();
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
    const goal = target ? views[ctx.lockedView] : free;
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
      view.pitch = damp(view.pitch, tuning.lockPitchRad, LOCK_TURN_RATE, dt);
      const tx = target.x - focus.x, tz = target.z - focus.z;
      const share = Math.min(tuning.lockLookShare, tuning.lockLookMaxM / Math.max(1e-3, Math.hypot(tx, tz)));
      lookShift.x += (tx * share - lookShift.x) * turn;
      lookShift.z += (tz * share - lookShift.z) * turn;
    } else {
      const { turn, look: tilt } = ctx.polled;
      const drag = ctx.polled.held.has("dragCamera");
      const sensitivity = ctx.settings.camera.get().sensitivity;
      view.yaw = wrapAngle(view.yaw + (turn * YAW_RAD_PER_SEC * dt + (drag ? dx * MOUSE_RAD_PER_PX : 0)) * sensitivity);
      view.pitch = clamp(
        view.pitch + (tilt * PITCH_RAD_PER_SEC * dt + (drag ? dy * MOUSE_RAD_PER_PX : 0)) * sensitivity,
        PITCH_MIN_RAD, PITCH_MAX_RAD,
      );
      const fade = 1 - dampFactor(LOCK_TURN_RATE, dt);
      lookShift.x *= fade;
      lookShift.z *= fade;
    }

    const fx = Math.sin(view.yaw), fz = Math.cos(view.yaw);
    const ox = focus.x + fz * tuning.sideM, oz = focus.z - fx * tuning.sideM;
    // Pull the camera in so it never leaves the arena (the standing stones would block the view).
    // Solve |o - f*s| = reach for the largest s: s = b + sqrt(b² - |o|² + reach²), with b = o·f.
    const reach = fight.arena.radius - WALL_MARGIN;
    const b = ox * fx + oz * fz;
    const maxFlat = b + Math.sqrt(Math.max(0, b * b - (ox * ox + oz * oz) + reach * reach));
    const dist = clamp(
      maxFlat / Math.max(0.05, Math.cos(view.pitch)), Math.min(MIN_DISTANCE, tuning.distanceM), tuning.distanceM,
    );
    const flat = Math.cos(view.pitch) * dist;
    Object.assign(view.eye, {
      x: ox - fx * flat, y: focus.y + tuning.orbitHeightM + Math.sin(view.pitch) * dist, z: oz - fz * flat,
    });
    const ahead = tuning.lookAheadM;
    Object.assign(view.at, {
      x: ox + lookShift.x + fx * ahead, y: focus.y + tuning.lookHeightM, z: oz + lookShift.z + fz * ahead,
    });
    view.fovRad = tuning.fovRad;
  };
}
