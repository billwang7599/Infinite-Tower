import { TransformNode } from "@babylonjs/core";
import {
  Body, clamp, lineMoveSteps, ONE_STRIKE, OneStrike, toSteps, weaponItemIn, Wielder, type Entity, type Line,
  type OneStrikeData, type SwingData, type Vec3, type World,
} from "@infinite-tower/shared";
import { dropBlade, holdBlade, type HeldBlade } from "./blade.js";
import type { ArenaScene } from "./scene.js";
import { lerpBlade, REST_BLADE, type BladePose } from "./weapons.js";

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

export const LINE_BLADES: Record<Line, Vec3> = {
  high: norm({ x: -0.3, y: 0.75, z: 0.6 }),
  middle: norm({ x: -0.35, y: 0.05, z: 0.95 }),
  low: norm({ x: -0.25, y: -0.75, z: 0.6 }),
};
/** How far (m) a 3D model lifts its hand for each line: the hilt by the head, at the waist, at the hip. */
const LINE_HAND_Y: Record<Line, number> = { high: 0.45, middle: 0, low: -0.2 };
const KNOCKED_BLADE = norm({ x: 0.85, y: -0.2, z: 0.45 });
const BEAT_COCKED = norm({ x: 0.65, y: 0.25, z: 0.7 });
/** A thrust's hand (handZ, m): drawn in as it winds up, driven out as it goes live. */
const THRUST_HAND = { drawnZ: -0.12, outZ: 0.55 };

export interface StrikePose extends BladePose { exact: boolean }

const smooth = (s: number): number => s * s * (3 - 2 * s);

export function strikeBlade(blade: OneStrikeData, swing: SwingData | null, heft: number): StrikePose {
  const rest = REST_BLADE.handZ;
  if (blade.offLineSteps > 0) return { blade: KNOCKED_BLADE, handZ: rest, exact: false };
  if (swing?.line) {
    const on = LINE_BLADES[swing.line], handY = LINE_HAND_Y[swing.line], { drawnZ, outZ } = THRUST_HAND;
    const { step, liveAt, liveUntil, endAt } = swing;
    if (step < liveAt) return { blade: on, handZ: rest + (drawnZ - rest) * smooth(step / liveAt), handY, exact: false };
    if (step < liveUntil) return { blade: on, handZ: outZ, handY, exact: true };
    const back = clamp((step - liveUntil) / Math.max(1, endAt - liveUntil), 0, 1);
    return { blade: on, handZ: outZ + (rest - outZ) * back, handY, exact: false };
  }
  const moved = blade.moveSteps > 0 ? smooth(1 - blade.moveSteps / lineMoveSteps(heft)) : 0;
  const from = LINE_BLADES[blade.line], to = LINE_BLADES[blade.to];
  const at = moved > 0 ? lerpBlade(from, to, moved) : from;
  const handY = LINE_HAND_Y[blade.line] + (LINE_HAND_Y[blade.to] - LINE_HAND_Y[blade.line]) * moved;
  if (blade.beatStep === null) return { blade: at, handZ: rest, handY, exact: false };
  const k = clamp(blade.beatStep / toSteps(ONE_STRIKE.beat.windupTime * heft), 0, 1);
  return { blade: lerpBlade(at, BEAT_COCKED, Math.sin(Math.PI * k)), handZ: rest, handY, exact: false };
}

const FLY_TIME = 0.35;
const FLY_ARC_M = 0.9;
const SPIN_RAD_PER_SEC = 18;
const LIE_ABOVE_FLOOR_M = 0.03;
const FLOOR_PROBE_M = 5;

interface Loose { node: TransformNode; held: HeldBlade; from: Vec3; ageTime: number }

export function looseBlades(ctx: ArenaScene): { frame(world: World, dt: number): void } {
  const shown = new Map<Entity, Loose>();
  let was: World | null = null;
  const drop = (e: Entity) => {
    const loose = shown.get(e)!;
    dropBlade(loose.held);
    loose.node.dispose();
    shown.delete(e);
  };
  return {
    frame(world, dt) {
      if (world !== was) for (const e of [...shown.keys()]) drop(e);
      was = world;
      for (const e of [...shown.keys()]) if (!world.get(e, OneStrike)?.loose) drop(e);
      for (const [e, blade] of world.query(OneStrike)) {
        const at = blade.loose, weapon = weaponItemIn(world.require(e, Wielder).hands);
        if (!at || !weapon) continue;
        let loose = shown.get(e);
        if (!loose) {
          const node = new TransformNode(`loose-blade-${e}`, ctx.scene);
          const held = holdBlade(ctx, e, node, weapon, 0);
          held.hand.rotation.z = Math.PI / 2;
          shown.set(e, loose = { node, held, from: { ...world.require(e, Body).pos }, ageTime: 0 });
        }
        loose.ageTime += dt;
        const k = clamp(loose.ageTime / FLY_TIME, 0, 1);
        const below = ctx.battle.fight?.physics.floorBelow(at.x, FLOOR_PROBE_M, at.z, 2 * FLOOR_PROBE_M);
        const floorY = FLOOR_PROBE_M - (below ?? FLOOR_PROBE_M) + LIE_ABOVE_FLOOR_M;
        const { from } = loose, arc = Math.sin(Math.PI * k) * FLY_ARC_M;
        loose.node.position.set(
          from.x + (at.x - from.x) * k, from.y + (floorY - from.y) * k + arc, from.z + (at.z - from.z) * k,
        );
        if (k < 1) loose.node.rotation.y += SPIN_RAD_PER_SEC * (1 - k) * dt;
      }
    },
  };
}
