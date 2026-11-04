import type { Entity, World } from "../../core/ecs.js";
import type { Vec2, Vec3 } from "../../core/math.js";
import { inView } from "../../world/interact.js";
import { Body, Fighter, Health, Skilled } from "../components.js";
import { foesNear } from "./skills/strike.js";

interface Aim { dir: Vec2; at: Vec3; target: Entity | null }

export function aimOf(world: World, e: Entity, from: Vec3 = world.require(e, Body).pos): Aim {
  const { aim, aimAt, target } = world.require(e, Skilled);
  const health = target === null ? undefined : world.get(target, Health);
  if (target !== null && health && health.hp > health.floor) {
    const { pos, centerHeight } = world.require(target, Body);
    const at = { ...pos, y: pos.y - centerHeight + world.require(target, Fighter).heightM / 2 };
    const flatM = Math.hypot(at.x - from.x, at.z - from.z);
    if (flatM > 0) return { dir: { x: (at.x - from.x) / flatM, z: (at.z - from.z) / flatM }, at, target };
  }
  return { dir: { ...aim }, at: { ...aimAt }, target: null };
}

export function foeAlong(
  world: World, e: Entity, from: Vec3, way: Vec2, lookRad: number, except?: Entity,
): Entity | null {
  const foes = foesNear(world, e, from, Infinity, except).map((foe) => ({ foe, ...world.require(foe, Body).pos }));
  return inView(from, way, foes, Infinity, lookRad)?.foe ?? null;
}
