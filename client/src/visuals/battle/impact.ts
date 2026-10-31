import { Body, LocalPlayer, weaponItemIn, Wielder, type Entity, type Vec3, type World } from "@infinite-tower/shared";
import type { ArenaScene } from "./scene.js";
import { WEAPON_LOOKS, wayCut, type Cut } from "./weapons.js";

export const JOLT_M = 0.18;
const JOLT_MS = 140;
// The push away from the attacker, as a share of the push along the swing.
const JOLT_AWAY_SHARE = 0.5;
const BOUNCE_M = 0.12;
const BOUNCE_MS = 120;
const SPARK_UP_M = 0.3;
export const PARRY_HIT_STOP_MS = 140;
const PARRY_BOUNCE_M = 0.3;
const PARRY_BOUNCE_MS = 220;
const SHOVE_HIT_STOP_MS = 70;
const BROKEN_JOLT_M = 0.35;
const BROKEN_JOLT_MS = 200;

export interface Impact { ageMs: number; stopMs: number; push: Vec3; pushMs: number }

export function impactPose({ ageMs, stopMs, push, pushMs }: Impact): { frozen: boolean; offset: Vec3; done: boolean } {
  if (ageMs < stopMs) return { frozen: true, offset: { x: 0, y: 0, z: 0 }, done: false };
  if (ageMs >= stopMs + pushMs) return { frozen: false, offset: { x: 0, y: 0, z: 0 }, done: true };
  const k = Math.sin((Math.PI * (ageMs - stopMs)) / pushMs);
  return { frozen: false, offset: { x: push.x * k, y: push.y * k, z: push.z * k }, done: false };
}

/** `away` and `right` (the camera's) are unit and level. */
export function joltOf(cut: Cut | null, away: Vec3, right: Vec3): Vec3 {
  const way = cut ?? { x: 0, y: 0 };
  const x = away.x * JOLT_AWAY_SHARE + right.x * way.x, z = away.z * JOLT_AWAY_SHARE + right.z * way.x, y = way.y;
  const k = JOLT_M / Math.hypot(x, y, z);
  return { x: x * k, y: y * k, z: z * k };
}

const levelUnit = (from: Vec3, to: Vec3): Vec3 => {
  const x = to.x - from.x, z = to.z - from.z, l = Math.hypot(x, z);
  return l > 1e-6 ? { x: x / l, y: 0, z: z / l } : { x: 0, y: 0, z: 1 };
};
const STILL = { x: 0, y: 0, z: 0 };

export function strike(scene: ArenaScene, world: World, by: Entity, target: Entity): void {
  const hands = world.get(by, Wielder)?.hands, item = hands && weaponItemIn(hands);
  if (!item) return;
  const stopMs = WEAPON_LOOKS[item].hitStopMs, { eye, at } = scene.battle.view;
  const ahead = levelUnit(eye, at), right = { x: ahead.z, y: 0, z: -ahead.x };
  const away = levelUnit(world.require(by, Body).pos, world.require(target, Body).pos);
  const swing = world.get(by, Wielder)?.swing;
  const push = joltOf(swing ? wayCut(swing.way, !world.has(by, LocalPlayer)) : null, away, right);
  scene.impacts.set(by, { ageMs: 0, stopMs, push: STILL, pushMs: 0 });
  scene.impacts.set(target, { ageMs: 0, stopMs, push, pushMs: JOLT_MS });
}

const meeting = (a: Vec3, b: Vec3): Vec3 =>
  ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + SPARK_UP_M, z: (a.z + b.z) / 2 });

export function clash(scene: ArenaScene, world: World, stopped: Entity, guard: Entity): void {
  const hands = world.get(stopped, Wielder)?.hands;
  if (!hands || !weaponItemIn(hands)) return;
  const a = world.require(stopped, Body).pos, b = world.require(guard, Body).pos, back = levelUnit(b, a);
  const push = { x: back.x * BOUNCE_M, y: 0, z: back.z * BOUNCE_M };
  scene.impacts.set(stopped, { ageMs: 0, stopMs: 0, push, pushMs: BOUNCE_MS });
  scene.skills.bursts.sparks(meeting(a, b));
}

export function parried(scene: ArenaScene, world: World, parrier: Entity, attacker: Entity): void {
  const a = world.require(attacker, Body).pos, p = world.require(parrier, Body).pos, back = levelUnit(p, a);
  const push = { x: back.x * PARRY_BOUNCE_M, y: 0, z: back.z * PARRY_BOUNCE_M };
  scene.impacts.set(parrier, { ageMs: 0, stopMs: PARRY_HIT_STOP_MS, push: STILL, pushMs: 0 });
  scene.impacts.set(attacker, { ageMs: 0, stopMs: PARRY_HIT_STOP_MS, push, pushMs: PARRY_BOUNCE_MS });
  scene.skills.bursts.parry(meeting(a, p));
}

export function shoved(scene: ArenaScene, world: World, by: Entity, target: Entity, broken: boolean): void {
  const t = world.require(target, Body).pos, away = levelUnit(world.require(by, Body).pos, t);
  if (!broken) {
    scene.impacts.set(by, { ageMs: 0, stopMs: SHOVE_HIT_STOP_MS, push: STILL, pushMs: 0 });
    scene.impacts.set(target, { ageMs: 0, stopMs: SHOVE_HIT_STOP_MS, push: STILL, pushMs: 0 });
    return;
  }
  const push = { x: away.x * BROKEN_JOLT_M, y: 0, z: away.z * BROKEN_JOLT_M };
  scene.impacts.set(target, { ageMs: 0, stopMs: 0, push, pushMs: BROKEN_JOLT_MS });
  scene.skills.bursts.guardBroken({ x: t.x, y: t.y + SPARK_UP_M, z: t.z });
}
