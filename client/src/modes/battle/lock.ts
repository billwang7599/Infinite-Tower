import { Body, distXZ, Health, type Entity, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../components.js";
import type { Polled } from "../../core/actions.js";

export interface Foe { e: Entity; pos: Vec3 }
export interface Aim { eye: Vec3; at: Vec3 }

const TURNS: readonly Polled["pressed"][number][] = ["turnLeft", "turnRight", "lookUp", "lookDown"];

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

/** `foes` are the living enemies: a target not among them has died. Turning the camera by hand lets go. */
export function steerLock(
  target: Entity | null, { pressed, dragged }: Pick<Polled, "pressed" | "dragged">, foes: readonly Foe[], aim: Aim,
  from: Vec3,
): Entity | null {
  let lock = foes.some((f) => f.e === target) && !dragged ? target : null;
  for (const action of pressed) {
    if (action === "lockOn") lock = lock === null ? pointedFoe(foes, aim) : null;
    else if (action === "lockClosest") lock = closestFoe(foes, from);
    else if (TURNS.includes(action)) lock = null;
  }
  return lock;
}

export function lockYaw(from: Vec3, to: Vec3): number | null {
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.hypot(dx, dz) < 1e-3 ? null : Math.atan2(dx, dz);
}
