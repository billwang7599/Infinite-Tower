import { Body, distXZ, Health, wrapAngle, type Entity, type Vec3 } from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { LocalPlayer } from "../components.js";
import type { Polled } from "../../core/actions.js";

export interface Foe { e: Entity; pos: Vec3 }
export interface Eye { pos: Vec3; yaw: number }
type Way = "left" | "right" | "up" | "down";

const RETARGET: Partial<Record<Polled["pressed"][number], Way>> = {
  turnLeft: "left", turnRight: "right", lookUp: "up", lookDown: "down",
};
/** Enemies this close on screen (radians) are a tie, which goes to the one closer to the player. */
const RETARGET_TIE_RAD = 0.02;

export const livingFoes = ({ targets, world }: Fight): Foe[] =>
  targets.flatMap((e) =>
    world.require(e, Health).hp > 0 && !world.has(e, LocalPlayer) ? [{ e, pos: world.require(e, Body).pos }] : []);

export function closestFoe(foes: readonly Foe[], from: Vec3): Entity | null {
  let best: Foe | null = null;
  for (const foe of foes) if (!best || distXZ(foe.pos, from) < distXZ(best.pos, from)) best = foe;
  return best?.e ?? null;
}

/** Radians from the eye's facing: right of it, and above it. */
function onScreen(eye: Eye, p: Vec3): { x: number; y: number } {
  const dx = p.x - eye.pos.x, dz = p.z - eye.pos.z;
  const sin = Math.sin(eye.yaw), cos = Math.cos(eye.yaw);
  const x = Math.atan2(dx * cos - dz * sin, dx * sin + dz * cos);
  return { x, y: Math.atan2(p.y - eye.pos.y, Math.hypot(dx, dz)) };
}

export function retarget(target: Entity, foes: readonly Foe[], eye: Eye, way: Way, from: Vec3): Entity {
  const locked = foes.find((f) => f.e === target);
  if (!locked) return target;
  const at = onScreen(eye, locked.pos);
  const ways = foes.flatMap((foe) => {
    if (foe.e === target) return [];
    const seen = onScreen(eye, foe.pos);
    const dx = wrapAngle(seen.x - at.x), dy = seen.y - at.y;
    const ahead = way === "left" ? dx < 0 : way === "right" ? dx > 0 : way === "up" ? dy > 0 : dy < 0;
    return ahead ? [{ foe, gap: Math.hypot(dx, dy) }] : [];
  });
  if (ways.length === 0) return target;
  const nearest = Math.min(...ways.map((w) => w.gap));
  return closestFoe(ways.filter((w) => w.gap <= nearest + RETARGET_TIE_RAD).map((w) => w.foe), from)!;
}

/** `foes` are the living enemies: a target not among them has died. */
export function steerLock(
  target: Entity | null, pressed: Polled["pressed"], foes: readonly Foe[], eye: Eye, from: Vec3,
): Entity | null {
  let lock = foes.some((f) => f.e === target) ? target : null;
  for (const action of pressed) {
    const way = RETARGET[action];
    if (action === "lockOn") lock = lock === null ? closestFoe(foes, from) : null;
    else if (action === "lockClosest") lock = closestFoe(foes, from);
    else if (way && lock !== null) lock = retarget(lock, foes, eye, way, from);
  }
  return lock;
}

export function lockYaw(from: Vec3, to: Vec3): number | null {
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.hypot(dx, dz) < 1e-3 ? null : Math.atan2(dx, dz);
}
