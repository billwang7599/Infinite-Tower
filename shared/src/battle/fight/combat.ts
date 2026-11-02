/**
 * Hits, checked after each physics step with plain math, not physics triggers. A hit may be blocked first
 * (weapons/defend.ts); whatever isn't stopped lands.
 */
import type { Entity, System, World } from "../../core/ecs.js";
import type { Vec2, Vec3 } from "../../core/math.js";
import { STRIKES, type Strike, type Way } from "../../weapons/hybrid.js";
import type { AttackKind, HitShape } from "../../weapons/weapons.js";
import {
  ActiveHit, Body, Enemy, Fighter, Health, Player, Skilled, Statuses, WeaponAttack, Wielder,
  type ActiveHitData, type EnemyData, type HealthData, type PlayerData, type SkilledData, type StaminaData,
} from "../components.js";
import { PLAYER } from "../player.js";
import { FighterStats, HP_REGEN_PAUSE_TIME, stunTime } from "../stats.js";
import { applyStatus } from "../statuses.js";
import { EMBERS } from "../../soul/inscriptions.js";
import type { FightEvent } from "./context.js";
import { enter } from "./behaviors/common.js";
import { interrupt } from "./skills/skilled.js";
import { hurt, lifesteal, modsOf } from "./statuses.js";
import { defend } from "./weapons/defend.js";
import { parries } from "./weapons/parry.js";
import { endChain, endSwing } from "./weapons/swing.js";

export const HIT_FLASH_TIME = 0.12;
/** Closer than this, a target counts as in front whatever the angle (centers nearly on top of each other). */
const MIN_ANGLE_CHECK_DIST = 0.3;
/** A hit player loses control for this long, plus a little more the harder they're knocked back. */
const HITSTUN_TIME = 0.25;
const HITSTUN_PER_KNOCKBACK = 0.02;

export interface HitSpec extends HitShape {
  damage: number;
  knockback?: number;
  lift?: number;
  poiseDamage?: number;
  attack?: AttackKind | null;
  way?: Way | null;
}

export function addHit(world: World, e: Entity, dirX: number, dirZ: number, attack: HitSpec): void {
  world.add(e, ActiveHit, {
    dirX, dirZ, range: attack.range, minDot: attack.minDot, damage: attack.damage, knockback: attack.knockback ?? 0,
    lift: attack.lift ?? 0, poiseDamage: attack.poiseDamage ?? 0, attack: attack.attack ?? null,
    way: attack.way ?? null, alreadyHit: new Set(),
  });
}

function inShape(hit: ActiveHitData, from: Vec3, to: Vec3, radius: number): boolean {
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz);
  if (dist - radius > hit.range) return false;
  return dist <= MIN_ANGLE_CHECK_DIST || (dx * hit.dirX + dz * hit.dirZ) / dist >= hit.minDot;
}

/** Whether something at `from`, looking along `dir`, faces `to` within `minDot` (a cosine). */
export function faces(from: Vec3, dir: Vec2, to: Vec3, minDot: number): boolean {
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
        if (targetFighter.side === attackerFighter.side || targetHealth.hp <= targetHealth.floor) continue;
        if (hit.alreadyHit.has(target)) continue;
        const player = world.get(target, Player);
        if (player?.action === "dodge"
          && player.actionTime >= PLAYER.dodge.iframeStart && player.actionTime < PLAYER.dodge.iframeEnd) continue;
        if (!inShape(hit, attackerBody.pos, targetBody.pos, targetFighter.radius)) continue;
        // Before hurt invulnerability: a blade meeting a blade isn't a hit.
        if (parries(world, events, attacker, hit, target)) break;
        if (targetHealth.invuln > 0) continue;

        hit.alreadyHit.add(target);
        if (defend(world, events, attacker, hit, target)) {
          if (!world.has(attacker, ActiveHit)) break;
          continue;
        }
        if (player) hitPlayer(world, events, attacker, hit, target, player);
        else hitEnemy(world, events, attacker, hit, target);
      }
    }
  };
}

export function spend(stamina: StaminaData, cost: number): void {
  stamina.value = Math.max(0, stamina.value - cost);
  stamina.regenDelay = PLAYER.staminaRegenDelay;
}

const hpShortOf = (world: World, e: Entity, stamina: StaminaData, cost: number): number =>
  Math.max(0, cost - stamina.value) * modsOf(world, e).hpPerStaminaShort;

/** An attack or a dodge: on empty, only if what's short can be paid in HP (Last Breath) without the last of it. */
export function canPay(world: World, e: Entity, stamina: StaminaData, cost: number): boolean {
  if (stamina.value > 0) return true;
  const short = hpShortOf(world, e, stamina, cost);
  return short > 0 && world.require(e, Health).hp > short;
}

export function pay(world: World, e: Entity, stamina: StaminaData, cost: number): void {
  const short = hpShortOf(world, e, stamina, cost);
  spend(stamina, cost);
  if (short <= 0) return;
  const health = world.require(e, Health);
  health.hp = Math.max(Math.min(health.hp, 1), health.hp - short);
  health.regenDelay = HP_REGEN_PAUSE_TIME;
}

function burnOnHit(world: World, attacker: Entity, target: Entity, hit: ActiveHitData): void {
  const perSec = modsOf(world, attacker).weaponBurnPerSec, s = world.get(target, Statuses);
  if (hit.attack !== null && perSec > 0 && s) applyStatus(s.on, "burning", EMBERS.burnTime, perSec);
}

export function stagger(world: World, e: Entity, time: number): void {
  endSwing(world, e);
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (player) {
    breakOff(player, world.require(e, Skilled));
    player.action = "stagger";
    world.require(e, Health).hitstun = time;
  } else if (enemy) {
    enter(world, e, enemy, "staggered", time);
    const attack = world.get(e, WeaponAttack);
    if (attack) {
      attack.cooldown = Math.max(attack.cooldown, time);
      attack.riposte = false;
    }
  }
}

function hitPlayer(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity, player: PlayerData,
): void {
  const from = world.require(attacker, Body).pos, body = world.require(target, Body);
  const health = world.require(target, Health);
  const dealt = hurt(world, target, hit.damage * modsOf(world, attacker).damageDealtFactor, "physical");
  health.flash = HIT_FLASH_TIME;
  health.invuln = PLAYER.hurtInvuln;
  if (hit.attack === null) {
    const stun = HITSTUN_TIME + hit.knockback * HITSTUN_PER_KNOCKBACK;
    const mods = modsOf(world, target);
    health.hitstun = stunTime(stun, world.require(target, FighterStats)) * mods.stunTimeFactor;
    if (mods.knockbackFactor > 0) {
      knock(body.pos, from, body.vel, hit.knockback * mods.knockbackFactor, hit.lift, { x: hit.dirX, z: hit.dirZ });
    }
  }
  if (health.hitstun > 0 && ["cast", "chant", "write", "beam", "bag", "use"].includes(player.action)) {
    breakOff(player, world.require(target, Skilled));
  }
  endChain(world.require(target, Wielder));
  lifesteal(world, attacker, dealt, hit.attack !== null);
  burnOnHit(world, attacker, target, hit);
  events.push({ type: "hit", by: attacker, target, team: "player", damage: dealt, weapon: hit.attack !== null });
}

function strikeDummy(enemy: EnemyData, health: HealthData, strike: Strike): void {
  if (!enemy.struck.includes(strike)) enemy.struck = [...enemy.struck, strike];
  if (STRIKES.every((s) => enemy.struck.includes(s))) health.hp = 0;
}

export function breakOff(player: PlayerData, skilled: SkilledData): void {
  if (["chant", "write", "bag", "use"].includes(player.action)) player.brokenOff = true;
  player.action = "none";
  interrupt(skilled);
  player.writing = null;
  player.using = null;
}

function hitEnemy(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): void {
  const enemy = world.require(target, Enemy), health = world.require(target, Health);
  if (enemy.def.dummy && hit.attack !== null) strikeDummy(enemy, health, hit.way === "stab" ? "stab" : hit.attack);
  const damage = hurt(world, target, hit.damage * modsOf(world, attacker).damageDealtFactor, "physical");
  health.flash = HIT_FLASH_TIME;
  enemy.poise -= hit.poiseDamage;
  lifesteal(world, attacker, damage, hit.attack !== null);
  burnOnHit(world, attacker, target, hit);
  events.push({ type: "hit", by: attacker, target, team: "enemy", damage, weapon: hit.attack !== null });
}
