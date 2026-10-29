import {
  Body, isSwing, SCREEN_DIR, weaponItemIn, Wielder, type AttackKind, type Entity, type Vec3, type World,
} from "@infinite-tower/shared";
import type { ArenaScene } from "./scene.js";
import { WEAPON_LOOKS } from "./weapons.js";

export const PARRY_HIT_STOP_MS = 120;
export const JOLT_M = 0.18;
const JOLT_MS = 140;
// The push away from the attacker, as a share of the push along the swing.
const JOLT_AWAY_SHARE = 0.5;
const BOUNCE_M = 0.12;
const BOUNCE_MS = 120;
const SPARK_UP_M = 0.3;

export interface Impact { ageMs: number; stopMs: number; push: Vec3; pushMs: number }

export function impactPose({ ageMs, stopMs, push, pushMs }: Impact): { frozen: boolean; offset: Vec3; done: boolean } {
  if (ageMs < stopMs) return { frozen: true, offset: { x: 0, y: 0, z: 0 }, done: false };
  if (ageMs >= stopMs + pushMs) return { frozen: false, offset: { x: 0, y: 0, z: 0 }, done: true };
  const k = Math.sin((Math.PI * (ageMs - stopMs)) / pushMs);
  return { frozen: false, offset: { x: push.x * k, y: push.y * k, z: push.z * k }, done: false };
}

/** `away` and `right` (the camera's) are unit and level. */
export function joltOf(attack: AttackKind | null, away: Vec3, right: Vec3): Vec3 {
  const way = attack && isSwing(attack) ? SCREEN_DIR[attack] : { x: 0, y: 0 };
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
  const push = joltOf(world.get(by, Wielder)?.swing?.attack ?? null, away, right);
  scene.impacts.set(by, { ageMs: 0, stopMs, push: STILL, pushMs: 0 });
  scene.impacts.set(target, { ageMs: 0, stopMs, push, pushMs: JOLT_MS });
}

export function clash(scene: ArenaScene, world: World, stopped: Entity, guard: Entity, stopMs: number): void {
  const hands = world.get(stopped, Wielder)?.hands;
  if (!hands || !weaponItemIn(hands)) return;
  const a = world.require(stopped, Body).pos, b = world.require(guard, Body).pos, back = levelUnit(b, a);
  const push = { x: back.x * BOUNCE_M, y: 0, z: back.z * BOUNCE_M };
  scene.impacts.set(stopped, { ageMs: 0, stopMs, push, pushMs: BOUNCE_MS });
  if (stopMs > 0) scene.impacts.set(guard, { ageMs: 0, stopMs, push: STILL, pushMs: 0 });
  scene.skills.bursts.sparks({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + SPARK_UP_M, z: (a.z + b.z) / 2 });
}
