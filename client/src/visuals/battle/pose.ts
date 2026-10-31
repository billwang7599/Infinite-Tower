import type { AttackKind, GuardSide, PlayerAction, PlayerData, Vec2, WielderData } from "@infinite-tower/shared";
import type { BattleFacing } from "../../gfx/look/art.js";
import type { SwordPose } from "../../gfx/look/battle.js";
import { swingFrame } from "./weapons.js";

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

/** How far past side-on the camera goes before the sprite turns round, so side-on it doesn't flicker. */
export const TURN_MARGIN_RAD = 0.15;

export function facingSeen(eye: Vec2, at: Vec2, aim: Vec2, was: BattleFacing): BattleFacing {
  const dx = eye.x - at.x, dz = eye.z - at.z;
  const cos = (dx * aim.x + dz * aim.z) / (Math.hypot(dx, dz) * Math.hypot(aim.x, aim.z) || 1);
  const margin = Math.sin(TURN_MARGIN_RAD);
  return cos > margin ? "front" : cos < -margin ? "back" : was;
}
