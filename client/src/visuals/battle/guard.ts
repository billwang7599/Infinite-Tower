import type { GuardKind, Vec3 } from "@infinite-tower/shared";
import { edgeToward } from "./weapons.js";

interface Held { blade: Vec3; edge: Vec3 }
export interface GuardPose { offHand: Vec3; off?: Held; hand?: Vec3; blade?: Vec3; edge?: Vec3 }
export interface GuardFit { y: number; z: number }

const UP: Vec3 = { x: 0, y: 1, z: 0 }, AHEAD: Vec3 = { x: 0, y: 0, z: 1 };
const unit = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};
const along = (p: Vec3, d: Vec3, m: number): Vec3 => ({ x: p.x + d.x * m, y: p.y + d.y * m, z: p.z + d.z * m });
const cross = (a: Vec3, b: Vec3): Vec3 =>
  ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const shieldFacing = (face: Vec3): Held => ({ blade: UP, edge: unit(cross(UP, face)) });

// m for the right hand from the fit; edges out, crossed blades are a width apart.
export const BLOCK = {
  one: { hand: { x: 0.19, y: 0.075, z: 0.24 }, blade: { x: -1, y: 0.12, z: 0.2 }, supportM: 0.45, underM: 0.04 },
  dual: { hand: { x: 0.14, y: -0.06, z: 0.26 }, blade: { x: -0.5, y: 0.8, z: 0.33 }, crossM: 0.11 },
  shield: { hand: { x: -0.08, y: 0.04, z: 0.3 } },
} as const;

export function guardPose(kind: GuardKind, side: 1 | -1, fit: GuardFit): GuardPose {
  const at = ({ x, y, z }: Vec3): Vec3 => ({ x: side * x, y: fit.y + y, z: fit.z + z });
  const turned = ({ x, y, z }: Vec3): Vec3 => unit({ x: side * x, y, z });
  if (kind === "shield") return { offHand: at(BLOCK.shield.hand), off: shieldFacing(AHEAD) };
  if (kind === "one") {
    const { hand, blade, supportM, underM } = BLOCK.one, way = turned(blade);
    const down = unit({ x: way.x * way.y, y: way.y * way.y - 1, z: way.z * way.y }), held = at(hand);
    return { hand: held, blade: way, edge: edgeToward(way), offHand: along(along(held, way, supportM), down, underM) };
  }
  const { hand, blade, crossM } = BLOCK.dual, main = turned(blade), off = turned({ ...blade, x: -blade.x });
  const apart = unit(cross(main, off)), out = apart.z < 0 ? -crossM / 2 : crossM / 2;
  return {
    hand: along(at(hand), apart, out), blade: main, edge: edgeToward(main),
    offHand: along(at({ ...hand, x: -hand.x }), apart, -out), off: { blade: off, edge: edgeToward(off) },
  };
}

