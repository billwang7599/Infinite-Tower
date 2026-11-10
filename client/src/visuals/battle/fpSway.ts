import { clamp, damp, PLAYER, wrapAngle, type Vec3 } from "@infinite-tower/shared";

// Metres from where the arms are posed, in the eye's frame (x right, y up, z ahead); the arms are about 0.6 m off.
export const FP_SWAY = {
  bobM: { x: 0.012, y: 0.01 }, breathM: 0.003, breathTime: 3.4, lagM: 0.03, lagPerRadPerSec: 0.012,
  fullSpeed: PLAYER.moveSpeed, walkRate: 8, freeRate: 10, lagRate: 12, maxTurnRadPerSec: 8,
} as const;

export interface FpSway {
  walk: number;
  free: number;
  lag: { x: number; y: number };
  view: { yaw: number; pitch: number } | null;
  time: number;
}

export const newFpSway = (): FpSway => ({ walk: 0, free: 1, lag: { x: 0, y: 0 }, view: null, time: 0 });

/**
 * `free`: nothing being done with the arms (no swing, guard, dodge or use); `speed` m/s along the ground;
 * `stridePhase` the body's walk, 2π a stride.
 */
export interface SwayInput {
  speed: number; stridePhase: number; grounded: boolean; free: boolean; yaw: number; pitch: number;
}

export function swayArms(s: FpSway, o: SwayInput, dt: number): Vec3 {
  const { bobM, fullSpeed, lagPerRadPerSec, lagM, maxTurnRadPerSec } = FP_SWAY;
  s.time += dt;
  s.walk = damp(s.walk, o.grounded ? clamp(o.speed / fullSpeed, 0, 1) : 0, FP_SWAY.walkRate, dt);
  s.free = damp(s.free, o.free ? 1 : 0, FP_SWAY.freeRate, dt);
  const turn = (to: number, from: number | undefined) => {
    const rate = from === undefined || dt <= 0 ? 0 : wrapAngle(to - from) / dt;
    // Faster than any mouse turns, the view jumped (a new fight): nothing to trail.
    return Math.abs(rate) > maxTurnRadPerSec ? 0 : clamp(rate * lagPerRadPerSec, -lagM, lagM);
  };
  const yawLag = -turn(o.yaw, s.view?.yaw), pitchLag = turn(o.pitch, s.view?.pitch);
  s.view = { yaw: o.yaw, pitch: o.pitch };
  s.lag.x = damp(s.lag.x, yawLag, FP_SWAY.lagRate, dt);
  s.lag.y = damp(s.lag.y, pitchLag, FP_SWAY.lagRate, dt);
  const breath = FP_SWAY.breathM * Math.sin((2 * Math.PI * s.time) / FP_SWAY.breathTime);
  const bob = s.walk * s.free;
  return {
    x: s.free * s.lag.x + bob * bobM.x * Math.sin(o.stridePhase),
    y: s.free * s.lag.y + bob * bobM.y * -0.5 * (1 - Math.cos(2 * o.stridePhase)) + (1 - s.walk) * s.free * breath,
    z: 0,
  };
}
