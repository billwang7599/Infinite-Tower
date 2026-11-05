import {
  Player, Projectile, type BodyData, type Entity, type FighterData, type PlayerAction, type Vec3, type World,
} from "@infinite-tower/shared";
import { entersAt, landsAt } from "@infinite-tower/shared/fight";
import type { Polled } from "../../core/actions.js";
import type { BattleContext } from "./context.js";
import { lockYaw } from "./lock.js";

export type FreeCamera = "aim" | "pan" | null;
export interface Aimed { e: Entity; body: BodyData; fighter: FighterData }
export interface Aiming { x: number; z: number; at: Vec3 }

// While one of these lasts, the camera is the mouse's, the crosshair shows and the fight isn't told of the lock.
export const AIMING: readonly PlayerAction[] = ["draw", "loose", "chant", "cast", "beam"];

// Nearer than this ahead of the player, the crosshair's spot gives no clear way to aim.
export const CROSSHAIR_MIN_M = 1;

// Your arrow still flying keeps it: swung back to the lock mid-flight, the arrow would streak off the screen.
export function freeCamera(
  { dragging, turn, look }: Pick<Polled, "dragging" | "turn" | "look">, world: World, me: Entity,
): FreeCamera {
  const flying = [...world.query(Projectile)].some(([, arrow]) => arrow.shooter === me && !arrow.stuck);
  if (AIMING.includes(world.require(me, Player).action) || flying) return "aim";
  return dragging || turn !== 0 || look !== 0 ? "pan" : null;
}

export function crosshairAim(eye: Vec3, at: Vec3, from: Vec3, foes: readonly Aimed[], wallM: number): Aiming | null {
  const lineM = Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z), flatM = Math.hypot(at.x - eye.x, at.z - eye.z);
  if (flatM < 1e-6) return null;
  // The eye is inside the wall, so no line in the arena is longer than its diameter.
  const scale = (2 * wallM) / lineM, ahead = { x: (at.x - eye.x) / flatM, z: (at.z - eye.z) / flatM };
  const d = { x: (at.x - eye.x) * scale, y: (at.y - eye.y) * scale, z: (at.z - eye.z) * scale };
  const shares = [landsAt(eye, d, wallM), ...foes.map(({ body, fighter }) => entersAt(eye, d, body, fighter, 0))];
  let aim: Aiming | null = null, aimShare = Infinity;
  for (const share of shares) {
    if (share === null || share >= aimShare) continue;
    const spot = { x: eye.x + d.x * share, y: eye.y + d.y * share, z: eye.z + d.z * share };
    const dx = spot.x - from.x, dz = spot.z - from.z;
    if (dx * ahead.x + dz * ahead.z < CROSSHAIR_MIN_M) continue;
    const flat = Math.hypot(dx, dz);
    aim = { x: dx / flat, z: dz / flat, at: spot };
    aimShare = share;
  }
  return aim;
}

export function playerAim(
  { lock, freeCamera: free, view }: Pick<BattleContext, "lock" | "freeCamera" | "view">, foes: readonly Aimed[],
  from: Vec3, wallM: number,
): { walkYaw: number; aim: Aiming; locked: Entity | null } {
  const target = free !== null ? undefined : foes.find((f) => f.e === lock)?.body.pos;
  const walkYaw = (target && lockYaw(from, target)) ?? view.yaw;
  const x = Math.sin(walkYaw), z = Math.cos(walkYaw), reach = { x: x * 2 * wallM, y: 0, z: z * 2 * wallM };
  const share = landsAt(from, reach, wallM);
  const level = { x, z, at: { x: from.x + reach.x * share, y: from.y, z: from.z + reach.z * share } };
  if (target) return { walkYaw, aim: level, locked: lock };
  return { walkYaw, aim: crosshairAim(view.eye, view.at, from, foes, wallM) ?? level, locked: null };
}
