import { Body, distXZ, Health, VIEW, type Entity, type PlayerAction, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../components.js";
import type { Polled } from "../../core/actions.js";

export interface Foe { e: Entity; pos: Vec3 }
export interface Aim { eye: Vec3; at: Vec3 }
export interface View extends Aim { fovRad: number }
export type FreeCamera = "aim" | "pan" | null;

export const livingFoes = ({ targets, world }: Fight): Foe[] =>
  targets.flatMap((e) =>
    world.require(e, Health).hp > 0 && !world.has(e, LocalPlayer) ? [{ e, pos: world.require(e, Body).pos }] : []);

export function closestFoe(foes: readonly Foe[], from: Vec3): Entity | null {
  let best: Foe | null = null;
  for (const foe of foes) if (!best || distXZ(foe.pos, from) < distXZ(best.pos, from)) best = foe;
  return best?.e ?? null;
}

// No screen cut-off: with nobody in front, the one behind the camera nearest its line counts.
export function pointedFoe(foes: readonly Foe[], { eye, at }: Aim): Entity | null {
  const lx = at.x - eye.x, ly = at.y - eye.y, lz = at.z - eye.z, look = Math.hypot(lx, ly, lz) || 1;
  let best: { e: Entity; cos: number } | null = null;
  for (const { e, pos } of foes) {
    const dx = pos.x - eye.x, dy = pos.y - eye.y, dz = pos.z - eye.z;
    const cos = (dx * lx + dy * ly + dz * lz) / (look * (Math.hypot(dx, dy, dz) || 1));
    if (!best || cos > best.cos) best = { e, cos };
  }
  return best?.e ?? null;
}

export function freeCamera(
  { dragging, turn, look }: Pick<Polled, "dragging" | "turn" | "look">, action: PlayerAction,
): FreeCamera {
  if (action === "draw" || action === "loose") return "aim";
  return dragging || turn !== 0 || look !== 0 ? "pan" : null;
}

// The picture is never wider than VIEW.maxAspect, so that's as far to the sides as it shows.
function inView({ eye, at, fovRad }: View, pos: Vec3): boolean {
  const lx = at.x - eye.x, ly = at.y - eye.y, lz = at.z - eye.z, flat = Math.hypot(lx, lz), line = Math.hypot(flat, ly);
  if (flat < 1e-6) return false;
  const ahead = { x: lx / line, y: ly / line, z: lz / line }, right = { x: lz / flat, y: 0, z: -lx / flat };
  const up = { x: ahead.y * right.z, y: ahead.z * right.x - ahead.x * right.z, z: -ahead.y * right.x };
  const d = { x: pos.x - eye.x, y: pos.y - eye.y, z: pos.z - eye.z };
  const dot = (v: Vec3) => d.x * v.x + d.y * v.y + d.z * v.z, depth = dot(ahead), half = Math.tan(fovRad / 2);
  return depth > 0 && Math.abs(dot(up)) <= half * depth && Math.abs(dot(right)) <= half * VIEW.maxAspect * depth;
}

export const inViewFoe = (foes: readonly Foe[], view: View): Entity | null =>
  pointedFoe(foes.filter((f) => inView(view, f.pos)), view);

export function steerLock(
  target: Entity | null, { pressed, free, wasFree }: { pressed: Polled["pressed"]; free: boolean; wasFree: boolean },
  foes: readonly Foe[], view: View, from: Vec3,
): Entity | null {
  const alive = foes.some((f) => f.e === target) ? target : null;
  let lock = alive !== null && (free || !wasFree) ? alive : inViewFoe(foes, view) ?? alive ?? closestFoe(foes, from);
  for (const action of pressed) {
    if (action === "lockOn") lock = pointedFoe(foes.filter((f) => f.e !== lock), view) ?? lock;
    else if (action === "lockClosest") lock = closestFoe(foes, from);
  }
  return lock;
}

export function lockYaw(from: Vec3, to: Vec3): number | null {
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.hypot(dx, dz) < 1e-3 ? null : Math.atan2(dx, dz);
}
