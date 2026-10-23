import { PhysicsRaycastResult, Vector3 } from "@babylonjs/core";
import { clamp, damp, Health, Player, PLAYER, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import { Layer, type BattleContext } from "../context.js";
import { PlayerSprite } from "./components.js";

/** Per render frame: sprite frame & facing, walk bob, squash & stretch, i-frame blink, sword trail, blob shadow. */
export function playerSpriteSystem(ctx: BattleContext): System {
  const vel = new Vector3(), from = new Vector3(), to = new Vector3();
  const result = new PhysicsRaycastResult();
  const S = PLAYER.slash;

  return (world, dt) => {
    const c = Math.cos(ctx.view.yaw), s = Math.sin(ctx.view.yaw);
    for (const [, sprite, body, player, health] of world.query(PlayerSprite, Body, Player, Health)) {
      const b = body.aggregate.body;
      b.getLinearVelocityToRef(vel);
      const p = body.mesh.position;
      const alive = health.hp > 0;
      const slashing = player.action === "slash";

      // Face left/right on screen: project onto the camera's right vector (cos, -sin).
      const dir = slashing ? { x: player.actionDir.x * 10, z: player.actionDir.z * 10 } : { x: vel.x, z: vel.z };
      const screenX = dir.x * c - dir.z * s;
      if (alive && Math.abs(screenX) > 0.3) sprite.facing = screenX > 0 ? 1 : -1;

      const frame = !alive ? sprite.frames.down : slashing && player.actionTime < S.duration * 0.8 ? sprite.frames.slash : sprite.frames.idle;
      if (sprite.plane.material !== frame) sprite.plane.material = frame;

      const speed = Math.hypot(vel.x, vel.z);
      sprite.walkPhase = alive && player.grounded && speed > 0.5 && player.action === "none" ? sprite.walkPhase + dt * speed * 2.4 : 0;
      const bob = Math.abs(Math.sin(sprite.walkPhase)) * 0.08;

      // Squash while dodging, stretch in the air.
      let target = 1;
      if (!alive) target = 1;
      else if (player.action === "dodge") target = 0.72;
      else if (!player.grounded) target = 1 + clamp(Math.abs(vel.y) * 0.015, -0.12, 0.15);
      sprite.stretch = damp(sprite.stretch, target, 18, dt);
      sprite.plane.scaling.set(sprite.facing / sprite.stretch, sprite.stretch, 1);
      sprite.plane.position.y = 0.9 * sprite.stretch + bob;

      // Blink while invulnerable after a hit.
      sprite.plane.isVisible = !(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1);

      // Sword trail: a crescent that sweeps across the aim direction, alternating sides each swing.
      const k = slashing ? (player.actionTime - (S.windup - 0.03)) / 0.2 : -1;
      if (k >= 0 && k < 1) {
        const side = player.combo % 2 === 0 ? 1 : -1;
        const sweep = Math.min(1, k * 2.2);
        sprite.slash.setEnabled(true);
        sprite.slash.position.set(p.x, p.y + 0.15, p.z);
        sprite.slash.rotation.set(0, Math.atan2(player.actionDir.x, player.actionDir.z) + side * (0.7 - 1.4 * sweep), side * 0.22);
        sprite.slash.visibility = 1 - k * k;
      } else if (sprite.slash.isEnabled()) {
        sprite.slash.setEnabled(false);
      }

      // Blob shadow on the ground.
      from.set(p.x, p.y, p.z);
      to.set(p.x, p.y - 30, p.z);
      ctx.physics.raycastToRef(from, to, result, { collideWith: Layer.Ground, ignoreBody: b });
      if (result.hasHit) {
        const height = p.y - PLAYER.height / 2 - result.hitPointWorld.y;
        const sc = Math.max(0.3, 1 - height * 0.12);
        sprite.shadow.isVisible = true;
        sprite.shadow.position.set(p.x, result.hitPointWorld.y + 0.02, p.z);
        sprite.shadow.scaling.set(sc, 1, sc);
      } else {
        sprite.shadow.isVisible = false;
      }
    }
  };
}
