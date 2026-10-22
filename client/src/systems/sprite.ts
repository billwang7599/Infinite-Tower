import { PhysicsRaycastResult, Vector3 } from "@babylonjs/core";
import { Player, PLAYER, type System } from "@infinite-tower/shared";
import { Body, SpriteView } from "../components.js";
import { Layer, type GameContext } from "../context.js";

/** Per render frame: sprite facing, walk bob, squash & stretch, and the blob shadow. Visual only. */
export function spriteSystem(ctx: GameContext): System {
  const vel = new Vector3(), from = new Vector3(), to = new Vector3();
  const result = new PhysicsRaycastResult();

  return (world, dt) => {
    for (const [, sprite, body, player] of world.query(SpriteView, Body, Player)) {
      const b = body.aggregate.body;
      b.getLinearVelocityToRef(vel);

      // Face left/right on screen: project velocity onto the camera's right vector.
      const screenX = vel.x * Math.cos(ctx.view.yaw) + vel.z * Math.sin(ctx.view.yaw);
      if (Math.abs(screenX) > 0.3) sprite.facing = screenX > 0 ? 1 : -1;

      const speed = Math.hypot(vel.x, vel.z);
      sprite.walkPhase = player.grounded && speed > 0.5 ? sprite.walkPhase + dt * speed * 2.4 : 0;
      const bob = Math.abs(Math.sin(sprite.walkPhase)) * 0.08;

      // Stretch when moving fast vertically, squash when landing (velocity -> 0 smooths back).
      const target = player.grounded ? 1 : 1 + Math.max(-0.12, Math.min(0.18, Math.abs(vel.y) * 0.015));
      sprite.stretch += (target - sprite.stretch) * (1 - Math.exp(-14 * dt));
      sprite.plane.scaling.set(sprite.facing / sprite.stretch, sprite.stretch, 1);
      sprite.plane.position.y = 0.9 * sprite.stretch + bob;

      // Blob shadow on whatever is below.
      const p = body.mesh.position;
      from.set(p.x, p.y, p.z);
      to.set(p.x, p.y - 30, p.z);
      ctx.physics.raycastToRef(from, to, result, { collideWith: Layer.Platform, ignoreBody: b });
      if (result.hasHit) {
        const dist = p.y - PLAYER.height / 2 - result.hitPointWorld.y;
        const s = Math.max(0.3, 1 - dist * 0.12);
        sprite.shadow.isVisible = true;
        sprite.shadow.position.set(p.x, result.hitPointWorld.y + 0.01, p.z);
        sprite.shadow.scaling.set(s, 1, s);
      } else {
        sprite.shadow.isVisible = false;
      }
    }
  };
}
