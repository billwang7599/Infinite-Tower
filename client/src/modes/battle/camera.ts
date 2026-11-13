import { Body, clamp, damp, dampFactor, Player, wrapAngle, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../components.js";
import { floorReach, orbitBack, PITCH, turnBy } from "../orbit.js";
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
/** How quickly the camera eases between framings: locking on or off, a dodge's zoom out and back (see dampFactor). */
const VIEW_EASE_RATE = 6;
/** cam.fade: how near (on the ground) the line from the eye to the target your fighter goes see-through. */
const FADE_RADIUS_M = 0.45;
/** Your own body is hidden while the eye is this near its eyes (first person). */
const INSIDE_SELF_M = 1.2;
const EYE_HEIGHT_M = 0.5;

export interface CameraTuning {
  /** Behind the player, unless the arena's edge pulls it in (never closer than MIN_DISTANCE but in first person). */
  distanceM: number;
  /** The share of the follow's lag kept: 1 trails the body as the smoothed point does, 0 stays on it. */
  trailShare: number;
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
  minPitchRad: number;
  maxPitchRad: number;
  fade: boolean;
}

const DEG = Math.PI / 180;

// Over the left shoulder, For Honor style, as the sprite's guard holds the blade up on its right.
const SHOULDER: CameraTuning = {
  distanceM: 5.5, orbitHeightM: 1.5, lookHeightM: 1.3, lockPitchRad: 14 * DEG, lockLookShare: 0.35, lockLookMaxM: 3,
  sideM: -1.1, lookAheadM: 0, fovRad: 0.9, minPitchRad: -PITCH.belowRad, maxPitchRad: PITCH.aboveRad, fade: false,
  trailShare: 1,
};

// A little behind the eyes and looking a little down, so your own arms and blade are in view, not at your face.
const FP = {
  distanceM: 0.4, orbitHeightM: EYE_HEIGHT_M, lookHeightM: EYE_HEIGHT_M, lockPitchRad: 12 * DEG, lockLookShare: 1,
  lockLookMaxM: 100, sideM: 0, lookAheadM: 1, fovRad: 75 * DEG, minPitchRad: -PITCH.firstPersonRad,
  maxPitchRad: PITCH.firstPersonRad, trailShare: 0,
};

export const CAMERA_VIEWS: Record<"shoulder" | "fp", CameraTuning> = { shoulder: SHOULDER, fp: { ...SHOULDER, ...FP } };

// Dev-only (`?cam=<name>`): the fight's view in place of first person, to try third person against it.
export const CAMERA_PRESETS = {
  shoulder: SHOULDER,
  close: { distanceM: 3 },
  high: { distanceM: 9, lookHeightM: 1, lockPitchRad: 40 * DEG, lockLookShare: 0.45 },
  both: { distanceM: 9, lockPitchRad: 26 * DEG, lockLookShare: 0.5, lockLookMaxM: 20, fovRad: 60 * DEG },
  fp: FP,
} satisfies Record<string, Partial<CameraTuning>>;

const FLAGS: [string, keyof CameraTuning, number][] = [
  ["cam.dist", "distanceM", 1], ["cam.height", "orbitHeightM", 1], ["cam.lookheight", "lookHeightM", 1],
  ["cam.pitch", "lockPitchRad", DEG], ["cam.look", "lockLookShare", 1], ["cam.lookmax", "lockLookMaxM", 1],
  ["cam.side", "sideM", 1], ["cam.fov", "fovRad", DEG],
];

export function cameraTuning(search: string): CameraTuning {
  const params = new URLSearchParams(search), name = params.get("cam") ?? "";
  const preset = Object.hasOwn(CAMERA_PRESETS, name) ? CAMERA_PRESETS[name as keyof typeof CAMERA_PRESETS] : FP;
  const tuning: CameraTuning = { ...SHOULDER, ...preset };
  for (const [flag, key, scale] of FLAGS) {
    const raw = params.get(flag), value = Number(raw);
    if (raw && Number.isFinite(value)) (tuning[key] as number) = value * scale;
  }
  if (params.has("cam.fade")) tuning.fade = true;
  return tuning;
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
  "fovRad", "minPitchRad", "maxPitchRad", "trailShare",
] as const;

/** yaw, pitch: radians (orbitBack). */
export interface ArenaView { yaw: number; pitch: number; fovRad: number; eye: Vec3; at: Vec3 }

export function arenaCamera(ctx: BattleContext, fightView: CameraTuning): (fight: Fight, dt: number) => void {
  const focus = { x: 0, y: 0, z: 0 }, follow = { x: 0, y: 0, z: 0 }, lookShift = { x: 0, z: 0 };
  const tuning = { ...fightView };
  /** On a new fight, the camera jumps to the player instead of gliding over from where the last fight ended. */
  let followed: Fight | null = null;

  return (fight, dt) => {
    const view = ctx.view, world = fight.world;
    const drag = ctx.actions.lookDelta();
    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = ctx.blend.pos(world, row[0]), lock = ctx.lock;

    // Follow a smoothed point on the player; freed, rotation itself is not smoothed (aiming must feel direct).
    const locked = lock !== null && ctx.freeCamera === null && world.has(lock, Body);
    const target = locked ? ctx.blend.pos(world, lock) : null;
    const fresh = fight !== followed;
    if (fresh) {
      Object.assign(focus, p);
      lookShift.x = lookShift.z = 0;
      followed = fight;
    }
    const dodging = world.get(row[0], Player)?.action === "dodge";
    const goal = dodging && fightView.distanceM < SHOULDER.distanceM ? SHOULDER : fightView;
    for (const key of EASED) {
      tuning[key] = fresh ? goal[key] : damp(tuning[key], goal[key], VIEW_EASE_RATE, dt);
    }
    const k = dampFactor(FOLLOW_RATE, dt);
    focus.x += (p.x - focus.x) * k;
    focus.y += (p.y - focus.y) * k;
    focus.z += (p.z - focus.z) * k;
    const trail = tuning.trailShare;
    Object.assign(follow, {
      x: p.x + (focus.x - p.x) * trail, y: p.y + (focus.y - p.y) * trail, z: p.z + (focus.z - p.z) * trail,
    });

    if (target) {
      const turn = dampFactor(LOCK_TURN_RATE, dt), goal = lockYaw(p, target);
      if (goal !== null) view.yaw = wrapAngle(view.yaw + wrapAngle(goal - view.yaw) * turn);
      view.pitch += (tuning.lockPitchRad - view.pitch) * turn;
      const tx = target.x - follow.x, tz = target.z - follow.z;
      const share = Math.min(tuning.lockLookShare, tuning.lockLookMaxM / Math.max(1e-3, Math.hypot(tx, tz)));
      lookShift.x += (tx * share - lookShift.x) * turn;
      lookShift.z += (tz * share - lookShift.z) * turn;
    } else {
      const turned = turnBy(ctx.polled, drag, dt, ctx.settings.camera.get().sensitivity);
      view.yaw = wrapAngle(view.yaw + turned.yaw);
      view.pitch += turned.pitch;
      const fade = 1 - dampFactor(LOCK_TURN_RATE, dt);
      lookShift.x *= fade;
      lookShift.z *= fade;
    }

    view.pitch = clamp(view.pitch, tuning.minPitchRad, tuning.maxPitchRad);
    const fx = Math.sin(view.yaw), fz = Math.cos(view.yaw), back = orbitBack(view.yaw, view.pitch);
    const ox = follow.x + fz * tuning.sideM, oz = follow.z - fx * tuning.sideM;
    const oy = follow.y + tuning.orbitHeightM;
    // Pull the camera in so it never leaves the arena (the standing stones would block the view).
    // Solve |o + g*s| = reach for the largest s along the eye's flat way g: s = b + sqrt(b² - |o|² + reach²), b = -o·g.
    const reach = fight.arena.radius - WALL_MARGIN, flat = Math.hypot(back.x, back.z);
    const b = flat > 0 ? -(ox * back.x + oz * back.z) / flat : 0;
    const maxFlat = b + Math.sqrt(Math.max(0, b * b - (ox * ox + oz * oz) + reach * reach));
    const nearestM = Math.min(MIN_DISTANCE, tuning.distanceM - FP.distanceM);
    const wallDist = clamp(maxFlat / Math.max(0.05, flat), nearestM, tuning.distanceM);
    const dist = floorReach(oy, back.y, follow.y - row[2].centerHeight, wallDist, FLOOR_MARGIN_M);
    Object.assign(view.eye, { x: ox + back.x * dist, y: oy + back.y * dist, z: oz + back.z * dist });
    // The tilt is the view's own, from its pitch and framing alone: the look point shifts toward the target and the eye
    // is pulled in by the wall or floor, but at the look's height for that tilt, so walking never tilts the camera.
    const ahead = tuning.lookAheadM;
    const at = { x: ox - back.x * ahead, y: follow.y + tuning.lookHeightM - back.y * ahead, z: oz - back.z * ahead };
    const tunedFlat = (tuning.distanceM + ahead) * flat;
    const tunedDrop = oy + back.y * tuning.distanceM - at.y;
    at.x += lookShift.x;
    at.z += lookShift.z;
    if (tunedFlat > 1e-6) at.y = view.eye.y - (tunedDrop / tunedFlat) * Math.hypot(at.x - view.eye.x, at.z - view.eye.z);
    Object.assign(view.at, at);
    view.fovRad = tuning.fovRad;
  };
}
