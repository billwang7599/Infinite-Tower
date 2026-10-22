import { Vector3 } from "@babylonjs/core";
import { Player, PlayerInput, PLAYER, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import { Layer } from "../context.js";

function approach(current: number, target: number, maxDelta: number): number {
  return current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target);
}

/**
 * Character controller. Runs before each physics step and only ever writes velocity:
 * Havok owns the position. Gravity comes from the physics world.
 */
export function movementSystem(): System {
  const v = new Vector3();
  return (world, dt) => {
    for (const [, player, input, body] of world.query(Player, PlayerInput, Body)) {
      const b = body.aggregate.body;
      b.getLinearVelocityToRef(v);

      // Horizontal: accelerate toward target speed (snappier on the ground than in the air).
      let ix = input.moveX, iz = input.moveZ;
      const len = Math.hypot(ix, iz);
      if (len > 1) { ix /= len; iz /= len; }
      const accel = (player.grounded ? PLAYER.accel : PLAYER.airAccel) * dt;
      v.x = approach(v.x, ix * PLAYER.moveSpeed, accel);
      v.z = approach(v.z, iz * PLAYER.moveSpeed, accel);

      // Jump with buffering (press slightly early) and coyote time (press slightly late).
      const pressed = input.jump && !player.jumpHeld;
      player.jumpBuffer = pressed ? PLAYER.jumpBuffer : Math.max(0, player.jumpBuffer - dt);
      const canJump = player.grounded || player.airTime < PLAYER.coyoteTime;
      if (player.jumpBuffer > 0 && canJump) {
        v.y = PLAYER.jumpSpeed;
        player.jumpBuffer = 0;
        player.grounded = false;
        player.airTime = PLAYER.coyoteTime; // no second coyote jump
      }
      // Variable jump height: releasing early cuts the rise.
      if (!input.jump && player.jumpHeld && v.y > 0) v.y *= PLAYER.jumpCutMultiplier;
      player.jumpHeld = input.jump;

      b.setLinearVelocity(v);

      // One-way platforms: ignore them while moving up, collide again on the way down.
      const mask = v.y > 0.1 ? Layer.Wall : Layer.Wall | Layer.Platform;
      if (body.aggregate.shape.filterCollideMask !== mask) body.aggregate.shape.filterCollideMask = mask;
    }
  };
}
