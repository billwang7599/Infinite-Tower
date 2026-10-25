/**
 * 3D for the title's scene (Scene.tsx): points, the camera, and putting points on the screen. World units; y is
 * up, and the title's camera looks along +z, at the tower on the origin.
 */
export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** The middle of a polygon, and which way it faces (either way: faces here are lit from both sides). */
export const centerOf = (points: readonly Vec3[]): Vec3 =>
  scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
export const normalOf = (points: readonly Vec3[]): Vec3 =>
  normalize(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!)));

/**
 * Where the camera is and where it looks. Angles in radians: `yaw` 0 looks along +z and turns toward +x, `pitch`
 * looks up, `roll` turns the picture clockwise. `fovDeg`: from the top of the screen to the bottom.
 */
export interface Pose {
  pos: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  fovDeg: number;
}

export interface Camera {
  pos: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  /** Pixels per unit, one unit in front of the eye. */
  focalPx: number;
  centerPx: readonly [number, number];
}

export function cameraFor(pose: Pose, widthPx: number, heightPx: number): Camera {
  const { yaw, pitch, roll } = pose;
  const forward: Vec3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const level: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const upright = cross(forward, level);
  const [c, s] = [Math.cos(roll), Math.sin(roll)];
  return {
    pos: pose.pos, forward,
    right: add(scale(level, c), scale(upright, s)),
    up: sub(scale(upright, c), scale(level, s)),
    focalPx: heightPx / 2 / Math.tan((pose.fovDeg * Math.PI) / 360),
    centerPx: [widthPx / 2, heightPx / 2],
  };
}

/** `p` relative to the camera: [right, up, ahead]. */
export function toView(cam: Camera, p: Vec3): Vec3 {
  const d = sub(p, cam.pos);
  return [dot(d, cam.right), dot(d, cam.up), dot(d, cam.forward)];
}

/** The part of a polygon (in view space) at least `near` ahead of the eye. */
export function clipNear(points: readonly Vec3[], near: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const aIn = a[2] >= near;
    if (aIn) out.push(a);
    if (aIn !== b[2] >= near) out.push(lerp3(a, b, (near - a[2]) / (b[2] - a[2])));
  }
  return out;
}

/** A view-space point on the screen, in pixels from the top left. */
export function onScreen(cam: Camera, v: Vec3): [number, number] {
  return [cam.centerPx[0] + (cam.focalPx * v[0]) / v[2], cam.centerPx[1] - (cam.focalPx * v[1]) / v[2]];
}
