import { Body, clamp, damp, Health, Player, type System } from "@infinite-tower/shared";
import { BodyNode } from "../components.js";
import type { BattleContext } from "../context.js";
import { PlayerSprite, spriteY } from "./components.js";
import { TRAIL_WIDTH } from "./spawn.js";
import { spritePose, thrustPose, trailPose } from "./pose.js";

/** The blob shadow looks this far down for the floor. */
const SHADOW_REACH = 30;

/**
 * Per render frame: sprite frame, walk bob, squash & stretch, a stagger's shake, i-frame blink, the sword's trail,
 * thrust and guard, blob shadow.
 */
export function playerSpriteSystem(ctx: BattleContext): System {
  const frames = ctx.materials.player;

  return (world, dt) => {
    for (const [, sprite, body, player, health, drawn] of world.query(PlayerSprite, Body, Player, Health, BodyNode)) {
      // Where it's drawn (systems/follow.ts), so the trail and the shadow stay with the sprite.
      const p = drawn.node.position, vel = body.vel;
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
      sprite.plane.position.x = pose.pose === "stagger" ? Math.sin(player.actionTime * 45) * 0.06 : 0;

      // Blink while invulnerable after a hit.
      sprite.plane.isVisible = !(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1);

      const aimYaw = Math.atan2(player.actionDir.x, player.actionDir.z);
      const trail = trailPose(player);
      sprite.trail.setEnabled(trail !== null);
      if (trail) {
        // A metre ahead at the sprite's chest, across the view; the cut grows from its start end.
        sprite.trail.position.set(p.x + player.actionDir.x, p.y + 0.35, p.z + player.actionDir.z);
        sprite.trail.rotation.set(0, aimYaw, trail.rollRad);
        sprite.slash.position.x = trail.from * TRAIL_WIDTH / 2;
        sprite.slash.scaling.x = -trail.from * trail.reach;
        sprite.slash.visibility = trail.visibility;
      }
      const thrust = thrustPose(player);
      sprite.thrust.setEnabled(thrust !== null);
      if (thrust) {
        sprite.thrust.position.set(p.x, p.y + 0.25, p.z);
        sprite.thrust.rotation.y = aimYaw;
        sprite.thrust.scaling.set(1, 1, thrust.reach);
        for (const mesh of sprite.thrust.getChildMeshes()) mesh.visibility = thrust.visibility;
      }
      sprite.guard.setEnabled(alive && player.action === "block");
      sprite.guard.position.set(p.x, p.y, p.z);
      sprite.guard.rotation.y = aimYaw;

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
