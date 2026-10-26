import { Body, clamp, damp, Health, Player, type System } from "@infinite-tower/shared";
import type { BattleContext } from "../context.js";
import { PlayerSprite, spriteY } from "./components.js";
import { spritePose, trailPose } from "./pose.js";

/** The blob shadow looks this far down for the floor. */
const SHADOW_REACH = 30;

/** Per render frame: sprite frame, walk bob, squash & stretch, i-frame blink, sword trail, blob shadow. */
export function playerSpriteSystem(ctx: BattleContext): System {
  const frames = ctx.materials.player;

  return (world, dt) => {
    for (const [, sprite, body, player, health] of world.query(PlayerSprite, Body, Player, Health)) {
      const p = body.pos, vel = body.vel;
      const alive = health.hp > 0;

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
      const pose = spritePose(player, alive, sprite.stretch);
      const frame = frames[pose.frame];
      if (sprite.plane.material !== frame) sprite.plane.material = frame;
      sprite.plane.scaling.set(pose.scaleX, pose.scaleY, 1);
      sprite.plane.position.y = spriteY(sprite.stretch, bob);

      // Blink while invulnerable after a hit.
      sprite.plane.isVisible = !(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1);

      const trail = trailPose(player);
      if (trail) {
        const aimYaw = Math.atan2(player.actionDir.x, player.actionDir.z);
        sprite.slash.setEnabled(true);
        sprite.slash.position.set(p.x, p.y + 0.15, p.z);
        sprite.slash.rotation.set(0, aimYaw + trail.yawRad, trail.tiltRad);
        sprite.slash.visibility = trail.visibility;
      } else if (sprite.slash.isEnabled()) {
        sprite.slash.setEnabled(false);
      }

      // Blob shadow on the floor.
      const below = ctx.fight?.physics.floorBelow(p.x, p.y, p.z, SHADOW_REACH) ?? null;
      if (below !== null) {
        const floorY = p.y - below;
        const height = p.y - body.centerHeight - floorY;
        const scale = Math.max(0.3, 1 - height * 0.12);
        sprite.shadow.isVisible = true;
        sprite.shadow.position.set(p.x, floorY + 0.02, p.z);
        sprite.shadow.scaling.set(scale, 1, scale);
      } else {
        sprite.shadow.isVisible = false;
      }
    }
  };
}
