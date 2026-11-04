import type { Entity, World } from "../../core/ecs.js";
import type { Vec2, Vec3 } from "../../core/math.js";
import { Body, Fighter, Health, Skilled } from "../components.js";

interface Aim { dir: Vec2; pitchRad: number; target: Entity | null; at: Vec3 | null }

export function aimOf(world: World, e: Entity, from: Vec3 = world.require(e, Body).pos): Aim {
  const { aim, aimPitchRad, target } = world.require(e, Skilled);
  const health = target === null ? undefined : world.get(target, Health);
  if (target !== null && health && health.hp > health.floor) {
    const { pos, centerHeight } = world.require(target, Body);
    const at = { ...pos, y: pos.y - centerHeight + world.require(target, Fighter).heightM / 2 };
    const flatM = Math.hypot(at.x - from.x, at.z - from.z);
    if (flatM > 0) {
      const dir = { x: (at.x - from.x) / flatM, z: (at.z - from.z) / flatM };
      return { dir, pitchRad: Math.atan2(at.y - from.y, flatM), target, at };
    }
  }
  return { dir: { ...aim }, pitchRad: aimPitchRad, target: null, at: null };
}
