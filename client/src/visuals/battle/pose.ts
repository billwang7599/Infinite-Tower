import type {
  AttackKind, GuardSide, PlayerAction, PlayerData, Vec2, Vec3, WielderData,
} from "@infinite-tower/shared";
import type { BattleFacing } from "../../gfx/look/art.js";
import type { SwordPose } from "../../gfx/look/battle.js";
import {
  cutOf, drawnBack, GRAB_BLADE, pullOf, REELING_BLADE, REST_BLADE, strokeOf, swingFrame, type WeaponMotion,
} from "./weapons.js";

const ATTACK_POSES: Record<AttackKind, Record<GuardSide, SwordPose>> = {
  light: { left: "swing-lr", top: "swing-tb", right: "swing-rl" },
  heavy: { left: "swing-tlbr", top: "swing-tb", right: "swing-trbl" },
};
const GUARD_POSES: Record<GuardSide, SwordPose> = { left: "guard-left", top: "guard-top", right: "guard-right" };
export const STAGGERED: readonly PlayerAction[] = ["recoil", "stagger", "grabbed"];

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
  const pose: PlayerPose = !alive ? "down"
    : attacking ? ATTACK_POSES[swing.attack][swing.side]
    : STAGGERED.includes(player.action) ? "stagger"
    : player.action === "grab" ? "grab"
    : player.guard ? GUARD_POSES[player.guard]
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
  if (player.action === "grab") return { blade: GRAB_BLADE, exact: false };
  const held = player.guard ? motion.held(cutOf("light", player.guard, true)) : REST_BLADE;
  if (!swing || swing.step >= swing.endAt) return { blade: held.blade, exact: false };
  const cut = cutOf(swing.attack, swing.side, true), stroke = strokeOf(swing);
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
