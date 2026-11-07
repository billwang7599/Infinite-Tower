import type { Entity, World } from "../../../core/ecs.js";
import type { Vec2, Vec3 } from "../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../core/time.js";
import { guardRaiseTime, GUARDS, HYBRID, type GuardKind } from "../../../weapons/hybrid.js";
import { guardOf } from "../../../weapons/kinds.js";
import { Body, Enemy, Player, Stamina, WeaponAttack, Wielder, type ActiveHitData } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { faces, knock, knockbackOf, spend, stagger } from "../combat.js";
import type { FightEvent } from "../context.js";
import { modsOf } from "../../statuses.js";
import { hurt } from "../health.js";
import { endChain, endSwing } from "./swing.js";

export function facingOf(world: World, e: Entity): Vec2 {
  const player = world.get(e, Player);
  if (player) return player.actionDir;
  const yaw = world.require(e, Enemy).yaw;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

function guardUp(world: World, e: Entity, raisingTime: number): boolean {
  const guard = guardOf(world.require(e, Wielder).hands)?.guard;
  if (!guard) return false;
  return toSteps(raisingTime) >= toSteps(guardRaiseTime(guard, world.require(e, FighterStats).strength));
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
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity, shot: Shot | null = null,
): boolean {
  const from = shot?.from ?? world.require(attacker, Body).pos, at = world.require(target, Body).pos;
  const kind = guardOf(world.get(target, Wielder)?.hands ?? { rightHand: null, leftHand: null })?.kind;
  if (!kind || !faces(at, facingOf(world, target), from, GUARDS[kind].minDot)) return false;
  if (hit.attack !== null && blocksPerfectly(world, target)) {
    blockedPerfectly(world, events, attacker, target, shot);
    return true;
  }
  if (!blocking(world, target)) return false;
  blocked(world, events, attacker, hit, target, shot, GUARDS[kind]);
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
    stagger(world, attacker, HYBRID.block.perfectRecoilTime);
  }
  events.push({ type: "block", by: attacker, target, perfect: true, ...(shot && { at: shot.at }) });
}

function blocked(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity, shot: Shot | null,
  guard: (typeof GUARDS)[GuardKind],
): void {
  const block = HYBRID.block, damage = hit.damage * modsOf(world, attacker).damageDealtFactor;
  const player = world.has(target, Player);
  let broken: boolean;
  if (player) {
    const stamina = world.require(target, Stamina);
    const cost = damage * (hit.attack === "heavy" ? block.heavyStaminaFactor : 1) * guard.staminaFactor;
    broken = stamina.value <= cost;
    spend(stamina, cost);
  } else {
    const enemy = world.require(target, Enemy);
    enemy.poise -= hit.poiseDamage;
    // The brain staggers it on its next step, as for a hit.
    broken = enemy.poise <= 0;
  }
  // A weapon only hurts a player, so it pushes back only an enemy's guard.
  const speed = hit.attack === null ? hit.knockback : player ? 0 : knockbackOf(world, target, hit.knockback);
  if (speed > 0) {
    const body = world.require(target, Body), from = world.require(attacker, Body).pos;
    knock(body.pos, from, body.vel, speed * block.pushbackFactor * guard.pushFactor, 0, { x: hit.dirX, z: hit.dirZ });
  }
  if (hit.attack !== null) {
    hurt(world, target, damage * guard.chipFraction, "physical");
    if (!shot) endSwing(world, attacker);
  }
  if (broken && player) stagger(world, target, block.brokenTime);
  events.push({ type: "block", by: attacker, target, broken, ...(shot && { at: shot.at }) });
}
