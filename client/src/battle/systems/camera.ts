import { Vector3 } from "@babylonjs/core";
import { ARENA, Boar, Health, LocalPlayer, wrapAngle, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { GameContext } from "../context.js";
import { BUTTONS, KEYS } from "../keys.js";

const YAW_SPEED = 2.6; // rad/s, H/L
const PITCH_SPEED = 1.4;
const MOUSE_SENSITIVITY = 0.0025; // rad per pixel (mouse or trackpad)
const MOUSE_UNLOCK_PX = 4; // a deliberate mouse flick (px in one frame) drops lock-on; tiny jitter doesn't
const LOCK_RATE = 7; // how quickly lock-on swings the camera onto the target (1/s)
const LOCK_MAX_TURN = 6; // rad/s cap, so passing right next to the enemy doesn't whip the camera
const PITCH_MIN = -0.05;
const PITCH_MAX = 1.1;
const DISTANCE = 8.5;
const SHOULDER = 2.2; // sideways camera offset while locked on, so the player doesn't hide the enemy

/**
 * Third-person orbit camera around the player. Mouse/trackpad (when captured) or H/L (or arrows) turn it a full 360°;
 * with lock-on (; or middle click toggles, on by default) it turns itself to keep the enemy in front.
 * Where it looks is where the player attacks (see inputSystem). Also applies impact shake.
 */
export function cameraSystem(ctx: GameContext): System {
  const k = ctx.keyboard;
  const focus = new Vector3(), look = new Vector3();
  let initialized = false;
  let shoulder = 0; // eases between 0 (free) and SHOULDER (locked)

  return (world, dt) => {
    const view = ctx.view;
    const m = ctx.mouse;
    const turn = k.axis(KEYS.turnLeft, KEYS.turnRight);
    const { dx, dy } = m.consumeDelta();
    // Turning by hand while locked frees the camera (like flicking the stick in a souls game).
    if (turn !== 0 || Math.abs(dx) > MOUSE_UNLOCK_PX) view.lock = false;
    // Checked after, so pressing lock-on mid-turn still locks.
    if (k.consumePressed(...KEYS.lockOn) || m.consumePressed(...BUTTONS.lockOn)) view.lock = !view.lock;
    if (!view.lock) view.yaw += turn * YAW_SPEED * dt + dx * MOUSE_SENSITIVITY;
    view.pitch += k.axis(KEYS.lookUp, KEYS.lookDown) * PITCH_SPEED * dt + dy * MOUSE_SENSITIVITY;
    view.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, view.pitch));

    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].mesh.position;

    if (view.lock) {
      const target = lockTarget(world);
      if (target) {
        const want = Math.atan2(target.x - p.x, target.z - p.z);
        const diff = wrapAngle(want - view.yaw);
        const step = diff * (1 - Math.exp(-LOCK_RATE * dt));
        view.yaw += Math.sign(step) * Math.min(Math.abs(step), LOCK_MAX_TURN * dt);
      }
    }
    view.yaw = wrapAngle(view.yaw);
    shoulder += ((view.lock ? SHOULDER : 0) - shoulder) * (1 - Math.exp(-4 * dt));

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
    // Camera right = (cos yaw, -sin yaw). Only the camera moves sideways (the look point barely does), so it views
    // the player at an angle and a nearby enemy shows beside the sprite instead of behind it. Aim stays = yaw.
    const ox = fz * shoulder, oz = -fx * shoulder;
    ctx.camera.position.set(
      focus.x - fx * flat + ox + (Math.random() - 0.5) * sh,
      focus.y + 1.2 + Math.sin(view.pitch) * dist + (Math.random() - 0.5) * sh,
      focus.z - fz * flat + oz + (Math.random() - 0.5) * sh,
    );
    look.set(focus.x + ox * 0.25, focus.y + 1.3, focus.z + oz * 0.25);
    ctx.camera.setTarget(look);
  };
}

/** The living enemy to lock on to (only boars exist so far). */
function lockTarget(world: Parameters<System>[0]): Vector3 | null {
  for (const [, , health, body] of world.query(Boar, Health, Body)) {
    if (health.hp > 0) return body.mesh.position;
  }
  return null;
}
