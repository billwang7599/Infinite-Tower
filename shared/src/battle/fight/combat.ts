/**
 * Hits, checked after each physics step with plain math, not physics triggers. A player may parry a hit (the
 * reverse swing, in time) or block it; a swordsman on guard parries a player's swing and blocks a stab.
 */
import type { Entity, System, World } from "../../core/ecs.js";
import { clamp, type Vec2, type Vec3 } from "../../core/math.js";
import { FIXED_DT } from "../../core/time.js";
import {
  ActiveHit, Body, Enemy, Fighter, Health, Player, Stamina, Statuses, SwordAttack, type ActiveHitData,
  type PlayerData,
} from "../components.js";
import { PLAYER } from "../player.js";
import { FighterStats, physicalDamage } from "../stats.js";
import { isSwing, liveStep, PARRY, reverseOf, type AttackKind, type HitShape } from "../sword.js";
import type { FightEvent } from "./context.js";
import { damageDealtFactor, hurt, siphon } from "./spells/statuses.js";

export const HIT_FLASH_TIME = 0.12;
/** Closer than this, a target counts as in front whatever the angle (centers nearly on top of each other). */
const MIN_ANGLE_CHECK_DIST = 0.3;
/** A hit player loses control for this long, plus a little more the harder they're knocked back. */
const HITSTUN_TIME = 0.25;
const HITSTUN_PER_KNOCKBACK = 0.02;

/** An arc unless it says otherwise; knockback, lift and poise damage default to 0. */
export interface HitSpec extends Partial<Pick<HitShape, "shape" | "width">> {
  range: number;
  minDot: number;
  /** At strength 10. */
  damage: number;
  knockback?: number;
  lift?: number;
  poiseDamage?: number;
  /** A sword's swing or stab; a body blow (the default) can't be parried. */
  attack?: AttackKind | null;
}

/** Make an attack's hitbox live on `e`, aimed along (dirX, dirZ), scaled by `e`'s strength. */
export function addHit(world: World, e: Entity, dirX: number, dirZ: number, attack: HitSpec): void {
  world.add(e, ActiveHit, {
    shape: attack.shape ?? "arc", dirX, dirZ, range: attack.range, minDot: attack.minDot, width: attack.width ?? 0,
    damage: physicalDamage(attack.damage, world.require(e, FighterStats)),
    knockback: attack.knockback ?? 0, lift: attack.lift ?? 0, poiseDamage: attack.poiseDamage ?? 0,
    attack: attack.attack ?? null, alreadyHit: new Set(),
  });
}

/** The chain is broken (a gap, a block, a dodge, a hit taken, being parried): its momentum is gone. */
export function endCombo(player: PlayerData): void {
  player.combo = null;
  player.comboTime = 0;
  player.momentum = 0;
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

/** Sets `vel` moving `body` away from `from` at `speed` (m/s), plus `lift`. */
export function knock(body: Vec3, from: Vec3, vel: Vec3, speed: number, lift = 0, along?: Vec2): void {
  const dx = body.x - from.x, dz = body.z - from.z, dist = Math.hypot(dx, dz);
  let x = dist > 0.01 ? dx / dist : (along?.x ?? 0), z = dist > 0.01 ? dz / dist : (along?.z ?? 1);
  if (along) { x = x * 0.5 + along.x * 0.5; z = z * 0.5 + along.z * 0.5; }
  const len = Math.hypot(x, z) || 1;
  Object.assign(vel, { x: (x / len) * speed, y: lift, z: (z / len) * speed });
}

type Resolved = "landed" | "blocked" | "parried";

/** Ticks the hit timers, then resolves every live hitbox. What each hit did is reported in `events`. */
export function combatSystem(events: FightEvent[]): System {
  return (world, dt) => {
    for (const [, h] of world.query(Health)) {
      h.invuln = Math.max(0, h.invuln - dt);
      h.hitstun = Math.max(0, h.hitstun - dt);
      h.flash = Math.max(0, h.flash - dt);
    }

    for (const [attacker, hit, attackerBody, attackerFighter] of world.query(ActiveHit, Body, Fighter)) {
      for (const [target, targetHealth, targetBody, targetFighter] of world.query(Health, Body, Fighter)) {
        if (targetFighter.team === attackerFighter.team || targetHealth.hp <= 0) continue;
        if (hit.alreadyHit.has(target)) continue;
        const player = world.get(target, Player);
        if (player?.action === "dodge"
          && player.actionTime >= PLAYER.dodge.iframeStart && player.actionTime < PLAYER.dodge.iframeEnd) continue;
        if (!inShape(hit, attackerBody.pos, targetBody.pos, targetFighter.radius)) continue;
        if (targetHealth.invuln > 0 && !(player && parries(world, attacker, hit, target, player))) continue;

        hit.alreadyHit.add(target);
        const resolved = player
          ? hitPlayer(world, events, attacker, hit, target, player)
          : hitEnemy(world, events, attacker, hit, target);
        if (resolved === "parried") break; // the attacker's hitbox is gone
      }
    }
  };
}

function parries(world: World, attacker: Entity, hit: ActiveHitData, target: Entity, player: PlayerData): boolean {
  const swing = hit.attack !== null && isSwing(hit.attack) ? hit.attack : null;
  if (!swing || player.action !== "attack" || player.attack !== reverseOf(swing)) return false;
  const at = world.require(target, Body).pos, from = world.require(attacker, Body).pos;
  if (!faces(at, player.actionDir, from, PARRY.minDot)) return false;
  // Steps since the player's blade went live (the controller ran this step: its clock is one step on).
  const sinceLive = Math.round(player.actionTime / FIXED_DT) - 1 - liveStep(player.startup);
  return sinceLive >= 0 && sinceLive <= Math.round(PARRY.window / FIXED_DT);
}

/** A hit reaching a player: parried by the reverse swing in time, blocked, or landing. */
function hitPlayer(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity, player: PlayerData,
): Resolved {
  const from = world.require(attacker, Body).pos, body = world.require(target, Body);
  const health = world.require(target, Health), stamina = world.require(target, Stamina);

  if (parries(world, attacker, hit, target, player)) {
    parryEnemy(world, attacker, body.pos);
    events.push({ type: "parry", by: target, target: attacker });
    return "parried";
  }

  const dir = { x: hit.dirX, z: hit.dirZ };
  const damage = hit.damage * damageDealtFactor(world, attacker);
  if (player.action === "block" && faces(body.pos, player.actionDir, from, PLAYER.block.minDot)) {
    const block = PLAYER.block, cost = damage * block.staminaPerDamage;
    const guardBreak = stamina.value < cost;
    stamina.value = Math.max(0, stamina.value - cost);
    stamina.regenDelay = PLAYER.staminaRegenDelay;
    const chip = hit.attack !== null && isSwing(hit.attack) ? damage * block.chipFraction : 0;
    hurt(world, target, chip);
    knock(body.pos, from, body.vel, hit.knockback * block.pushbackFactor, 0, dir);
    if (guardBreak) {
      player.action = "stagger";
      health.hitstun = block.guardBreakTime;
    }
    events.push({ type: "block", target, guardBreak });
    return "blocked";
  }

  // It lands. A sword (swing or stab) only hurts, as the player's does; anything else also knocks back and stuns.
  const dealt = hurt(world, target, damage);
  health.flash = HIT_FLASH_TIME;
  health.invuln = PLAYER.hurtInvuln;
  if (hit.attack === null) {
    health.hitstun = HITSTUN_TIME + hit.knockback * HITSTUN_PER_KNOCKBACK;
    const warded = (world.get(target, Statuses)?.left.warded ?? 0) > 0;
    if (!warded) knock(body.pos, from, body.vel, hit.knockback, hit.lift, dir);
  }
  if (health.hitstun > 0 && ["cast", "chant", "write", "beam"].includes(player.action)) {
    breakOff(player);
  }
  endCombo(player);
  siphon(world, attacker, dealt);
  events.push({ type: "hit", by: attacker, target, team: "player", damage: dealt, sword: hit.attack !== null });
  return "landed";
}

export function breakOff(player: PlayerData): void {
  if (player.action === "chant" || player.action === "write") player.chantBroken = true;
  player.action = "none";
  player.casting = null;
  player.writing = null;
}

/** The enemy `e`'s swing was parried by a player at `by`: stunned, knocked back, its chain cut short. */
function parryEnemy(world: World, e: Entity, by: Vec3): void {
  const enemy = world.require(e, Enemy), body = world.require(e, Body);
  Object.assign(enemy, { state: "parried", stateTime: 0, duration: PARRY.stunTime });
  world.remove(e, ActiveHit);
  // Sliding to a stop at the brain's "parried" slowdown, it ends up `knockbackDist` away.
  knock(body.pos, by, body.vel, Math.sqrt(2 * PARRY.slideDecel * PARRY.knockbackDist));
  const sword = world.get(e, SwordAttack);
  if (sword) sword.cooldown = Math.max(sword.cooldown, PARRY.stunTime + sword.def.cooldown);
}

/** A hit reaching an enemy: a swordsman on guard parries a swing (blocks a stab); anything else lands. */
function hitEnemy(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): Resolved {
  const enemy = world.require(target, Enemy), health = world.require(target, Health);
  const at = world.require(target, Body).pos, from = world.require(attacker, Body);
  const sword = world.get(target, SwordAttack);
  const onGuard = sword !== undefined && enemy.state === "approach" && enemy.stateTime >= sword.def.parryReaction
    && faces(at, { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) }, from.pos, PARRY.minDot);
  if (onGuard && hit.attack !== null) {
    if (!isSwing(hit.attack)) {
      events.push({ type: "block", target, guardBreak: false });
      return "blocked";
    }
    const player = world.get(attacker, Player);
    if (sword.parryCooldown <= 0 && player) {
      sword.parryCooldown = sword.def.parryCooldown;
      player.action = "stagger";
      world.require(attacker, Health).hitstun = PARRY.playerStaggerTime;
      world.remove(attacker, ActiveHit);
      knock(from.pos, at, from.vel, PARRY.playerKnockbackSpeed);
      endCombo(player);
      events.push({ type: "parry", by: target, target: attacker });
      return "parried";
    }
  }

  // Parried, it takes more damage, but its poise is spared: a parry's stun doesn't run on into a stagger.
  const parried = enemy.state === "parried";
  const bonus = parried ? PARRY.bonusDamage : 1;
  const damage = hurt(world, target, hit.damage * bonus * damageDealtFactor(world, attacker));
  health.flash = HIT_FLASH_TIME;
  if (!parried) enemy.poise -= hit.poiseDamage;
  siphon(world, attacker, damage);
  events.push({ type: "hit", by: attacker, target, team: "enemy", damage, sword: hit.attack !== null });
  return "landed";
}
