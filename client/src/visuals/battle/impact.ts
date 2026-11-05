import {
  Body, smoothstep, weaponItemIn, Wielder, type Entity, type SwingData, type Vec3, type World,
} from "@infinite-tower/shared";
import { LocalPlayer } from "../../modes/components.js";
import type { ArenaScene } from "./scene.js";
import { wayCut, type Cut } from "./weapons.js";

export const HIT_STOP_MS = 50;
export const HIT_STOP_EASE_MS = 100;
const HIT_STOP_KICK_RAD = 0.006;
export const JOLT_M = 0.18;
const JOLT_MS = 140;
// The push away from the attacker, as a share of the push along the swing.
const JOLT_AWAY_SHARE = 0.5;
const BOUNCE_M = 0.12;
const BOUNCE_MS = 120;
const SPARK_UP_M = 0.3;
const PARRY_BOUNCE_M = 0.3;
const PARRY_BOUNCE_MS = 220;
const BROKEN_JOLT_M = 0.35;
const BROKEN_JOLT_MS = 200;

export interface Impact { ageMs: number; push: Vec3; pushMs: number }

export function impactPose({ ageMs, push, pushMs }: Impact): { offset: Vec3; done: boolean } {
  if (ageMs >= pushMs) return { offset: { x: 0, y: 0, z: 0 }, done: true };
  const k = Math.sin((Math.PI * ageMs) / pushMs);
  return { offset: { x: push.x * k, y: push.y * k, z: push.z * k }, done: false };
}

/** `step`: how far along it's drawn, in fight steps. */
export interface Swung { swing: SwingData; step: number }
/** `held`: the swing drawn at contact, taken on the drawing's next frame (null: none). */
export interface HitStop { ageMs: number; held?: Swung | null }

const holdShare = (ageMs: number): number => 1 - smoothstep(HIT_STOP_MS, HIT_STOP_MS + HIT_STOP_EASE_MS, ageMs);
export const hitStopDone = (stop: HitStop): boolean => stop.ageMs >= HIT_STOP_MS + HIT_STOP_EASE_MS;
export const swingHeld = (stop: HitStop | undefined): boolean => !!stop?.held && stop.ageMs < HIT_STOP_MS;
export const hitStopKickRad = (stop: HitStop | undefined): number =>
  stop ? HIT_STOP_KICK_RAD * holdShare(stop.ageMs) : 0;

/** `last`: the swing drawn last frame, which a block or a parry may have ended. */
export function heldSwing(stop: HitStop | undefined, live: Swung | null, last: Swung | null): Swung | null {
  if (!stop) return live;
  if (stop.held === undefined) stop.held = live && last?.swing !== live.swing ? live : last;
  const { held } = stop;
  if (!held || (live && live.swing !== held.swing)) return live;
  const k = holdShare(stop.ageMs);
  if (!live) return k >= 1 ? held : null;
  return { swing: live.swing, step: live.step + (held.step - live.step) * k };
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

/** `shot`: where a projectile struck: only the target is jolted, away from it. */
export function strike(scene: ArenaScene, world: World, by: Entity, target: Entity, shot?: Vec3): void {
  const hands = world.get(by, Wielder)?.hands;
  if (!hands || !weaponItemIn(hands)) return;
  const { eye, at } = scene.battle.view;
  const ahead = levelUnit(eye, at), right = { x: ahead.z, y: 0, z: -ahead.x };
  const away = levelUnit(shot ?? world.require(by, Body).pos, world.require(target, Body).pos);
  const swing = world.get(by, Wielder)?.swing;
  const push = joltOf(swing ? wayCut(swing.way, !world.has(by, LocalPlayer)) : null, away, right);
  if (!shot) hold(scene, by);
  scene.impacts.set(target, { ageMs: 0, push, pushMs: JOLT_MS });
}

const hold = (scene: ArenaScene, e: Entity) => scene.hitStops.set(e, { ageMs: 0 });

export function arrowStopped(
  scene: ArenaScene, world: World, guard: Entity, struck: Vec3, how: { perfect?: boolean; broken?: boolean },
): void {
  const { perfect, broken } = how;
  const g = world.require(guard, Body).pos, back = levelUnit(struck, g);
  const push = { x: back.x * BOUNCE_M, y: 0, z: back.z * BOUNCE_M };
  scene.impacts.set(guard, { ageMs: 0, push, pushMs: BOUNCE_MS });
  if (perfect) scene.skills.bursts.parry(struck);
  else scene.skills.bursts.sparks(struck);
  if (broken) scene.skills.bursts.guardBroken({ x: g.x, y: g.y + SPARK_UP_M, z: g.z });
}

const meeting = (a: Vec3, b: Vec3): Vec3 =>
  ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + SPARK_UP_M, z: (a.z + b.z) / 2 });

export function clash(scene: ArenaScene, world: World, stopped: Entity, guard: Entity): void {
  const hands = world.get(stopped, Wielder)?.hands;
  if (!hands || !weaponItemIn(hands)) return;
  const a = world.require(stopped, Body).pos, b = world.require(guard, Body).pos, back = levelUnit(b, a);
  const push = { x: back.x * BOUNCE_M, y: 0, z: back.z * BOUNCE_M };
  hold(scene, stopped);
  scene.impacts.set(stopped, { ageMs: 0, push, pushMs: BOUNCE_MS });
  scene.skills.bursts.sparks(meeting(a, b));
}

export function parried(scene: ArenaScene, world: World, blocker: Entity, attacker: Entity): void {
  const a = world.require(attacker, Body).pos, p = world.require(blocker, Body).pos, back = levelUnit(p, a);
  const push = { x: back.x * PARRY_BOUNCE_M, y: 0, z: back.z * PARRY_BOUNCE_M };
  hold(scene, blocker);
  hold(scene, attacker);
  scene.impacts.set(attacker, { ageMs: 0, push, pushMs: PARRY_BOUNCE_MS });
  scene.skills.bursts.parry(meeting(a, p));
}

export function guardBroken(scene: ArenaScene, world: World, by: Entity, target: Entity): void {
  const t = world.require(target, Body).pos, away = levelUnit(world.require(by, Body).pos, t);
  const push = { x: away.x * BROKEN_JOLT_M, y: 0, z: away.z * BROKEN_JOLT_M };
  scene.impacts.set(target, { ageMs: 0, push, pushMs: BROKEN_JOLT_MS });
  scene.skills.bursts.guardBroken({ x: t.x, y: t.y + SPARK_UP_M, z: t.z });
}
