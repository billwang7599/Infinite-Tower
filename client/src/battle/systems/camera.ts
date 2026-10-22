import { Vector3 } from "@babylonjs/core";
import { ARENA, LocalPlayer, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { GameContext } from "../context.js";

const YAW_SPEED = 2.4; // rad/s, arrow keys
const PITCH_SPEED = 1.4;
const MOUSE_SENSITIVITY = 0.0025; // rad per pixel
const PITCH_MIN = -0.05;
const PITCH_MAX = 1.1;
const DISTANCE = 8.5;

/**
 * Third-person orbit camera around the player: mouse (pointer lock) or arrow keys, full 360°.
 * Where it looks is where the player attacks (see inputSystem). Also applies impact shake.
 */
export function cameraSystem(ctx: GameContext): System {
  const k = ctx.keyboard;
  const focus = new Vector3(), look = new Vector3();
  let initialized = false;

  return (world, dt) => {
    const view = ctx.view;
    const { dx, dy } = ctx.mouse.consumeDelta();
    view.yaw += k.axis(["ArrowLeft"], ["ArrowRight"]) * YAW_SPEED * dt + dx * MOUSE_SENSITIVITY;
    view.pitch += k.axis(["ArrowUp"], ["ArrowDown"]) * PITCH_SPEED * dt + dy * MOUSE_SENSITIVITY;
    view.yaw = Math.atan2(Math.sin(view.yaw), Math.cos(view.yaw));
    view.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, view.pitch));

    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].mesh.position;

    // Follow a smoothed point on the player; rotation itself is not smoothed (aiming must feel direct).
    if (!initialized) { focus.copyFrom(p); initialized = true; }
    Vector3.LerpToRef(focus, p, 1 - Math.exp(-12 * dt), focus);

    const fx = Math.sin(view.yaw), fz = Math.cos(view.yaw);
    // Pull the camera in so it never leaves the arena (the standing stones would block the view).
    // Solve |focus - f*s| = R for the largest s: s = b + sqrt(b² - |focus|² + R²), with b = focus·f.
    const R = ARENA.radius - 0.4;
    const b = focus.x * fx + focus.z * fz;
    const maxFlat = b + Math.sqrt(Math.max(0, b * b - (focus.x * focus.x + focus.z * focus.z) + R * R));
    const dist = Math.max(2.5, Math.min(DISTANCE, maxFlat / Math.max(0.05, Math.cos(view.pitch))));
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
