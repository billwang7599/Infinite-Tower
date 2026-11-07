import type { PlayerAction, PlayerData, SwingData, Vec2, Vec3, Way, WielderData } from "@infinite-tower/shared";
import type { BattleFacing } from "../../gfx/look/art.js";
import type { SwordPose } from "../../gfx/look/battle.js";
import {
  drawnBack, pullOf, REELING_BLADE, REST_BLADE, strokeOf, swingFrame, wayCut, type Cut,
  type WeaponMotion,
} from "./weapons.js";

const WAY_POSES: Record<Way, SwordPose> = {
  lr: "swing-lr", rl: "swing-rl", tb: "swing-tb", tlbr: "swing-tlbr", trbl: "swing-trbl",
  bltr: "swing-lr", brtl: "swing-rl", stab: "swing-tb",
};
const HELD_POSES: Record<Way, SwordPose> = {
  lr: "guard-left", tlbr: "guard-left", bltr: "guard-left", rl: "guard-right", trbl: "guard-right",
  brtl: "guard-right", tb: "guard-top", stab: "guard-top",
};
export const STAGGERED: readonly PlayerAction[] = ["stagger"];

type Held = Pick<PlayerData, "action" | "way">;

const stanceOf = (player: Held): Way | null => (player.action === "block" ? "tb" : player.way);

function stanceCut(player: Held): Cut | null {
  const stance = stanceOf(player);
  return stance && wayCut(stance, true);
}

/** Its frames: gfx/look/battle.ts. */
type PlayerPose = "stand" | "down" | SwordPose;

export interface SpritePose {
  pose: PlayerPose;
  /** Which of its frames. */
  frame: number;
  /** Squash and stretch only: it's never mirrored. */
  scaleX: number;
  scaleY: number;
}

/**
 * `stretch`: the smoothed squash / stretch factor (sprite.ts). `stagger`: its hitstun left, of how much it began
 * with (the player's actionTime stands still while staggered).
 */
export function spritePose(
  player: Held, { swing }: Pick<WielderData, "swing">, alive: boolean, stretch: number,
  stagger = { left: 0, of: 0 },
): SpritePose {
  const attacking = swing !== null && swing.step < swing.endAt;
  const stance = stanceOf(player);
  const pose: PlayerPose = !alive ? "down"
    : attacking ? WAY_POSES[swing.way]
    : STAGGERED.includes(player.action) ? "stagger"
    : stance ? HELD_POSES[stance]
    : "stand";
  const frame = pose === "stagger" ? (stagger.left > stagger.of / 2 ? 0 : 1)
    : attacking && alive ? swingFrame(swing)
    : 0;
  return { pose, frame, scaleX: 1 / stretch, scaleY: stretch };
}

export const SPRITE_SIZE = 1.8;

/** A share of DRAWBACK: the camera looks along it, and all the way back the blade would point at it. */
const SPRITE_DRAWBACK = 0.5;
const DROPPED_BLADE: Vec3 = { x: 0.9, y: 0, z: Math.sqrt(1 - 0.9 ** 2) };

export function playerBlade(
  player: Held, { swing }: Pick<WielderData, "swing">, alive: boolean, motion: WeaponMotion,
  drawback = SPRITE_DRAWBACK, strokeAt: (swing: SwingData) => { set: number; turn: number } = strokeOf,
): { blade: Vec3; handBlade: Vec3; exact: boolean; handZ: number } {
  const still = (blade: Vec3, handZ = REST_BLADE.handZ) => ({ blade, handBlade: blade, exact: false, handZ });
  if (!alive) return still(DROPPED_BLADE);
  if (STAGGERED.includes(player.action)) return still(REELING_BLADE);
  const stance = stanceCut(player), held = stance ? motion.held(stance) : motion.rest;
  if (!swing || swing.step >= swing.endAt) return still(held.blade, held.handZ);
  const cut = wayCut(swing.way, true), stroke = strokeAt(swing);
  const { blade, handZ } = stroke.set < 1 ? motion.windup(cut, stroke.set, held) : motion.stroke(cut, stroke.turn);
  const pull = pullOf(stroke, swing.attack === "heavy") * drawback;
  return { blade: drawnBack(blade, pull), handBlade: blade, exact: stroke.set >= 1, handZ };
}

/** How far past side-on the camera goes before the sprite turns round, so side-on it doesn't flicker. */
export const TURN_MARGIN_RAD = 0.15;

export function facingSeen(eye: Vec2, at: Vec2, aim: Vec2, was: BattleFacing): BattleFacing {
  const dx = eye.x - at.x, dz = eye.z - at.z;
  const cos = (dx * aim.x + dz * aim.z) / (Math.hypot(dx, dz) * Math.hypot(aim.x, aim.z) || 1);
  const margin = Math.sin(TURN_MARGIN_RAD);
  return cos > margin ? "front" : cos < -margin ? "back" : was;
}
