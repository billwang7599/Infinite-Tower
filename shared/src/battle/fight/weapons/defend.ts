import type { Entity, World } from "../../../core/ecs.js";
import { clamp, type Vec2, type Vec3 } from "../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../core/time.js";
import { blockStaminaShare, guardRaiseTime, GUARDS, HYBRID, type GuardKind } from "../../../weapons/hybrid.js";
import { guardOf } from "../../../weapons/kinds.js";
import { damageTotal, scaleDamage } from "../../../weapons/weapons.js";
import {
  Body, Enemy, Player, Stamina, WeaponAttack, Wielder, type ActiveHitData, type BodyData,
} from "../../components.js";
import { PLAYER } from "../../player.js";
import { faces, knock, knockbackOf, spend, stagger } from "../combat.js";
import type { FightContext, FightEvent } from "../context.js";
import type { ArenaPhysics } from "../physics/arena-physics.js";
import { modsOf } from "../../statuses.js";
import { hurtPhysical } from "../health.js";
import { endChain, endSwing, strengthIn } from "./swing.js";

export function facingOf(world: World, e: Entity): Vec2 {
  const player = world.get(e, Player);
  if (player) return player.actionDir;
  const yaw = world.require(e, Enemy).yaw;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

function guardUp(world: World, e: Entity, raisingTime: number): boolean {
  const guard = guardOf(world.require(e, Wielder).hands)?.guard;
  if (!guard) return false;
  return toSteps(raisingTime) >= toSteps(guardRaiseTime(guard));
}

export function blocking(world: World, e: Entity): boolean {
  const player = world.get(e, Player);
  // The controller has already counted this step into actionTime.
  if (player) return player.action === "block" && guardUp(world, e, player.actionTime - FIXED_DT);
  const enemy = world.get(e, Enemy), attack = world.get(e, WeaponAttack);
  return enemy?.state === "approach" && attack !== undefined
    && guardUp(world, e, enemy.stateTime - attack.def.blockReactTime);
}

function blocksPerfectly(world: World, target: Entity): boolean {
  const player = world.get(target, Player);
  if (player) {
    return (player.action === "block" || player.action === "none") && player.perfectBlockLeft > 0
      && guardUp(world, target, player.sinceBlockPress);
  }
  return (world.get(target, WeaponAttack)?.perfectBlockRead ?? false) && world.get(target, Enemy)?.state === "approach";
}

/** A projectile's hit: where it came from (for the guard's facing) and where it struck. */
export interface Shot { from: Vec3; at: Vec3 }

export function defend(
  ctx: FightContext, attacker: Entity, hit: ActiveHitData, target: Entity, shot: Shot | null = null,
): boolean {
  const { world, events } = ctx;
  const from = shot?.from ?? world.require(attacker, Body).pos, at = world.require(target, Body).pos;
  const kind = guardOf(world.get(target, Wielder)?.hands ?? { rightHand: null, leftHand: null })?.kind;
  if (!kind || !faces(at, facingOf(world, target), from, GUARDS[kind].minDot)) return false;
  if (hit.attack !== null && blocksPerfectly(world, target)) {
    blockedPerfectly(world, events, attacker, target, shot);
    return true;
  }
  if (!blocking(world, target)) return false;
  blocked(ctx, attacker, hit, target, shot, GUARDS[kind]);
  return true;
}

// A shooter far off doesn't recoil from a perfect block.
function blockedPerfectly(
  world: World, events: FightEvent[], attacker: Entity, target: Entity, shot: Shot | null,
): void {
  const player = world.get(target, Player), attack = world.get(target, WeaponAttack);
  if (player) player.perfectBlockLeft = 0;
  if (attack) Object.assign(attack, { perfectBlockRead: false, riposte: true });
  if (!shot) {
    const wielder = world.get(attacker, Wielder), stamina = world.get(attacker, Stamina);
    if (wielder) endChain(wielder);
    if (stamina) spend(stamina, HYBRID.block.perfectDrain);
    stagger(world, attacker, attack ? HYBRID.counter.recoilTime : HYBRID.block.perfectRecoilTime);
  }
  events.push({ type: "block", by: attacker, target, perfect: true, ...(shot && { at: shot.at }) });
}

// Rapier sweeps in f32, so on open ground it comes up a hair short.
const REACH_SLACK_M = 1e-4;

function pinnedShare(world: World, physics: ArenaPhysics, e: Entity, body: BodyData): number {
  const speed = Math.hypot(body.vel.x, body.vel.z);
  if (speed <= 0) return 0;
  const slideM = (speed * speed) / (2 * (world.get(e, Enemy)?.move.accel ?? PLAYER.accel)), k = slideM / speed;
  const got = physics.reach(body.collider, { x: body.vel.x * k, y: 0, z: body.vel.z * k });
  const lostM = slideM - (got.x * body.vel.x + got.z * body.vel.z) / speed;
  return lostM < REACH_SLACK_M ? 0 : clamp(lostM / slideM, 0, 1);
}

function blocked(
  { world, physics, events }: FightContext, attacker: Entity, hit: ActiveHitData, target: Entity, shot: Shot | null,
  guard: (typeof GUARDS)[GuardKind],
): void {
  const block = HYBRID.block, damage = scaleDamage(hit.damage, modsOf(world, attacker).damageDealtFactor);
  const player = world.has(target, Player);
  let broken: boolean;
  if (player) {
    const stamina = world.require(target, Stamina);
    const cost = damageTotal(damage) * (hit.attack === "heavy" ? block.heavyStaminaFactor : 1)
      * blockStaminaShare(guard, strengthIn(world, target));
    broken = stamina.value <= cost;
    spend(stamina, cost);
  } else {
    const enemy = world.require(target, Enemy);
    enemy.poise -= hit.poiseDamage;
    // The brain staggers it on its next step, as for a hit.
    broken = enemy.poise <= 0;
  }
  const speed = knockbackOf(world, target, hit.knockback) * block.pushbackFactor * guard.pushFactor;
  let pinned = 0;
  if (speed > 0) {
    const body = world.require(target, Body), from = world.require(attacker, Body).pos;
    knock(body.pos, from, body.vel, speed, { x: hit.dirX, z: hit.dirZ });
    pinned = pinnedShare(world, physics, target, body);
  }
  if (hit.attack !== null) {
    const chip = guard.chipFraction * (1 + (block.pinnedChipFactor - 1) * pinned);
    hurtPhysical(world, target, scaleDamage(damage, chip));
    if (!shot) endSwing(world, attacker);
  }
  if (broken && player) stagger(world, target, block.brokenTime);
  events.push({ type: "block", by: attacker, target, broken, ...(shot && { at: shot.at }) });
}
