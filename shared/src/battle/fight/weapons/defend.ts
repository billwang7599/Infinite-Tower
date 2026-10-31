import type { Entity, World } from "../../../core/ecs.js";
import type { Vec2, Vec3 } from "../../../core/math.js";
import { toSteps } from "../../../core/time.js";
import { COUNTER_PARRY, HYBRID, mirrorWay, parryShare } from "../../../weapons/hybrid.js";
import {
  Body, Enemy, Player, Stamina, WeaponAttack, Wielder, type ActiveHitData,
} from "../../components.js";
import { PLAYER } from "../../player.js";
import { faces, knock, stagger, type Defended } from "../combat.js";
import type { FightEvent } from "../context.js";
import { damageDealtFactor, hurt } from "../skills/statuses.js";
import { endChain, endSwing } from "./swing.js";

const COUNTER_STEPS = toSteps(COUNTER_PARRY.windowTime);

export function facingOf(world: World, e: Entity): Vec2 {
  const player = world.get(e, Player);
  if (player) return player.actionDir;
  const yaw = world.require(e, Enemy).yaw;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function blocking(world: World, e: Entity): boolean {
  const player = world.get(e, Player);
  if (player) return player.action === "block";
  const enemy = world.get(e, Enemy), attack = world.get(e, WeaponAttack);
  return enemy?.state === "approach" && attack !== undefined && enemy.stateTime >= attack.def.blockReactTime;
}

export function defend(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity,
): Defended {
  const from = world.require(attacker, Body).pos, at = world.require(target, Body).pos;
  const inFront = faces(at, facingOf(world, target), from, HYBRID.block.minDot);
  if (hit.attack !== null) {
    const share = counterShare(world, hit, target, from);
    if (share > 0) {
      const open = world.has(attacker, Player) ? COUNTER_PARRY.playerStaggerTime : COUNTER_PARRY.stunTime;
      parried(world, events, attacker, hit, target, open * share, share);
      return "parried";
    }
    if (inFront && tapParries(world, target)) {
      const player = world.get(target, Player), attack = world.get(target, WeaponAttack);
      if (player) player.tapParryLeft = 0;
      if (attack) Object.assign(attack, { parryRead: false, riposte: true });
      parried(world, events, attacker, hit, target, HYBRID.block.riposteTime, 0);
      return "parried";
    }
  }
  if (!inFront || !blocking(world, target)) return null;
  blocked(world, events, attacker, hit, target);
  return "blocked";
}

function counterShare(world: World, hit: ActiveHitData, target: Entity, from: Vec3): number {
  const own = world.get(target, Wielder)?.swing;
  if (!own || hit.way === null) return 0;
  const share = parryShare(own.way, mirrorWay(hit.way));
  if (share === 0 || !faces(world.require(target, Body).pos, own.dir, from, COUNTER_PARRY.minDot)) return 0;
  // The weapon system ran this step: the swing's clock is one step on.
  const sinceLive = own.step - 1 - own.liveAt;
  return sinceLive >= 0 && sinceLive <= COUNTER_STEPS ? share : 0;
}

function tapParries(world: World, target: Entity): boolean {
  const player = world.get(target, Player);
  if (player) return (player.action === "block" || player.action === "none") && player.tapParryLeft > 0;
  return (world.get(target, WeaponAttack)?.parryRead ?? false) && blocking(world, target);
}

function parried(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, parrier: Entity, openTime: number,
  share: number,
): void {
  const wielder = world.get(attacker, Wielder);
  if (wielder) endChain(wielder);
  stagger(world, attacker, openTime);
  const body = world.require(attacker, Body), at = world.require(parrier, Body).pos;
  if (share > 0) {
    const speed = world.has(attacker, Player) ? COUNTER_PARRY.playerKnockbackSpeed * share
      : Math.sqrt(2 * COUNTER_PARRY.slideDecel * COUNTER_PARRY.knockbackDist * share);
    knock(body.pos, at, body.vel, speed);
  }
  events.push({ type: "parry", by: parrier, target: attacker, attack: hit.attack! });
}

function blocked(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): void {
  const block = HYBRID.block, damage = hit.damage * damageDealtFactor(world, attacker);
  const stamina = world.has(target, Player) ? world.get(target, Stamina) : undefined;
  let broken = hit.attack === "heavy";
  if (stamina && !broken) {
    const cost = damage * block.staminaPerDamage;
    broken = stamina.value < cost;
    stamina.value = Math.max(0, stamina.value - cost);
    stamina.regenDelay = PLAYER.staminaRegenDelay;
  }
  if (hit.attack === null) {
    const body = world.require(target, Body), from = world.require(attacker, Body).pos;
    knock(body.pos, from, body.vel, hit.knockback * block.pushbackFactor, 0, { x: hit.dirX, z: hit.dirZ });
  } else {
    hurt(world, target, damage * block.chipFraction, "physical");
    endSwing(world, attacker);
  }
  if (broken) stagger(world, target, block.brokenTime);
  events.push({ type: "block", by: attacker, target, broken });
}
