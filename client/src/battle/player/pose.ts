/**
 * What the arena player's sprite and sword trail show, worked out from their action. No Babylon here, so it's
 * unit-tested; sprite.ts puts it on the meshes.
 */
import { PLAYER, type PlayerData } from "@infinite-tower/shared";
import type { Materials } from "../materials.js";

/** The trail starts this long before the swing's hitbox does, and shows this long in all (seconds). */
const TRAIL_LEAD_TIME = 0.03;
const TRAIL_DURATION = 0.2;
/** The trail sweeps from this far to our right of the aim to as far to our left (radians), tilted a little. */
const TRAIL_SWEEP_RAD = 0.7;
const TRAIL_TILT_RAD = 0.22;

export type SpriteFrame = keyof Materials["player"];

export interface SpritePose {
  frame: SpriteFrame;
  /** The quad's scale: squash and stretch only. It's never mirrored (a negative x would). */
  scaleX: number;
  scaleY: number;
}

/** `stretch`: the smoothed squash / stretch factor (sprite.ts). */
export function spritePose(player: PlayerData, alive: boolean, stretch: number): SpritePose {
  // We always see the player from behind, so the sprite never turns or mirrors. The slash frame has the sword arm
  // out to our right, where every swing's trail starts.
  const swinging = player.action === "slash" && player.actionTime < PLAYER.slash.duration * 0.8;
  const frame = !alive ? "down" : swinging ? "slash" : "idle";
  return { frame, scaleX: 1 / stretch, scaleY: stretch };
}

export interface TrailPose {
  /** Turned this far from the aim (radians); positive is to our right. */
  yawRad: number;
  tiltRad: number;
  visibility: number;
}

/**
 * The sword trail, a crescent that sweeps across the aim from our right to our left, the same on every swing.
 * Null when it isn't showing.
 */
export function trailPose(player: PlayerData): TrailPose | null {
  if (player.action !== "slash") return null;
  const progress = (player.actionTime - (PLAYER.slash.windup - TRAIL_LEAD_TIME)) / TRAIL_DURATION;
  if (progress < 0 || progress >= 1) return null;
  const sweep = Math.min(1, progress * 2.2);
  return { yawRad: TRAIL_SWEEP_RAD * (1 - 2 * sweep), tiltRad: TRAIL_TILT_RAD, visibility: 1 - progress * progress };
}
