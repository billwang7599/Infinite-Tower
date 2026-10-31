import {
  sideOfWay, type AttackKind, type GuardSide, type PlayerAction, type PlayerData, type SwingData, type Vec2,
  type Vec3, type Way, type WielderData,
} from "@infinite-tower/shared";
import type { BattleFacing } from "../../gfx/look/art.js";
import type { SwordPose } from "../../gfx/look/battle.js";
import {
  cutOf, drawnBack, GRAB_BLADE, pullOf, REELING_BLADE, REST_BLADE, strokeOf, swingCut, swingFrame, wayCut,
  type Cut, type WeaponMotion,
} from "./weapons.js";

const ATTACK_POSES: Record<AttackKind, Record<GuardSide, SwordPose>> = {
  light: { left: "swing-lr", top: "swing-tb", right: "swing-rl" },
  heavy: { left: "swing-tlbr", top: "swing-tb", right: "swing-trbl" },
};
const WAY_POSES: Record<Way, SwordPose> = {
  lr: "swing-lr", rl: "swing-rl", tb: "swing-tb", bt: "swing-tb", tlbr: "swing-tlbr", trbl: "swing-trbl",
  bltr: "swing-lr", brtl: "swing-rl", stab: "swing-tb",
};
const GUARD_POSES: Record<GuardSide, SwordPose> = { left: "guard-left", top: "guard-top", right: "guard-right" };
export const STAGGERED: readonly PlayerAction[] = ["recoil", "stagger", "grabbed"];
const REACHING: readonly PlayerAction[] = ["grab", "kick"];

const swingPose = (swing: SwingData): SwordPose =>
  swing.way ? WAY_POSES[swing.way] : ATTACK_POSES[swing.attack][swing.side];

function stanceOf(player: PlayerData): GuardSide | null {
  if (player.guard) return player.guard;
  if (player.action === "block") return "top";
  return player.way && sideOfWay(player.way);
}

function stanceCut(player: PlayerData): Cut | null {
  if (player.guard) return cutOf("light", player.guard, true);
  if (player.action === "block") return cutOf("light", "top", true);
  return player.way && wayCut(player.way, true);
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
 * with (the player's actionTime stands still while recoiling).
 */
export function spritePose(
  player: PlayerData, { swing }: Pick<WielderData, "swing">, alive: boolean, stretch: number,
  stagger = { left: 0, of: 0 },
): SpritePose {
  const attacking = swing !== null && swing.step < swing.endAt;
  const stance = stanceOf(player);
  const pose: PlayerPose = !alive ? "down"
    : attacking ? swingPose(swing)
    : STAGGERED.includes(player.action) ? "stagger"
    : REACHING.includes(player.action) ? "grab"
    : stance ? GUARD_POSES[stance]
    : "stand";
  const frame = pose === "stagger" ? (player.action === "grabbed" || stagger.left > stagger.of / 2 ? 0 : 1)
    : attacking && alive ? swingFrame(swing)
    : 0;
  return { pose, frame, scaleX: 1 / stretch, scaleY: stretch };
}

/** A share of DRAWBACK: the camera looks along it, and all the way back the blade would point at it. */
const SPRITE_DRAWBACK = 0.5;
const DROPPED_BLADE: Vec3 = { x: 0.9, y: 0, z: Math.sqrt(1 - 0.9 ** 2) };

export function playerBlade(
  player: PlayerData, { swing }: Pick<WielderData, "swing">, alive: boolean, motion: WeaponMotion,
): { blade: Vec3; exact: boolean } {
  if (!alive) return { blade: DROPPED_BLADE, exact: false };
  if (STAGGERED.includes(player.action)) return { blade: REELING_BLADE, exact: false };
  if (REACHING.includes(player.action)) return { blade: GRAB_BLADE, exact: false };
  const stance = stanceCut(player), held = stance ? motion.held(stance) : REST_BLADE;
  if (!swing || swing.step >= swing.endAt) return { blade: held.blade, exact: false };
  const cut = swingCut(swing, true), stroke = strokeOf(swing);
  const { blade } = stroke.set < 1 ? motion.windup(cut, stroke.set, held) : motion.stroke(cut, stroke.turn);
  const pull = pullOf(stroke, swing.attack === "heavy") * SPRITE_DRAWBACK;
  return { blade: drawnBack(blade, pull), exact: stroke.set >= 1 };
}

/** How far past side-on the camera goes before the sprite turns round, so side-on it doesn't flicker. */
export const TURN_MARGIN_RAD = 0.15;

export function facingSeen(eye: Vec2, at: Vec2, aim: Vec2, was: BattleFacing): BattleFacing {
  const dx = eye.x - at.x, dz = eye.z - at.z;
  const cos = (dx * aim.x + dz * aim.z) / (Math.hypot(dx, dz) * Math.hypot(aim.x, aim.z) || 1);
  const margin = Math.sin(TURN_MARGIN_RAD);
  return cos > margin ? "front" : cos < -margin ? "back" : was;
}
