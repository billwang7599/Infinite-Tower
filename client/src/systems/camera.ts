import { Vector3 } from "@babylonjs/core";
import { LocalPlayer, type System } from "@infinite-tower/shared";
import { Body, SideWall } from "../components.js";
import type { GameContext } from "../context.js";

/** Orbit limits. Yaw is capped so the camera stays in front of the tower instead of going behind the walls. */
const YAW_LIMIT = 1.0; // ~57°
const PITCH_MIN = -0.15;
const PITCH_MAX = 1.0;
const YAW_SPEED = 1.8; // rad/s
const PITCH_SPEED = 1.2;
const DISTANCE = 15.2;

/**
 * Orbiting 2.5D follow camera with exponential smoothing. Arrow keys turn (left/right) and tilt (up/down)
 * around the player. Also carries the player's lantern light and fades the side wall the camera looks through.
 */
export function cameraSystem(ctx: GameContext, lantern: { position: Vector3 }): System {
  const k = ctx.keyboard;
  const desired = new Vector3(), look = new Vector3(), lookTarget = new Vector3();
  let initialized = false;

  return (world, dt) => {
    const view = ctx.view;
    view.yaw += k.axis(["ArrowLeft"], ["ArrowRight"]) * YAW_SPEED * dt;
    view.pitch += k.axis(["ArrowDown"], ["ArrowUp"]) * PITCH_SPEED * dt;
    view.yaw = Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, view.yaw));
    view.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, view.pitch));

    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].mesh.position;

    // Orbit a point slightly above the player (they're always climbing).
    // Yaw 0 = looking down +z at the back wall; positive yaw swings the camera to the right (+x).
    lookTarget.set(p.x * 0.6, p.y + 2.2, p.z);
    const flat = Math.cos(view.pitch) * DISTANCE;
    desired.set(
      lookTarget.x + Math.sin(view.yaw) * flat,
      lookTarget.y + Math.sin(view.pitch) * DISTANCE,
      lookTarget.z - Math.cos(view.yaw) * flat,
    );
    if (!initialized) {
      ctx.camera.position.copyFrom(desired);
      look.copyFrom(lookTarget);
      initialized = true;
    }
    const t = 1 - Math.exp(-5 * dt);
    Vector3.LerpToRef(ctx.camera.position, desired, t, ctx.camera.position);
    Vector3.LerpToRef(look, lookTarget, t * 1.4, look);
    ctx.camera.setTarget(look);

    // When orbiting to one side, that side's wall sits between camera and player: fade it out.
    const fade = Math.min(1, Math.max(0, (Math.abs(view.yaw) - 0.25) / 0.35));
    const side = Math.sign(view.yaw);
    for (const [, wall, body] of world.query(SideWall, Body)) {
      const target = wall.side === side ? 1 - 0.8 * fade : 1;
      const m = body.mesh;
      m.visibility += (target - m.visibility) * (1 - Math.exp(-10 * dt));
      if (Math.abs(m.visibility - target) < 0.01) m.visibility = target;
    }

    lantern.position.set(p.x, p.y + 1.2, p.z - 1.2);
  };
}
