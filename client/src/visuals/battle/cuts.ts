import type { CutsData, Stance, Vec3 } from "@infinite-tower/shared";
import { REST_BLADE, type BladePose } from "./weapons.js";

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** `handY` (m): Vom Tag lifts the hilt over the shoulder, Ochs by the head, Pflug and Alber drop it to the hip. */
export const STANCE_BLADES: Record<Stance, BladePose> = {
  "vom-tag": { blade: norm({ x: 0.35, y: 0.9, z: -0.35 }), handZ: 0.05, handY: 0.35 },
  ochs: { blade: norm({ x: -0.3, y: -0.05, z: 0.95 }), handZ: REST_BLADE.handZ, handY: 0.45 },
  pflug: { blade: norm({ x: -0.15, y: 0.65, z: 0.75 }), handZ: REST_BLADE.handZ, handY: -0.2 },
  alber: { blade: norm({ x: -0.1, y: -0.8, z: 0.55 }), handZ: REST_BLADE.handZ, handY: -0.1 },
};

export const guardBlade = (cuts: CutsData): BladePose => STANCE_BLADES[cuts.to];
