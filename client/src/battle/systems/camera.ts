import { Vector3 } from "@babylonjs/core";
import { Body, clamp, dampFactor, LocalPlayer, wrapAngle, type System } from "@infinite-tower/shared";
import type { Fight, FightEvent } from "@infinite-tower/shared/fight";
import type { BattleContext } from "../context.js";

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
/** Shake decays by e every 1/9 s; below the cutoff it stops. */
const SHAKE_DECAY_PER_SEC = 9;
const SHAKE_CUTOFF = 0.005;

/** How hard each event shakes the camera: a slam, a hit taken or dealt, a blow on the guard. */
function shakeOf(event: FightEvent): number {
  switch (event.type) {
    case "slam": return 0.35;
    case "hit": return event.team === "player" ? 0.15 + event.damage * 0.008 : 0.06;
    case "block": return event.guardBreak ? 0.2 : 0.08;
  }
}

/** After each step of the fight: shake the camera for what hit hard in it (cameraSystem decays the shake). */
export function addImpactShake(ctx: BattleContext, events: readonly FightEvent[]): void {
  for (const event of events) ctx.shake = Math.max(ctx.shake, shakeOf(event));
}

/**
 * Third-person orbit camera around the player. Mouse/trackpad (when captured) or the turn keys (Q/E) turn it a full
 * 360°. Only the player turns it: there is no lock-on, so aiming is a skill. Where it looks is where the player
 * attacks (see player/input.ts). Also applies the impact shake (addImpactShake), decaying it.
 */
export function cameraSystem(ctx: BattleContext): System {
  const { actions, mouse } = ctx;
  const focus = new Vector3(), look = new Vector3();
  /** On a new fight, the camera jumps to the player instead of gliding over from where the last fight ended. */
  let followed: Fight | null = null;

  return (world, dt) => {
    const view = ctx.view;
    const turn = actions.axis("battle", "turnLeft", "turnRight");
    const tilt = actions.axis("battle", "lookUp", "lookDown");
    const { dx, dy } = mouse.consumeDelta();
    const sensitivity = ctx.settings.camera.get().sensitivity;
    view.yaw = wrapAngle(view.yaw + (turn * YAW_RAD_PER_SEC * dt + dx * MOUSE_RAD_PER_PX) * sensitivity);
    view.pitch = clamp(
      view.pitch + (tilt * PITCH_RAD_PER_SEC * dt + dy * MOUSE_RAD_PER_PX) * sensitivity, PITCH_MIN_RAD, PITCH_MAX_RAD,
    );

    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].pos;

    // Follow a smoothed point on the player; rotation itself is not smoothed (aiming must feel direct).
    if (ctx.fight !== followed) { focus.set(p.x, p.y, p.z); followed = ctx.fight; }
    const k = dampFactor(FOLLOW_RATE, dt);
    focus.set(focus.x + (p.x - focus.x) * k, focus.y + (p.y - focus.y) * k, focus.z + (p.z - focus.z) * k);

    const fx = Math.sin(view.yaw), fz = Math.cos(view.yaw);
    // Pull the camera in so it never leaves the arena (the standing stones would block the view).
    // Solve |focus - f*s| = reach for the largest s: s = b + sqrt(b² - |focus|² + reach²), with b = focus·f.
    const reach = ctx.arena.radius - WALL_MARGIN;
    const b = focus.x * fx + focus.z * fz;
    const maxFlat = b + Math.sqrt(Math.max(0, b * b - (focus.x * focus.x + focus.z * focus.z) + reach * reach));
    const dist = clamp(maxFlat / Math.max(0.05, Math.cos(view.pitch)), MIN_DISTANCE, MAX_DISTANCE);
    const flat = Math.cos(view.pitch) * dist;
    ctx.shake *= Math.exp(-SHAKE_DECAY_PER_SEC * dt);
    const shake = ctx.shake > SHAKE_CUTOFF ? ctx.shake : 0;
    ctx.camera.position.set(
      focus.x - fx * flat + (Math.random() - 0.5) * shake,
      focus.y + ORBIT_HEIGHT + Math.sin(view.pitch) * dist + (Math.random() - 0.5) * shake,
      focus.z - fz * flat + (Math.random() - 0.5) * shake,
    );
    look.set(focus.x, focus.y + LOOK_HEIGHT, focus.z);
    ctx.camera.setTarget(look);
  };
}
