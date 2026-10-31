import type { Entity, World } from "../../../core/ecs.js";
import type { Vec2 } from "../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../core/time.js";
import { guardRaiseTime, HYBRID } from "../../../weapons/hybrid.js";
import { weaponIn } from "../../../weapons/weapons.js";
import { Body, Enemy, Player, Stamina, WeaponAttack, Wielder, type ActiveHitData } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { faces, knock, spend, stagger } from "../combat.js";
import type { FightEvent } from "../context.js";
import { damageDealtFactor, hurt } from "../skills/statuses.js";
import { endChain, endSwing } from "./swing.js";

export function facingOf(world: World, e: Entity): Vec2 {
  const player = world.get(e, Player);
  if (player) return player.actionDir;
  const yaw = world.require(e, Enemy).yaw;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

function guardUp(world: World, e: Entity, raisingTime: number): boolean {
  const weapon = weaponIn(world.require(e, Wielder).hands);
  if (!weapon) return false;
  return toSteps(raisingTime) >= toSteps(guardRaiseTime(weapon, world.require(e, FighterStats).strength));
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

export function defend(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity,
): boolean {
  const from = world.require(attacker, Body).pos, at = world.require(target, Body).pos;
  if (!faces(at, facingOf(world, target), from, HYBRID.block.minDot)) return false;
  if (hit.attack !== null && blocksPerfectly(world, target)) {
    blockedPerfectly(world, events, attacker, target);
    return true;
  }
  if (!blocking(world, target)) return false;
  blocked(world, events, attacker, hit, target);
  return true;
}

function blockedPerfectly(world: World, events: FightEvent[], attacker: Entity, target: Entity): void {
  const player = world.get(target, Player), attack = world.get(target, WeaponAttack);
  if (player) player.perfectBlockLeft = 0;
  if (attack) Object.assign(attack, { perfectBlockRead: false, riposte: true });
  const wielder = world.get(attacker, Wielder), stamina = world.get(attacker, Stamina);
  if (wielder) endChain(wielder);
  if (stamina) spend(stamina, HYBRID.block.perfectDrain);
  stagger(world, attacker, HYBRID.block.perfectRecoilTime);
  events.push({ type: "block", by: attacker, target, perfect: true });
}

function blocked(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): void {
  const block = HYBRID.block, damage = hit.damage * damageDealtFactor(world, attacker);
  let broken: boolean;
  if (world.has(target, Player)) {
    const stamina = world.require(target, Stamina);
    const cost = damage * (hit.attack === "heavy" ? block.heavyStaminaFactor : 1);
    broken = stamina.value <= cost;
    spend(stamina, cost);
  } else {
    const enemy = world.require(target, Enemy);
    enemy.poise -= hit.poiseDamage;
    // The brain staggers it on its next step, as for a hit.
    broken = enemy.poise <= 0;
  }
  if (hit.attack === null) {
    const body = world.require(target, Body), from = world.require(attacker, Body).pos;
    knock(body.pos, from, body.vel, hit.knockback * block.pushbackFactor, 0, { x: hit.dirX, z: hit.dirZ });
  } else {
    hurt(world, target, damage * block.chipFraction, "physical");
    endSwing(world, attacker);
  }
  if (broken && world.has(target, Player)) stagger(world, target, block.brokenTime);
  events.push({ type: "block", by: attacker, target, broken });
}
