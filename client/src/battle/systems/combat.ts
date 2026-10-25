import { Vector3 } from "@babylonjs/core";
import {
  ActiveHit, Enemy, Fighter, FighterStats, Health, physicalDamage, Player, PLAYER,
  type Entity, type System, type World,
} from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { BattleContext } from "../context.js";

/** Seconds a fighter flashes after a hit. */
const HIT_FLASH_TIME = 0.12;
/** Closer than this, a target counts as in front whatever the angle (centers nearly on top of each other). */
const MIN_ANGLE_CHECK_DIST = 0.3;
/** A hit player loses control for this long, plus a little more the harder they're knocked back. */
const HITSTUN_TIME = 0.25;
const HITSTUN_PER_KNOCKBACK = 0.02;

/** What a hitbox needs from an attack. Knockback, lift and poise damage default to 0. */
export interface HitSpec {
  range: number;
  minDot: number;
  /** At strength 10. */
  damage: number;
  knockback?: number;
  lift?: number;
  poiseDamage?: number;
}

/** Make an attack's hitbox live on `e`, aimed along (dirX, dirZ), hitting as hard as `e`'s strength says. */
export function addHit(world: World, e: Entity, dirX: number, dirZ: number, attack: HitSpec): void {
  world.add(e, ActiveHit, {
    dirX, dirZ, range: attack.range, minDot: attack.minDot,
    damage: physicalDamage(attack.damage, world.require(e, FighterStats)),
    knockback: attack.knockback ?? 0, lift: attack.lift ?? 0, poiseDamage: attack.poiseDamage ?? 0,
    alreadyHit: new Set(),
  });
}

/**
 * After each physics step: tick the hit timers, then resolve every active hitbox against every fighter of the other
 * team. Hitboxes are sectors (range + angle) checked with plain math, not physics triggers: cheap, deterministic
 * and identical on a future server.
 */
export function combatSystem(ctx: BattleContext): System {
  const knock = new Vector3();
  return (world, dt) => {
    for (const [, h] of world.query(Health)) {
      h.invuln = Math.max(0, h.invuln - dt);
      h.hitstun = Math.max(0, h.hitstun - dt);
      h.flash = Math.max(0, h.flash - dt);
    }

    for (const [, hit, attackerBody, attacker] of world.query(ActiveHit, Body, Fighter)) {
      const from = attackerBody.mesh.position;
      for (const [target, targetHealth, targetBody, targetFighter] of world.query(Health, Body, Fighter)) {
        if (targetFighter.team === attacker.team || targetHealth.hp <= 0 || targetHealth.invuln > 0) continue;
        if (hit.alreadyHit.has(target)) continue;
        const player = world.get(target, Player);
        // Dodge i-frames.
        if (player?.action === "dodge"
          && player.actionTime >= PLAYER.dodge.iframeStart && player.actionTime < PLAYER.dodge.iframeEnd) continue;

        const to = targetBody.mesh.position;
        const dx = to.x - from.x, dz = to.z - from.z;
        const dist = Math.hypot(dx, dz);
        if (dist - targetFighter.radius > hit.range) continue;
        if (dist > MIN_ANGLE_CHECK_DIST && (dx * hit.dirX + dz * hit.dirZ) / dist < hit.minDot) continue;

        hit.alreadyHit.add(target);
        targetHealth.hp = Math.max(0, targetHealth.hp - hit.damage);
        targetHealth.flash = HIT_FLASH_TIME;

        if (player) {
          // Player got hit: knocked back (along the attack, pushed away from the attacker), brief loss of control.
          targetHealth.invuln = PLAYER.hurtInvuln;
          targetHealth.hitstun = HITSTUN_TIME + hit.knockback * HITSTUN_PER_KNOCKBACK;
          let knockX = hit.dirX * 0.5 + (dist > 0.01 ? dx / dist : hit.dirX) * 0.5;
          let knockZ = hit.dirZ * 0.5 + (dist > 0.01 ? dz / dist : hit.dirZ) * 0.5;
          const knockLen = Math.hypot(knockX, knockZ) || 1;
          knockX /= knockLen; knockZ /= knockLen;
          knock.set(knockX * hit.knockback, hit.lift, knockZ * hit.knockback);
          targetBody.aggregate.body.setLinearVelocity(knock);
          ctx.shake = Math.max(ctx.shake, 0.15 + hit.damage * 0.008);
        } else {
          const enemy = world.get(target, Enemy);
          if (enemy) enemy.poise -= hit.poiseDamage;
          ctx.shake = Math.max(ctx.shake, 0.06);
        }
      }
    }
  };
}
