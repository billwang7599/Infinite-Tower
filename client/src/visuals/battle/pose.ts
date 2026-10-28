import { isSwing, type PlayerData, type SwingData, type SwingDir } from "@infinite-tower/shared";
import { swingFrame } from "./weapons.js";

/** A block shows raising the sword this long, then braced (seconds). */
const BLOCK_RAISE_TIME = 0.1;

/** Its frames: gfx/look/battle.ts. */
type PlayerPose =
  | "stand" | "down" | `swing-${SwingDir}` | "stab" | "block" | "stagger";

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
  player: PlayerData, swing: SwingData | null, alive: boolean, stretch: number, stagger = { left: 0, of: 0 },
): SpritePose {
  const attacking = swing !== null && swing.step < swing.endAt;
  const pose: PlayerPose = !alive ? "down"
    : attacking ? (isSwing(swing.attack) ? `swing-${swing.attack}` : "stab")
    : player.action === "block" ? "block"
    : player.action === "stagger" ? "stagger"
    : "stand";
  const frame = pose === "block" ? (player.actionTime < BLOCK_RAISE_TIME ? 0 : 1)
    : pose === "stagger" ? (stagger.left > stagger.of / 2 ? 0 : 1)
    : !attacking || !alive ? 0
    : swingFrame(swing);
  return { pose, frame, scaleX: 1 / stretch, scaleY: stretch };
}
