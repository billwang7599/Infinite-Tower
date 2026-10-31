import type { Entity, System, World } from "../../../core/ecs.js";
import { SKILL_EFFECTS, REACTIONS, STATUSES, type Reaction, type Status } from "../../../skills/effects.js";
import { ONE_STRIKE } from "../../../weapons/one-strike.js";
import { Health, Player, Statuses, type StatusData } from "../../components.js";
import {
  FighterStats, HP_REGEN_PAUSE_TIME, hpRegenPerSec, physicalTakenFactor, skillTakenFactor,
} from "../../stats.js";

export function noStatuses(): StatusData {
  return {
    left: Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>,
    burnDamagePerSec: 0, shocks: 0, shield: 0,
    cooldown: Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<Reaction, number>,
  };
}

export function statusSystem(): System {
  return (world, dt) => {
    for (const [e, s, health] of world.query(Statuses, Health)) {
      if (s.left.burning > 0 && health.hp > 0) hurt(world, e, s.burnDamagePerSec * dt, "skill");
      for (const status of STATUSES) s.left[status] = Math.max(0, s.left[status] - dt);
      for (const reaction of REACTIONS) s.cooldown[reaction] = Math.max(0, s.cooldown[reaction] - dt);
      if (s.left.burning === 0) s.burnDamagePerSec = 0;
      if (s.left.shocked === 0) s.shocks = 0;
      if (s.left.shielded === 0) s.shield = 0;
    }
  };
}

export function damageDealtFactor(world: World, e: Entity): number {
  const s = world.get(e, Statuses);
  if (!s) return 1;
  return (s.left.empowered > 0 ? SKILL_EFFECTS.self.fire.damageDealtFactor : 1)
    * (s.left.cursed > 0 ? SKILL_EFFECTS.elements.darkness.cursedDamageFactor : 1);
}

export function hurt(world: World, e: Entity, damage: number, kind: "physical" | "skill"): number {
  if (world.get(e, Player)?.invulnerable) return 0;
  const health = world.require(e, Health), s = world.get(e, Statuses), stats = world.get(e, FighterStats);
  let rest = damage;
  if (stats) rest *= kind === "physical" ? physicalTakenFactor(stats) : skillTakenFactor(stats);
  if (damage > 0) health.regenDelay = HP_REGEN_PAUSE_TIME;
  if (s) {
    if (s.left.warded > 0) rest *= SKILL_EFFECTS.self.earth.damageTakenFactor;
    const absorbed = Math.min(s.shield, rest);
    s.shield -= absorbed;
    rest -= absorbed;
  }
  health.hp = Math.max(0, health.hp - rest);
  return rest;
}

export function regenSystem(): System {
  return (world, dt) => {
    for (const [e, health, stats] of world.query(Health, FighterStats)) {
      if (health.regenDelay > 0) health.regenDelay = Math.max(0, health.regenDelay - dt);
      else if (health.hp < health.max) heal(world, e, hpRegenPerSec(stats) * dt);
    }
  };
}

export function heal(world: World, e: Entity, amount: number): void {
  const health = world.require(e, Health);
  if (health.hp > 0) health.hp = Math.min(health.max, health.hp + amount);
}

export function siphon(world: World, e: Entity, damage: number): void {
  if ((world.get(e, Statuses)?.left.siphoning ?? 0) > 0) heal(world, e, damage * SKILL_EFFECTS.self.darkness.healShare);
}

export function statusMoveFactor(s: StatusData | undefined): number {
  if (!s) return 1;
  return (s.left.rooted > 0 ? 1 - SKILL_EFFECTS.elements.earth.rootSlow : 1)
    * (s.left.hasted > 0 ? SKILL_EFFECTS.self.air.moveFactor : 1)
    * (s.left.lamed > 0 ? ONE_STRIKE.lameMoveFactor : 1);
}
