import { clamp, type Vec3 } from "@infinite-tower/shared";

// Turn rates at 100% sensitivity, in the arena and the overworld; Settings → Camera scales them (settings/camera.ts).
export const TURN = { yawRadPerSec: 2.6, pitchRadPerSec: 1.4, mouseRadPerPx: 0.0025 } as const;

const DEG = Math.PI / 180;
// The eye's angle over the pivot (orbitBack's pitch): from `belowRad` under it to `aboveRad` over it, arena and
// overworld alike; in first person you look up or down `firstPersonRad` at most.
export const PITCH = { belowRad: 35 * DEG, aboveRad: 80 * DEG, firstPersonRad: 80 * DEG } as const;

/** A notch of the scroll wheel takes the camera this many times as far out (or in). */
export const ZOOM_PER_NOTCH = 1.2;

export function turnBy(
  keys: { turn: number; look: number }, drag: { dx: number; dy: number }, dt: number, sensitivity: number,
): { yaw: number; pitch: number } {
  return {
    yaw: (keys.turn * TURN.yawRadPerSec * dt + drag.dx * TURN.mouseRadPerPx) * sensitivity,
    pitch: (keys.look * TURN.pitchRadPerSec * dt + drag.dy * TURN.mouseRadPerPx) * sensitivity,
  };
}

/** `notches` out (+) or in (-), any part of one. */
export const zoomBy = (distance: number, notches: number, min: number, max: number): number =>
  clamp(distance * ZOOM_PER_NOTCH ** notches, min, max);

/** From the pivot toward the eye. Yaw 0 looks along +z; pitch is the eye's angle above the pivot. */
export const orbitBack = (yaw: number, pitch: number): Vec3 =>
  ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });

/** How far (at most `distM`) the eye goes out along a back whose rise is `backY` and stays `marginM` above the floor. */
export function floorReach(pivotY: number, backY: number, floorY: number, distM: number, marginM: number): number {
  if (backY >= 0) return distM;
  return Math.max(0, Math.min(distM, (pivotY - floorY - marginM) / -backY));
}
