import { PhysicsRaycastResult, Vector3 } from "@babylonjs/core";
import { clamp, damp, Health, Player, PLAYER, type System } from "@infinite-tower/shared";
import type { Pose } from "../../gfx/look/battle.js";
import { Body, Layer } from "../components.js";
import type { BattleContext } from "../context.js";
import { PlayerSprite, spriteY } from "./components.js";

/** The sword trail starts this long before the swing's hitbox does, and shows this long in all (seconds). */
const TRAIL_LEAD_TIME = 0.03;
const TRAIL_DURATION = 0.2;
/** The trail sweeps from this far to one side of the aim to as far to the other (radians), tilted a little. */
const TRAIL_SWEEP_RAD = 0.7;
const TRAIL_TILT_RAD = 0.22;

/** Per render frame: sprite frame & mirroring, walk bob, squash & stretch, i-frame blink, sword trail, blob shadow. */
export function playerSpriteSystem(ctx: BattleContext): System {
  const vel = new Vector3(), from = new Vector3(), to = new Vector3();
  const result = new PhysicsRaycastResult();
  const slash = PLAYER.slash;
  const frames = ctx.materials.player;

  return (world, dt) => {
    for (const [, sprite, body, player, health] of world.query(PlayerSprite, Body, Player, Health)) {
      const b = body.aggregate.body;
      b.getLinearVelocityToRef(vel);
      const p = body.mesh.position;
      const alive = health.hp > 0;
      const slashing = player.action === "slash";

      // We always see the player from behind, so the sprite never turns, except the swing: its frame has the sword
      // arm out to our right, mirrored on every other swing so the sword ends where the trail does (below).
      const swinging = slashing && player.actionTime < slash.duration * 0.8;
      const trailSide = player.combo % 2 === 0 ? 1 : -1;
      sprite.facing = alive && swinging && trailSide === 1 ? -1 : 1;
      const pose: Pose = !alive ? "down" : swinging ? "slash" : "stand";
      if (sprite.plane.material !== frames[pose]) sprite.plane.material = frames[pose];

      const speed = Math.hypot(vel.x, vel.z);
      const walking = alive && player.grounded && speed > 0.5 && player.action === "none";
      sprite.walkPhase = walking ? sprite.walkPhase + dt * speed * 2.4 : 0;
      const bob = Math.abs(Math.sin(sprite.walkPhase)) * 0.08;

      // Squash while dodging, stretch in the air.
      const targetStretch = !alive ? 1
        : player.action === "dodge" ? 0.72
        : !player.grounded ? 1 + clamp(Math.abs(vel.y) * 0.015, -0.12, 0.15)
        : 1;
      sprite.stretch = damp(sprite.stretch, targetStretch, 18, dt);
      sprite.plane.scaling.set(sprite.facing / sprite.stretch, sprite.stretch, 1);
      sprite.plane.position.y = spriteY(sprite.stretch, bob);

      // Blink while invulnerable after a hit.
      sprite.plane.isVisible = !(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1);

      // Sword trail: a crescent that sweeps across the aim direction, alternating sides each swing: from our right
      // to our left when `trailSide` is 1.
      const trailProgress = slashing ? (player.actionTime - (slash.windup - TRAIL_LEAD_TIME)) / TRAIL_DURATION : -1;
      if (trailProgress >= 0 && trailProgress < 1) {
        const sweep = Math.min(1, trailProgress * 2.2);
        const aimYaw = Math.atan2(player.actionDir.x, player.actionDir.z);
        sprite.slash.setEnabled(true);
        sprite.slash.position.set(p.x, p.y + 0.15, p.z);
        sprite.slash.rotation.set(
          0, aimYaw + trailSide * TRAIL_SWEEP_RAD * (1 - 2 * sweep), trailSide * TRAIL_TILT_RAD,
        );
        sprite.slash.visibility = 1 - trailProgress * trailProgress;
      } else if (sprite.slash.isEnabled()) {
        sprite.slash.setEnabled(false);
      }

      // Blob shadow on the ground.
      from.set(p.x, p.y, p.z);
      to.set(p.x, p.y - 30, p.z);
      ctx.physics.raycastToRef(from, to, result, { collideWith: Layer.Ground, ignoreBody: b });
      if (result.hasHit) {
        const height = p.y - PLAYER.height / 2 - result.hitPointWorld.y;
        const scale = Math.max(0.3, 1 - height * 0.12);
        sprite.shadow.isVisible = true;
        sprite.shadow.position.set(p.x, result.hitPointWorld.y + 0.02, p.z);
        sprite.shadow.scaling.set(scale, 1, scale);
      } else {
        sprite.shadow.isVisible = false;
      }
    }
  };
}
