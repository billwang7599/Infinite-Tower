/**
 * Hits, checked after each physics step with plain math, not physics triggers. A weapon hit may be parried or blocked
 * first (weapons/defend.ts); whatever isn't stopped lands.
 */
import type { Entity, System, World } from "../../core/ecs.js";
import type { Vec2, Vec3 } from "../../core/math.js";
import type { Way } from "../../weapons/hybrid.js";
import type { AttackKind, HitShape } from "../../weapons/weapons.js";
import {
  ActiveHit, Body, Enemy, Fighter, Health, Player, Skilled, Statuses, WeaponAttack, Wielder,
  type ActiveHitData, type PlayerData, type SkilledData,
} from "../components.js";
import { PLAYER } from "../player.js";
import { FighterStats, stunTime } from "../stats.js";
import type { FightEvent } from "./context.js";
import { enter } from "./behaviors/common.js";
import { interrupt } from "./skills/skilled.js";
import { damageDealtFactor, hurt, siphon } from "./skills/statuses.js";
import { defend } from "./weapons/defend.js";
import { endChain, endSwing } from "./weapons/swing.js";

export const HIT_FLASH_TIME = 0.12;
/** Closer than this, a target counts as in front whatever the angle (centers nearly on top of each other). */
const MIN_ANGLE_CHECK_DIST = 0.3;
/** A hit player loses control for this long, plus a little more the harder they're knocked back. */
const HITSTUN_TIME = 0.25;
const HITSTUN_PER_KNOCKBACK = 0.02;

export type Defended = "parried" | "blocked" | null;

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
        if (targetFighter.side === attackerFighter.side || targetHealth.hp <= 0) continue;
        if (hit.alreadyHit.has(target) || targetHealth.invuln > 0) continue;
        const player = world.get(target, Player);
        if (player?.action === "dodge"
          && player.actionTime >= PLAYER.dodge.iframeStart && player.actionTime < PLAYER.dodge.iframeEnd) continue;
        if (!inShape(hit, attackerBody.pos, targetBody.pos, targetFighter.radius)) continue;

        hit.alreadyHit.add(target);
        const defended = defend(world, events, attacker, hit, target);
        if (defended === "parried") break;
        if (defended === "blocked") {
          if (!world.has(attacker, ActiveHit)) break;
          continue;
        }
        if (player) hitPlayer(world, events, attacker, hit, target, player);
        else hitEnemy(world, events, attacker, hit, target);
      }
    }
  };
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
  const dealt = hurt(world, target, hit.damage * damageDealtFactor(world, attacker), "physical");
  health.flash = HIT_FLASH_TIME;
  health.invuln = PLAYER.hurtInvuln;
  if (hit.attack === null) {
    const stun = HITSTUN_TIME + hit.knockback * HITSTUN_PER_KNOCKBACK;
    health.hitstun = stunTime(stun, world.require(target, FighterStats));
    const warded = (world.get(target, Statuses)?.left.warded ?? 0) > 0;
    if (!warded) knock(body.pos, from, body.vel, hit.knockback, hit.lift, { x: hit.dirX, z: hit.dirZ });
  }
  if (health.hitstun > 0 && ["cast", "chant", "write", "beam", "bag", "use"].includes(player.action)) {
    breakOff(player, world.require(target, Skilled));
  }
  endChain(world.require(target, Wielder));
  siphon(world, attacker, dealt);
  events.push({ type: "hit", by: attacker, target, team: "player", damage: dealt, weapon: hit.attack !== null });
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
  const damage = hurt(world, target, hit.damage * damageDealtFactor(world, attacker), "physical");
  health.flash = HIT_FLASH_TIME;
  enemy.poise -= hit.poiseDamage;
  siphon(world, attacker, damage);
  events.push({ type: "hit", by: attacker, target, team: "enemy", damage, weapon: hit.attack !== null });
}
