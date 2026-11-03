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
/** How far behind the player the camera sits, unless the arena's edge pulls it in (but never closer than MIN). */
const MAX_DISTANCE = 8.5;
const MIN_DISTANCE = 2.5;
/** How quickly the followed point catches up with the player (see dampFactor). */
const FOLLOW_RATE = 12;
/** The camera stays this far inside the arena's wall. */
const WALL_MARGIN = 0.4;
/** Above the player's center: where the camera orbits from, and where it looks. */
const ORBIT_HEIGHT = 1.2;
const LOOK_HEIGHT = 1.3;
/** Locked: how quickly the camera swings round behind the player to the target, and tilts to LOCK_PITCH_RAD. */
const LOCK_TURN_RATE = 12;
const LOCK_PITCH_RAD = 0.3;
/** Locked: the camera looks this share of the way from the player to the target, at most LOCK_LOOK_MAX_M. */
const LOCK_LOOK_SHARE = 0.35;
const LOCK_LOOK_MAX_M = 3;

/** yaw, pitch: radians. */
export interface ArenaView { yaw: number; pitch: number; eye: Vec3; at: Vec3 }

export function arenaCamera(ctx: BattleContext): (fight: Fight, dt: number) => void {
  const focus = { x: 0, y: 0, z: 0 }, lookShift = { x: 0, z: 0 };
  /** On a new fight, the camera jumps to the player instead of gliding over from where the last fight ended. */
  let followed: Fight | null = null;

  return (fight, dt) => {
    const view = ctx.view, world = fight.world;
    const { dx, dy } = ctx.actions.lookDelta();
    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].pos;

    // Follow a smoothed point on the player; unlocked, rotation itself is not smoothed (aiming must feel direct).
    if (fight !== followed) {
      Object.assign(focus, p);
      lookShift.x = lookShift.z = 0;
      followed = fight;
    }
    const k = dampFactor(FOLLOW_RATE, dt);
    focus.x += (p.x - focus.x) * k;
    focus.y += (p.y - focus.y) * k;
    focus.z += (p.z - focus.z) * k;

    const target = ctx.lock === null ? null : world.get(ctx.lock, Body)?.pos ?? null;
    if (target) {
      const turn = dampFactor(LOCK_TURN_RATE, dt), goal = lockYaw(p, target);
      if (goal !== null) view.yaw = wrapAngle(view.yaw + wrapAngle(goal - view.yaw) * turn);
      view.pitch = damp(view.pitch, LOCK_PITCH_RAD, LOCK_TURN_RATE, dt);
      const tx = target.x - focus.x, tz = target.z - focus.z;
      const share = Math.min(LOCK_LOOK_SHARE, LOCK_LOOK_MAX_M / Math.max(1e-3, Math.hypot(tx, tz)));
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
    // Pull the camera in so it never leaves the arena (the standing stones would block the view).
    // Solve |focus - f*s| = reach for the largest s: s = b + sqrt(b² - |focus|² + reach²), with b = focus·f.
    const reach = fight.arena.radius - WALL_MARGIN;
    const b = focus.x * fx + focus.z * fz;
    const maxFlat = b + Math.sqrt(Math.max(0, b * b - (focus.x * focus.x + focus.z * focus.z) + reach * reach));
    const dist = clamp(maxFlat / Math.max(0.05, Math.cos(view.pitch)), MIN_DISTANCE, MAX_DISTANCE);
    const flat = Math.cos(view.pitch) * dist;
    Object.assign(view.eye, {
      x: focus.x - fx * flat, y: focus.y + ORBIT_HEIGHT + Math.sin(view.pitch) * dist, z: focus.z - fz * flat,
    });
    Object.assign(view.at, { x: focus.x + lookShift.x, y: focus.y + LOOK_HEIGHT, z: focus.z + lookShift.z });
  };
}
