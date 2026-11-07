import type { Entity, System, World } from "../../../core/ecs.js";
import type { Vec3 } from "../../../core/math.js";
import { flightAfter, type ProjectileDef } from "../../../weapons/bow.js";
import { rangedOf } from "../../../weapons/kinds.js";
import { WEAPONS } from "../../../weapons/weapons.js";
import {
  Body, Fighter, Health, Projectile, type ActiveHitData, type BodyData, type FighterData, type ProjectileData,
} from "../../components.js";
import { dodging, land } from "../combat.js";
import type { FightContext } from "../context.js";
import { defend } from "./defend.js";

// Timers are float seconds counted down by FIXED_DT: this keeps 1 / (1/60) steps from becoming 61.
const EPS = 1e-6;

export const projectileOf = (o: Pick<ProjectileData, "weapon">): ProjectileDef =>
  rangedOf(WEAPONS[o.weapon])!.projectile;

const PITCH_STEP_RAD = Math.PI / 360;

// The lower of the two arcs through `to`; null past the speed's reach.
export function launchAt(def: ProjectileDef, from: Vec3, to: Vec3, speedMps: number): Vec3 | null {
  const dx = to.x - from.x, dz = to.z - from.z, flatM = Math.hypot(dx, dz);
  if (flatM < EPS) return null;
  const velAt = (rad: number): Vec3 => {
    const flatMps = speedMps * Math.cos(rad);
    return { x: (dx / flatM) * flatMps, y: speedMps * Math.sin(rad), z: (dz / flatM) * flatMps };
  };
  const heightAt = (rad: number): number => {
    const slowed = (def.dragPerSec * flatM) / (speedMps * Math.cos(rad));
    if (slowed >= 1) return -Infinity;
    return flightAfter(def, from, velAt(rad), -Math.log1p(-slowed) / def.dragPerSec).pos.y;
  };
  let low = Math.atan2(to.y - from.y, flatM), high = low;
  while (heightAt(high) < to.y) {
    low = high;
    high += PITCH_STEP_RAD;
    if (high >= Math.PI / 2) return null;
  }
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (heightAt(mid) < to.y) low = mid;
    else high = mid;
  }
  return velAt(high);
}

/** The share of `d` along which a step from `a` is first inside a fighter's upright cylinder; null if never. */
export function entersAt(a: Vec3, d: Vec3, body: BodyData, fighter: FighterData, radiusM: number): number | null {
  const fx = a.x - body.pos.x, fz = a.z - body.pos.z, r = fighter.radius + radiusM;
  const A = d.x * d.x + d.z * d.z, B = 2 * (fx * d.x + fz * d.z), C = fx * fx + fz * fz - r * r;
  let lo = 0, hi = 1;
  if (A < EPS * EPS) {
    if (C > 0) return null;
  } else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    lo = Math.max(lo, (-B - Math.sqrt(disc)) / (2 * A));
    hi = Math.min(hi, (-B + Math.sqrt(disc)) / (2 * A));
  }
  const feet = body.pos.y - body.centerHeight, bottom = feet - radiusM, top = feet + fighter.heightM + radiusM;
  if (Math.abs(d.y) < EPS) {
    if (a.y < bottom || a.y > top) return null;
  } else {
    const t0 = (bottom - a.y) / d.y, t1 = (top - a.y) / d.y;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
  }
  return lo <= hi ? lo : null;
}

/** The share of `d` at which it reaches the floor (y = 0) or the arena's wall; past 1, neither this step. */
export function landsAt(a: Vec3, d: Vec3, wallM: number): number {
  const floor = d.y < 0 ? Math.max(0, a.y / -d.y) : Infinity;
  const A = d.x * d.x + d.z * d.z, B = 2 * (a.x * d.x + a.z * d.z), C = a.x * a.x + a.z * a.z - wallM * wallM;
  const wall = C >= 0 ? 0 : A < EPS * EPS ? Infinity : (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  return Math.min(floor, wall);
}

const at = (a: Vec3, d: Vec3, t: number): Vec3 => ({ x: a.x + d.x * t, y: a.y + d.y * t, z: a.z + d.z * t });

function meets(world: World, o: ProjectileData, a: Vec3, d: Vec3, before: number): [Entity, number] | null {
  const side = world.require(o.shooter, Fighter).side, { radiusM } = projectileOf(o);
  let first: [Entity, number] | null = null;
  for (const [e, fighter, health, body] of world.query(Fighter, Health, Body)) {
    if (fighter.side === side || health.hp <= health.floor || health.invuln > 0 || dodging(world, e)) continue;
    const t = entersAt(a, d, body, fighter, radiusM);
    if (t !== null && t <= before && (first === null || t < first[1])) first = [e, t];
  }
  return first;
}

function strike(ctx: FightContext, o: ProjectileData, target: Entity, struck: Vec3): void {
  const { world, events } = ctx, flat = Math.hypot(o.vel.x, o.vel.z) || 1, def = projectileOf(o);
  const dirX = o.vel.x / flat, dirZ = o.vel.z / flat;
  const hit: ActiveHitData = {
    dirX, dirZ, range: 0, minDot: 1, attack: "light", way: null, damage: o.damage,
    knockback: def.knockbackShare * Math.hypot(o.vel.x, o.vel.y, o.vel.z), lift: 0, poiseDamage: def.poiseDamage,
    alreadyHit: new Set(),
  };
  const from = { x: struck.x - dirX, y: struck.y, z: struck.z - dirZ };
  if (!defend(world, events, o.shooter, hit, target, { from, at: struck })) {
    land(world, events, o.shooter, hit, target, struck);
  }
}

function fly(ctx: FightContext, e: Entity, o: ProjectileData, dt: number): void {
  const def = projectileOf(o), a = o.pos, next = flightAfter(def, a, o.vel, dt);
  const d = { x: next.pos.x - a.x, y: next.pos.y - a.y, z: next.pos.z - a.z };
  Object.assign(o.vel, next.vel);
  const stopsAt = landsAt(a, d, ctx.arena.radius);
  const met = meets(ctx.world, o, a, d, Math.min(1, stopsAt));
  if (met) {
    ctx.world.destroy(e);
    strike(ctx, o, met[0], at(a, d, met[1]));
    return;
  }
  if (stopsAt > 1) {
    Object.assign(o.pos, next.pos);
    return;
  }
  Object.assign(o.pos, at(a, d, stopsAt));
  if (o.pos.y < EPS) o.pos.y = 0;
  Object.assign(o, { vel: { x: 0, y: 0, z: 0 }, stuck: true, left: def.stuckTime });
}

// Runs after the fighters have moved, so each step sweeps against where they are now.
export function projectileSystem(ctx: FightContext): System {
  return (world, dt) => {
    for (const [e, o] of world.query(Projectile)) {
      o.left -= dt;
      if (o.left <= EPS) world.destroy(e);
      else if (!o.stuck) fly(ctx, e, o, dt);
    }
  };
}
