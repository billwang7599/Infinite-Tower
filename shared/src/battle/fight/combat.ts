/**
 * Hits, checked after each physics step with plain math, not physics triggers. A player may parry a hit (the
 * reverse swing or a neighbour of it, or a stab with a stab, in time) or block it; a swordsman on guard parries a
 * swing from near the side it guards and blocks a stab.
 */
import type { Entity, System, World } from "../../core/ecs.js";
import { clamp, type Vec2, type Vec3 } from "../../core/math.js";
import { FIXED_DT } from "../../core/time.js";
import {
  guardShare, isSwing, mirrorOf, PARRY, parryShare, planSwing, restingBlade, reverseOf, swingSide, weaponIn,
  type AttackKind, type HitShape,
} from "../../weapons/weapons.js";
import {
  ActiveHit, Body, Enemy, Fighter, Health, Player, Skilled, Stamina, Statuses, WeaponAttack, Wielder,
  type ActiveHitData, type PlayerData, type SkilledData,
} from "../components.js";
import { PLAYER } from "../player.js";
import { FighterStats } from "../stats.js";
import type { FightEvent } from "./context.js";
import { turnGuard } from "./behaviors/weapon.js";
import { interrupt } from "./skills/skilled.js";
import { damageDealtFactor, hurt, siphon } from "./skills/statuses.js";
import { endSwing, restBlade, stopBlade } from "./weapons/swing.js";

export const HIT_FLASH_TIME = 0.12;
/** Closer than this, a target counts as in front whatever the angle (centers nearly on top of each other). */
const MIN_ANGLE_CHECK_DIST = 0.3;
/** A hit player loses control for this long, plus a little more the harder they're knocked back. */
const HITSTUN_TIME = 0.25;
const HITSTUN_PER_KNOCKBACK = 0.02;

/** An arc unless it says otherwise; knockback, lift, poise damage and momentum default to 0. */
export interface HitSpec extends Partial<Pick<HitShape, "shape" | "width">> {
  range: number;
  minDot: number;
  damage: number;
  knockback?: number;
  lift?: number;
  poiseDamage?: number;
  momentum?: number;
  /** A weapon's swing or stab; a body blow (the default) can't be parried. */
  attack?: AttackKind | null;
}

export function addHit(world: World, e: Entity, dirX: number, dirZ: number, attack: HitSpec): void {
  world.add(e, ActiveHit, {
    shape: attack.shape ?? "arc", dirX, dirZ, range: attack.range, minDot: attack.minDot, width: attack.width ?? 0,
    damage: attack.damage, knockback: attack.knockback ?? 0, lift: attack.lift ?? 0,
    poiseDamage: attack.poiseDamage ?? 0, momentum: attack.momentum ?? 0, attack: attack.attack ?? null,
    alreadyHit: new Set(),
  });
}

const stunFor = (time: number, parrierMomentum: number, hit: ActiveHitData): number =>
  time * clamp(parrierMomentum / hit.momentum, PARRY.minStunScale, PARRY.maxStunScale);

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
        if (targetFighter.side === attackerFighter.side || targetHealth.hp <= 0) continue;
        if (hit.alreadyHit.has(target)) continue;
        const player = world.get(target, Player);
        if (player?.action === "dodge"
          && player.actionTime >= PLAYER.dodge.iframeStart && player.actionTime < PLAYER.dodge.iframeEnd) continue;
        if (!inShape(hit, attackerBody.pos, targetBody.pos, targetFighter.radius)) continue;
        if (targetHealth.invuln > 0 && !(player && parryShareFor(world, attacker, hit, target) > 0)) continue;

        hit.alreadyHit.add(target);
        const resolved = player
          ? hitPlayer(world, events, attacker, hit, target, player)
          : hitEnemy(world, events, attacker, hit, target);
        if (resolved !== "landed" && !world.has(attacker, ActiveHit)) break; // a stopped blade's hitbox is gone
      }
    }
  };
}

function parryShareFor(world: World, attacker: Entity, hit: ActiveHitData, target: Entity): number {
  const own = world.get(target, Wielder)?.swing;
  if (!own || hit.attack === null) return 0;
  // A player names their swing as they see it; an enemy's is named as the player facing it sees it.
  const seen = world.has(attacker, Player) ? mirrorOf(hit.attack) : hit.attack;
  const share = parryShare(own.attack, seen);
  const at = world.require(target, Body).pos, from = world.require(attacker, Body).pos;
  if (share === 0 || !faces(at, own.dir, from, PARRY.minDot)) return 0;
  // The weapon system ran this step: the swing's clock is one step on.
  const sinceLive = own.step - 1 - own.liveAt;
  return sinceLive >= 0 && sinceLive <= Math.round(PARRY.window / FIXED_DT) ? share : 0;
}

/** A hit reaching a player: parried in time, blocked, or landing. */
function hitPlayer(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity, player: PlayerData,
): Resolved {
  const from = world.require(attacker, Body).pos, body = world.require(target, Body);
  const health = world.require(target, Health), stamina = world.require(target, Stamina);

  const share = parryShareFor(world, attacker, hit, target);
  if (share > 0) {
    const momentum = world.require(target, Wielder).swing!.momentum;
    if (world.has(attacker, Player)) staggerPlayer(world, attacker, body.pos, hit, momentum, share);
    else parryEnemy(world, attacker, body.pos, stunFor(PARRY.stunTime * share, momentum, hit), share);
    events.push({ type: "parry", by: target, target: attacker });
    return "parried";
  }

  const dir = { x: hit.dirX, z: hit.dirZ };
  const damage = hit.damage * damageDealtFactor(world, attacker);
  if (player.action === "block" && faces(body.pos, player.actionDir, from, PLAYER.block.minDot)) {
    const block = PLAYER.block;
    const cost = hit.attack === null ? damage * block.staminaPerDamage : hit.momentum * block.staminaPerMomentum;
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
    if (hit.attack !== null) stopBlade(world, attacker);
    events.push({ type: "block", by: attacker, target, guardBreak });
    return "blocked";
  }

  // It lands. A weapon (swing or stab) only hurts, as the player's does; anything else also knocks back and stuns.
  const dealt = hurt(world, target, damage);
  health.flash = HIT_FLASH_TIME;
  health.invuln = PLAYER.hurtInvuln;
  if (hit.attack === null) {
    health.hitstun = HITSTUN_TIME + hit.knockback * HITSTUN_PER_KNOCKBACK;
    const warded = (world.get(target, Statuses)?.left.warded ?? 0) > 0;
    if (!warded) knock(body.pos, from, body.vel, hit.knockback, hit.lift, dir);
  }
  if (health.hitstun > 0 && ["cast", "chant", "write", "beam", "bag", "use"].includes(player.action)) {
    breakOff(player, world.require(target, Skilled));
  }
  restBlade(world.require(target, Wielder));
  siphon(world, attacker, dealt);
  events.push({ type: "hit", by: attacker, target, team: "player", damage: dealt, weapon: hit.attack !== null });
  return "landed";
}

export function breakOff(player: PlayerData, skilled: SkilledData): void {
  if (["chant", "write", "bag", "use"].includes(player.action)) player.brokenOff = true;
  player.action = "none";
  interrupt(skilled);
  player.writing = null;
  player.using = null;
}

function parryEnemy(world: World, e: Entity, by: Vec3, stunTime: number, share: number): void {
  const enemy = world.require(e, Enemy), body = world.require(e, Body);
  Object.assign(enemy, { state: "parried", stateTime: 0, duration: stunTime });
  stopBlade(world, e);
  endSwing(world, e);
  // Sliding to a stop at the brain's "parried" slowdown, it ends up `knockbackDist` × `share` away.
  knock(body.pos, by, body.vel, Math.sqrt(2 * PARRY.slideDecel * PARRY.knockbackDist * share));
  const attack = world.get(e, WeaponAttack);
  if (attack) attack.cooldown = Math.max(attack.cooldown, stunTime + attack.def.cooldown);
}

function staggerPlayer(
  world: World, e: Entity, by: Vec3, hit: ActiveHitData, parrierMomentum: number, share: number,
): void {
  world.require(e, Player).action = "stagger";
  world.require(e, Health).hitstun = stunFor(PARRY.playerStaggerTime * share, parrierMomentum, hit);
  stopBlade(world, e);
  endSwing(world, e);
  const body = world.require(e, Body);
  knock(body.pos, by, body.vel, PARRY.playerKnockbackSpeed * share);
}

function hitEnemy(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): Resolved {
  const enemy = world.require(target, Enemy), health = world.require(target, Health);
  const at = world.require(target, Body).pos, from = world.require(attacker, Body);
  const guard = world.get(target, WeaponAttack);
  const onGuard = guard !== undefined && enemy.state === "approach" && enemy.stateTime >= guard.def.parryReaction
    && faces(at, { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) }, from.pos, PARRY.minDot);
  if (onGuard && hit.attack !== null) {
    if (!isSwing(hit.attack)) {
      stopBlade(world, attacker);
      events.push({ type: "block", by: attacker, target, guardBreak: false });
      return "blocked";
    }
    const player = world.get(attacker, Player);
    const covered = guard.guardMoveTime > 0 ? guard.guardFrom : guard.guardSide;
    const share = guardShare(covered, hit.attack);
    if (share > 0 && guard.parryCooldown <= 0 && player) {
      guard.parryCooldown = guard.def.parryCooldown;
      // On guard, its blade isn't swinging: it meets the hit with what an opening swing of its own would carry.
      const weapon = weaponIn(world.require(target, Wielder).hands);
      const strength = world.require(target, FighterStats).strength;
      const guardMomentum = weapon ? planSwing(weapon, strength, restingBlade(), reverseOf(hit.attack)).momentum
        : hit.momentum;
      staggerPlayer(world, attacker, at, hit, guardMomentum, share);
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
  if (guard && hit.attack !== null && isSwing(hit.attack)) turnGuard(enemy, guard, swingSide(hit.attack));
  siphon(world, attacker, damage);
  events.push({ type: "hit", by: attacker, target, team: "enemy", damage, weapon: hit.attack !== null });
  return "landed";
}
