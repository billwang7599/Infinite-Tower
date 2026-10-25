/**
 * Where the title's camera is through the sequence (sequence.ts):
 *
 *   menu, fade: back from the tower, which stands to the right of the title text, the horizon low.
 *   approach:   turns to the tower and glides in through its glass, to the middle of the ground storey.
 *   lookUp:     tilts up from there until it looks straight up the shaft, which goes up forever.
 *   rush:       rises up the shaft, faster and faster, turning, the view widening; flash goes on with it.
 *   rushOut:    the rush backwards: falling, slowing, stopping at the bottom. pullBack: looks down, backs out.
 *
 * Every stage starts where the one before it ended, so the camera never jumps.
 */
import { stageMs, type Stage } from "../sequence.js";
import { lerp, lerp3, type Pose } from "./space.js";

/** Where the tower is across the title's screen, and the horizon down it (fractions). */
const TOWER_ACROSS = 0.71;
const HORIZON_DOWN = 0.62;
const TITLE = { pos: [0, 1.4, -6.8], fovDeg: 55 } as const;
const INSIDE: Pose = { pos: [0, 0.5, 0], yaw: 0, pitch: 0, roll: 0, fovDeg: 68 };
/** The rush's top speed (units/s, a storey is 1), how long it takes to reach it, its turning, its widest view. */
const RUSH = { topSpeed: 12, toTopS: 1.5, turnPerS: 0.9, fovDeg: 98 };
/** The share of the pull back spent looking down; the rest backs out of the tower. */
const LOOK_DOWN_SHARE = 0.45;

export interface Shot {
  pose: Pose;
  /** How fast the camera is climbing, units/s (for the streaks). */
  speed: number;
}

/** The title's view on a screen `aspect` (width / height): the tower at TOWER_ACROSS, the horizon at HORIZON_DOWN. */
export function titlePose(aspect: number): Pose {
  const halfFov = Math.tan((TITLE.fovDeg * Math.PI) / 360);
  return {
    pos: TITLE.pos,
    yaw: -Math.atan((TOWER_ACROSS - 0.5) * 2 * aspect * halfFov),
    pitch: Math.atan((HORIZON_DOWN - 0.5) * 2 * halfFov),
    roll: 0,
    fovDeg: TITLE.fovDeg,
  };
}

/** The shot `sinceStageS` seconds into `stage`, `sinceRushS` seconds since the rush began. */
export function shotAt(stage: Stage, sinceStageS: number, sinceRushS: number, aspect: number): Shot {
  const u = Math.min(1, Math.max(0, sinceStageS / (stageMs(stage) / 1000 || 1)));
  const title = titlePose(aspect);
  switch (stage) {
    case "approach":
      return still(approach(title, u));
    case "lookUp":
      return still(lookUp(u));
    case "rush":
    case "flash":
      return rush(sinceRushS);
    case "rushOut": {
      const fall = rush((stageMs("rushOut") / 1000) * (1 - u));
      return { ...fall, speed: -fall.speed };
    }
    case "pullBack":
      return still(u < LOOK_DOWN_SHARE
        ? lookUp(1 - u / LOOK_DOWN_SHARE)
        : approach(title, 1 - (u - LOOK_DOWN_SHARE) / (1 - LOOK_DOWN_SHARE)));
    default:
      return still(title);
  }
}

const still = (pose: Pose): Shot => ({ pose, speed: 0 });
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** From the title's view (u 0) to the middle of the ground storey, looking ahead (u 1). */
function approach(title: Pose, u: number): Pose {
  const e = easeInOut(u);
  return {
    pos: lerp3(title.pos, INSIDE.pos, e),
    // Turns to face the tower early, then glides at it.
    yaw: lerp(title.yaw, 0, easeOut(Math.min(1, u * 1.5))),
    pitch: lerp(title.pitch, 0, e),
    roll: 0,
    fovDeg: lerp(title.fovDeg, INSIDE.fovDeg, e),
  };
}

/** In the middle of the ground storey, from looking ahead (u 0) to straight up (u 1). */
function lookUp(u: number): Pose {
  return { ...INSIDE, pitch: lerp(0, Math.PI / 2, easeInOut(u)) };
}

/** `s` seconds up the shaft: speeding up evenly to the top speed, then holding it. */
function rush(s: number): Shot {
  const t = Math.max(0, s);
  const ramp = Math.min(t, RUSH.toTopS);
  const along = (top: number) => (top / RUSH.toTopS) * ramp * ramp / 2 + top * (t - ramp);
  return {
    pose: {
      ...INSIDE,
      pos: [0, INSIDE.pos[1] + along(RUSH.topSpeed), 0],
      pitch: Math.PI / 2,
      roll: along(RUSH.turnPerS),
      fovDeg: lerp(INSIDE.fovDeg, RUSH.fovDeg, easeInOut(ramp / RUSH.toTopS)),
    },
    speed: (RUSH.topSpeed * ramp) / RUSH.toTopS,
  };
}
