import type { Entity, System, World } from "../../core/ecs.js";
import { REACTIONS, type Reaction } from "../../skills/effects.js";
import { Enemy, Health, Player, Statuses, type StatusData } from "../components.js";
import { FighterStats, HP_REGEN_PAUSE_TIME, hpRegenPerSec, physicalTakenFactor, skillTakenFactor } from "../stats.js";
import { FIRST_DOOR } from "../../soul/inscriptions.js";
import { applyStatus, endStatus, modsFrom, NO_MODS, statusDef, statusOn, type StatMods } from "../statuses.js";

export function noStatuses(): StatusData {
  return { on: [], cooldown: Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<Reaction, number> };
}

export const modsOf = (world: World, e: Entity): StatMods => {
  const s = world.get(e, Statuses);
  return s ? modsFrom(s.on) : NO_MODS;
};

export function statusSystem(): System {
  return (world, dt) => {
    for (const [e, s, health] of world.query(Statuses, Health)) {
      const burnTaken = modsFrom(s.on).burnTakenFactor;
      for (const o of [...s.on]) {
        const kind = statusDef(o.status).amount;
        if (kind === "hurtsPerSec" && health.hp > 0 && burnTaken > 0) {
          hurt(world, e, o.amount * dt * burnTaken, "skill");
        }
        if (kind === "healsPerSec") heal(world, e, o.amount * dt);
      }
      s.on = s.on.filter((o) => {
        if (o.left !== null) o.left = Math.max(0, o.left - dt);
        return o.left !== 0;
      });
      for (const reaction of REACTIONS) s.cooldown[reaction] = Math.max(0, s.cooldown[reaction] - dt);
    }
  };
}

export function hurt(world: World, e: Entity, damage: number, kind: "physical" | "skill"): number {
  if (world.get(e, Player)?.invulnerable || world.get(e, Enemy)?.def.dummy) return 0;
  const health = world.require(e, Health), s = world.get(e, Statuses), stats = world.get(e, FighterStats);
  let rest = damage * modsOf(world, e).damageTakenFactor;
  if (stats) rest *= kind === "physical" ? physicalTakenFactor(stats) : skillTakenFactor(stats);
  if (damage > 0) health.regenDelay = HP_REGEN_PAUSE_TIME;
  if (s) {
    for (const o of s.on) {
      if (statusDef(o.status).amount !== "absorbs") continue;
      const absorbed = Math.min(o.amount, rest);
      o.amount -= absorbed;
      rest -= absorbed;
    }
    s.on = s.on.filter((o) => statusDef(o.status).amount !== "absorbs" || o.amount > 0);
  }
  const hp = Math.max(Math.min(health.hp, health.floor), health.hp - rest);
  if (hp <= 0 && health.hp > 0 && s && statusOn(s.on, "firstDoor")) {
    endStatus(s.on, "firstDoor");
    applyStatus(s.on, "openedDoor", FIRST_DOOR.openTime);
    health.hp = FIRST_DOOR.hpLeft;
  } else health.hp = hp;
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

export function lifesteal(world: World, e: Entity, dealt: number, weapon = false): void {
  const mods = modsOf(world, e), share = mods.lifesteal + (weapon ? mods.weaponLifesteal : 0);
  if (share > 0) heal(world, e, dealt * share);
}
