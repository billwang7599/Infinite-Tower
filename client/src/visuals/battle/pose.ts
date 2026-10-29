import {
  isSwing, SCREEN_DIR, SWING_DIRS, type Blade, type PlayerData, type SwingDir, type Vec2, type WielderData,
} from "@infinite-tower/shared";
import type { BattleFacing } from "../../gfx/look/art.js";
import { swingFrame } from "./weapons.js";

/** A block shows raising the sword this long, then braced (seconds). */
const BLOCK_RAISE_TIME = 0.1;

/** Further out than this, the blade at rest is drawn as held where its swing left it. */
const HELD_OUT = 0.5;
const FOLLOW_THROUGH_FRAME = 2;

function heldOut(blade: Blade): SwingDir | null {
  if (Math.hypot(blade.x, blade.y) < HELD_OUT) return null;
  const along = (dir: SwingDir) => SCREEN_DIR[dir].x * blade.x + SCREEN_DIR[dir].y * blade.y;
  return SWING_DIRS.reduce((best, dir) => (along(dir) > along(best) ? dir : best));
}

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
  player: PlayerData, { swing, blade }: Pick<WielderData, "swing" | "blade">, alive: boolean, stretch: number,
  stagger = { left: 0, of: 0 },
): SpritePose {
  const attacking = swing !== null && swing.step < swing.endAt, out = heldOut(blade);
  const pose: PlayerPose = !alive ? "down"
    : attacking ? (isSwing(swing.attack) ? `swing-${swing.attack}` : "stab")
    : player.action === "block" ? "block"
    : player.action === "stagger" ? "stagger"
    : out ? `swing-${out}`
    : "stand";
  const frame = pose === "block" ? (player.actionTime < BLOCK_RAISE_TIME ? 0 : 1)
    : pose === "stagger" ? (stagger.left > stagger.of / 2 ? 0 : 1)
    : !alive ? 0
    : attacking ? swingFrame(swing)
    : out ? FOLLOW_THROUGH_FRAME
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
