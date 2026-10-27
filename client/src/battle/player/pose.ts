/** What the arena player's sprite, sword trail and stab show, from their action. No Babylon, so it's tested. */
import { CHAIN, isSwing, liveStep, FIXED_DT, type PlayerData, type SwingDir } from "@infinite-tower/shared";

/** The trail starts this long before the swing's blade goes live, and shows this long in all (seconds). */
const TRAIL_LEAD_TIME = 0.03;
const TRAIL_DURATION = 0.2;
/** The stab's thrust shows from a little before its blade goes live, out and back over this long (seconds). */
const THRUST_DURATION = 0.16;
/** A block shows raising the sword this long, then braced (seconds). */
const BLOCK_RAISE_TIME = 0.1;

/** Its frames: gfx/look/battle.ts. */
type PlayerPose =
  | "stand" | "down" | `swing-${SwingDir}` | "stab" | "block" | "stagger";

/** Each swing's way across the screen as the player sees it (x right, y up), from behind them or facing a foe. */
export const SCREEN_DIR: Record<SwingDir, { x: number; y: number }> = {
  lr: { x: 1, y: 0 }, rl: { x: -1, y: 0 }, tb: { x: 0, y: -1 }, bt: { x: 0, y: 1 },
  tlbr: { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, brtl: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  trbl: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, bltr: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
};

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
  player: PlayerData, alive: boolean, stretch: number, stagger = { left: 0, of: 0 },
): SpritePose {
  const attacking = player.action === "attack" && player.actionTime < player.startup + CHAIN.activeTime + 0.08;
  const pose: PlayerPose = !alive ? "down"
    : attacking ? (isSwing(player.attack) ? `swing-${player.attack}` : "stab")
    : player.action === "block" ? "block"
    : player.action === "stagger" ? "stagger"
    : "stand";
  const step = Math.round(player.actionTime / FIXED_DT), live = liveStep(player.startup);
  const frame = pose === "block" ? (player.actionTime < BLOCK_RAISE_TIME ? 0 : 1)
    : pose === "stagger" ? (stagger.left > stagger.of / 2 ? 0 : 1)
    : !attacking || !alive ? 0
    : step < live ? 0 : step < live + liveStep(CHAIN.activeTime) ? 1 : 2;
  return { pose, frame, scaleX: 1 / stretch, scaleY: stretch };
}

export interface TrailPose {
  /** The cut's line on screen, turned from flat (across): positive tips its right end up. */
  rollRad: number;
  /** The end of the line it grows from: 1 its right end, -1 its left. */
  from: 1 | -1;
  /** How far it has grown toward the other end, 0..1. */
  reach: number;
  visibility: number;
}

/** The trail's line and the end it starts from (+1: the right end), from the swing's way across the screen. */
function trailLine(dir: SwingDir): { rollRad: number; from: 1 | -1 } {
  const { x, y } = SCREEN_DIR[dir];
  const angle = Math.atan2(y, x);
  // Fold the angle into (-90°, 90°]: the line's right end; a swing going leftward starts from that end.
  if (angle > Math.PI / 2 + 1e-9) return { rollRad: angle - Math.PI, from: 1 };
  if (angle <= -Math.PI / 2 + 1e-9) return { rollRad: angle + Math.PI, from: 1 };
  return { rollRad: angle, from: -1 };
}

/**
 * The sword trail: a cut across the view in front of the player, along the swing's line, growing from where the
 * swing starts to where it ends, the way the swing goes on screen. Null when it isn't showing.
 */
export function trailPose(player: PlayerData): TrailPose | null {
  if (player.action !== "attack" || !isSwing(player.attack)) return null;
  const liveTime = liveStep(player.startup) * FIXED_DT;
  const progress = (player.actionTime - (liveTime - TRAIL_LEAD_TIME)) / TRAIL_DURATION;
  if (progress < 0 || progress >= 1) return null;
  return { ...trailLine(player.attack), reach: Math.min(1, progress * 2.2), visibility: 1 - progress * progress };
}

export interface ThrustPose {
  /** How far out it is, 0..1 of its reach. */
  reach: number;
  visibility: number;
}

/** The stab: a streak thrust straight out along the aim and drawn back. Null when it isn't showing. */
export function thrustPose(player: PlayerData): ThrustPose | null {
  if (player.action !== "attack" || isSwing(player.attack)) return null;
  const liveTime = liveStep(player.startup) * FIXED_DT;
  const progress = (player.actionTime - (liveTime - TRAIL_LEAD_TIME)) / THRUST_DURATION;
  if (progress < 0 || progress >= 1) return null;
  return { reach: Math.min(1, progress * 3), visibility: 1 - progress * progress };
}
