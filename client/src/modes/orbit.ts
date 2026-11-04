import type { Vec3 } from "@infinite-tower/shared";

// Turn rates at 100% sensitivity, in the arena and the overworld; Settings → Camera scales them (settings/camera.ts).
export const TURN = { yawRadPerSec: 2.6, pitchRadPerSec: 1.4, mouseRadPerPx: 0.0025 } as const;

export function turnBy(
  keys: { turn: number; look: number }, drag: { dx: number; dy: number }, dt: number, sensitivity: number,
): { yaw: number; pitch: number } {
  return {
    yaw: (keys.turn * TURN.yawRadPerSec * dt + drag.dx * TURN.mouseRadPerPx) * sensitivity,
    pitch: (keys.look * TURN.pitchRadPerSec * dt + drag.dy * TURN.mouseRadPerPx) * sensitivity,
  };
}

/** From the pivot toward the eye. Yaw 0 looks along +z; pitch is the eye's angle above the pivot, with no limit. */
export const orbitBack = (yaw: number, pitch: number): Vec3 =>
  ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });

// Turning with the pitch, over the top the view rolls on smoothly instead of flipping to stay upright.
export const orbitUp = (yaw: number, pitch: number): Vec3 =>
  ({ x: Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: Math.cos(yaw) * Math.sin(pitch) });

/** How far (at most `distM`) the eye goes out along a back whose rise is `backY` and stays `marginM` above the floor. */
export function floorReach(pivotY: number, backY: number, floorY: number, distM: number, marginM: number): number {
  if (backY >= 0) return distM;
  return Math.max(0, Math.min(distM, (pivotY - floorY - marginM) / -backY));
}
