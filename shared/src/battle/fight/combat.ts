/**
 * Hits. An attack's active frames put an ActiveHit (an arc, or a stab's ray) on the attacker, and after each
 * physics step every live one is checked against every fighter of the other team with plain math, not physics
 * triggers: cheap, and the same on the server. What a hit does then: a player may block it (held, facing it);
 * anything else lands.
 */
import type { Entity, System, World } from "../../core/ecs.js";
import { clamp, type Vec2, type Vec3 } from "../../core/math.js";
import {
  ActiveHit, Body, Enemy, Fighter, Health, Player, Stamina, type ActiveHitData, type HealthData, type PlayerData,
} from "../components.js";
import { PLAYER } from "../player.js";
import { FighterStats, physicalDamage } from "../stats.js";
import type { HitShape } from "../sword.js";
import type { FightEvent } from "./context.js";

/** Seconds a fighter flashes after a hit. */
const HIT_FLASH_TIME = 0.12;
/** Closer than this, a target counts as in front whatever the angle (centers nearly on top of each other). */
const MIN_ANGLE_CHECK_DIST = 0.3;
/** A hit player loses control for this long, plus a little more the harder they're knocked back. */
const HITSTUN_TIME = 0.25;
const HITSTUN_PER_KNOCKBACK = 0.02;

/** What a hitbox needs from an attack: an arc unless it says otherwise; knockback, lift, poise damage default to 0. */
export interface HitSpec extends Partial<Pick<HitShape, "shape" | "width">> {
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
    shape: attack.shape ?? "arc", dirX, dirZ, range: attack.range, minDot: attack.minDot, width: attack.width ?? 0,
    damage: physicalDamage(attack.damage, world.require(e, FighterStats)),
    knockback: attack.knockback ?? 0, lift: attack.lift ?? 0, poiseDamage: attack.poiseDamage ?? 0,
    alreadyHit: new Set(),
  });
}

/** The chain is broken (a gap, a block, a dodge, a hit taken): its momentum is gone. */
export function endCombo(player: PlayerData): void {
  player.combo = null;
  player.comboTime = 0;
  player.momentum = 0;
}

/** Runs down a fighter's invulnerability, hitstun and hit flash (seconds). */
export function tickHealthTimers(h: HealthData, dt: number): void {
  h.invuln = Math.max(0, h.invuln - dt);
  h.hitstun = Math.max(0, h.hitstun - dt);
  h.flash = Math.max(0, h.flash - dt);
}

/** Whether a target at `to`, `radius` round, is in `hit`'s shape from `from`. */
function inShape(hit: ActiveHitData, from: Vec3, to: Vec3, radius: number): boolean {
  const dx = to.x - from.x, dz = to.z - from.z;
  if (hit.shape === "ray") {
    const along = clamp(dx * hit.dirX + dz * hit.dirZ, 0, hit.range);
    return Math.hypot(dx - hit.dirX * along, dz - hit.dirZ * along) <= hit.width + radius;
  }
  const dist = Math.hypot(dx, dz);
  if (dist - radius > hit.range) return false;
  return dist <= MIN_ANGLE_CHECK_DIST || (dx * hit.dirX + dz * hit.dirZ) / dist >= hit.minDot;
}

/** Whether something at `from`, looking along `dir`, faces `to` within `minDot` (a cosine). */
function faces(from: Vec3, dir: Vec2, to: Vec3, minDot: number): boolean {
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz);
  return dist <= MIN_ANGLE_CHECK_DIST || (dx * dir.x + dz * dir.z) / dist >= minDot;
}

/** Sets `body` moving away from `from` at `speed` (m/s), plus `lift`. */
function knock(body: Vec3, from: Vec3, vel: Vec3, speed: number, lift = 0, along?: Vec2): void {
  const dx = body.x - from.x, dz = body.z - from.z, dist = Math.hypot(dx, dz);
  let x = dist > 0.01 ? dx / dist : (along?.x ?? 0), z = dist > 0.01 ? dz / dist : (along?.z ?? 1);
  if (along) { x = x * 0.5 + along.x * 0.5; z = z * 0.5 + along.z * 0.5; }
  const len = Math.hypot(x, z) || 1;
  Object.assign(vel, { x: (x / len) * speed, y: lift, z: (z / len) * speed });
}

/** Ticks the hit timers, then resolves every live hitbox. What each hit did is reported in `events`. */
export function combatSystem(events: FightEvent[]): System {
  return (world, dt) => {
    for (const [, h] of world.query(Health)) tickHealthTimers(h, dt);

    for (const [attacker, hit, attackerBody, attackerFighter] of world.query(ActiveHit, Body, Fighter)) {
      for (const [target, targetHealth, targetBody, targetFighter] of world.query(Health, Body, Fighter)) {
        if (targetFighter.team === attackerFighter.team || targetHealth.hp <= 0 || targetHealth.invuln > 0) continue;
        if (hit.alreadyHit.has(target)) continue;
        const player = world.get(target, Player);
        // Dodge i-frames.
        if (player?.action === "dodge"
          && player.actionTime >= PLAYER.dodge.iframeStart && player.actionTime < PLAYER.dodge.iframeEnd) continue;
        if (!inShape(hit, attackerBody.pos, targetBody.pos, targetFighter.radius)) continue;

        hit.alreadyHit.add(target);
        if (player) hitPlayer(world, events, attacker, hit, target, player);
        else hitEnemy(world, events, hit, target);
      }
    }
  };
}

/** A hit reaching a player: blocked, or landing. */
function hitPlayer(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity, player: PlayerData,
): void {
  const from = world.require(attacker, Body).pos, body = world.require(target, Body);
  const health = world.require(target, Health), stamina = world.require(target, Stamina);

  const dir = { x: hit.dirX, z: hit.dirZ };
  if (player.action === "block" && faces(body.pos, player.actionDir, from, PLAYER.block.minDot)) {
    const block = PLAYER.block, cost = hit.damage * block.staminaPerDamage;
    const guardBreak = stamina.value < cost;
    stamina.value = Math.max(0, stamina.value - cost);
    stamina.regenDelay = PLAYER.staminaRegenDelay;
    knock(body.pos, from, body.vel, hit.knockback * block.pushbackFactor, 0, dir);
    if (guardBreak) {
      player.action = "stagger";
      health.hitstun = block.guardBreakTime;
    }
    events.push({ type: "block", target, guardBreak });
    return;
  }

  // It lands: knocked back (along the attack, pushed away from the attacker), a brief loss of control.
  health.hp = Math.max(0, health.hp - hit.damage);
  health.flash = HIT_FLASH_TIME;
  health.invuln = PLAYER.hurtInvuln;
  health.hitstun = HITSTUN_TIME + hit.knockback * HITSTUN_PER_KNOCKBACK;
  knock(body.pos, from, body.vel, hit.knockback, hit.lift, dir);
  endCombo(player);
  events.push({ type: "hit", target, team: "player", damage: hit.damage });
}

/** A hit reaching an enemy: it lands. */
function hitEnemy(world: World, events: FightEvent[], hit: ActiveHitData, target: Entity): void {
  const enemy = world.require(target, Enemy), health = world.require(target, Health);
  health.hp = Math.max(0, health.hp - hit.damage);
  health.flash = HIT_FLASH_TIME;
  enemy.poise -= hit.poiseDamage;
  events.push({ type: "hit", target, team: "enemy", damage: hit.damage });
}
