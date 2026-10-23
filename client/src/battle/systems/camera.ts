import { Vector3 } from "@babylonjs/core";
import { clamp, dampFactor, LocalPlayer, wrapAngle, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { BattleContext } from "../context.js";

// Turn rates at 100% sensitivity; Settings → Camera scales all three (settings/camera.ts).
const YAW_SPEED = 2.6; // rad/s, turn keys
const PITCH_SPEED = 1.4;
const MOUSE_SENSITIVITY = 0.0025; // rad per pixel (mouse or trackpad)
const PITCH_MIN = -0.05;
const PITCH_MAX = 1.1;
const DISTANCE = 8.5;

/**
 * Third-person orbit camera around the player. Mouse/trackpad (when captured) or the turn keys (H/L) turn it a full 360°.
 * Only the player turns it: there is no lock-on, so aiming is a skill. Where it looks is where the player attacks
 * (see player/input.ts). Also applies impact shake.
 */
export function cameraSystem(ctx: BattleContext): System {
  const k = ctx.keyboard;
  const focus = new Vector3(), look = new Vector3();
  let initialized = false;

  return (world, dt) => {
    const view = ctx.view;
    const m = ctx.mouse;
    const keys = ctx.bindings.get().battle;
    const turn = k.axis(keys.turnLeft, keys.turnRight);
    const tilt = k.axis(keys.lookUp, keys.lookDown);
    const { dx, dy } = m.consumeDelta();
    const s = ctx.cameraSettings.get().sensitivity;
    view.yaw = wrapAngle(view.yaw + (turn * YAW_SPEED * dt + dx * MOUSE_SENSITIVITY) * s);
    view.pitch = clamp(view.pitch + (tilt * PITCH_SPEED * dt + dy * MOUSE_SENSITIVITY) * s, PITCH_MIN, PITCH_MAX);

    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].mesh.position;

    // Follow a smoothed point on the player; rotation itself is not smoothed (aiming must feel direct).
    if (!initialized) { focus.copyFrom(p); initialized = true; }
    Vector3.LerpToRef(focus, p, dampFactor(12, dt), focus);

    const fx = Math.sin(view.yaw), fz = Math.cos(view.yaw);
    // Pull the camera in so it never leaves the arena (the standing stones would block the view).
    // Solve |focus - f*s| = R for the largest s: s = b + sqrt(b² - |focus|² + R²), with b = focus·f.
    const R = ctx.arena.radius - 0.4;
    const b = focus.x * fx + focus.z * fz;
    const maxFlat = b + Math.sqrt(Math.max(0, b * b - (focus.x * focus.x + focus.z * focus.z) + R * R));
    const dist = clamp(maxFlat / Math.max(0.05, Math.cos(view.pitch)), 2.5, DISTANCE);
    const flat = Math.cos(view.pitch) * dist;
    ctx.shake *= Math.exp(-9 * dt);
    const sh = ctx.shake > 0.005 ? ctx.shake : 0;
    ctx.camera.position.set(
      focus.x - fx * flat + (Math.random() - 0.5) * sh,
      focus.y + 1.2 + Math.sin(view.pitch) * dist + (Math.random() - 0.5) * sh,
      focus.z - fz * flat + (Math.random() - 0.5) * sh,
    );
    look.set(focus.x, focus.y + 1.3, focus.z);
    ctx.camera.setTarget(look);
  };
}
