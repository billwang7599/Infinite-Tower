/**
 * Draws one frame of the title's scene onto a 2D canvas: the sky, then every face far to near (the painter's way,
 * which suits a few hundred flat faces), each lit (light.ts) and fogged, glass outlined; the tower's shadow over the
 * floor. Bright things (gold, the
 * light up the shaft, the streaks) are drawn again onto `glow`, a smaller canvas the screen blurs over the top.
 */
import { css, fogAt, lit, linear, seenThrough } from "./light.js";
import type { Shot } from "./path.js";
import { cameraFor, clipNear, onScreen, sub, toView, type Camera, type Vec3 } from "./space.js";
import { buildCrystals, buildTower, FOOTPRINT, STREAK_SPAN, STREAKS, TOWER, towerShadow, type Face } from "./world.js";

const NEAR = 0.04;
/** How far below and above the eye the tower is built (units): high enough that its last hole is a speck. */
const TOWER_BELOW = 3;
const TOWER_ABOVE = 22;
/** The night sky by how high the view looks (radians), from below the horizon to straight up: a cold haze low. */
const SKY: readonly (readonly [number, string])[] = [
  [-0.3, "#07080c"], [0, "#151a26"], [0.1, "#0d1018"], [0.5, "#06070b"], [Math.PI / 2, "#030305"],
];
const GLOW_GOLD = "255 214 140";
/** Things flat on the ground first, in this order, then everything standing, each lot far to near. */
const LAYERS: readonly (Face["layer"] | "shadow")[] = ["under", "floor", "shadow", undefined];
/**
 * The tower's shadow: how far it's drawn (units), and how dark it is at the foot. It's drawn as nested steps, each
 * reaching further and each darkening a little, so it fades out along its length.
 */
const SHADOW = { length: 16, steps: 16, darkest: 0.8 };
const SHADOW_STEPS = Array.from({ length: SHADOW.steps }, (_, i) =>
  towerShadow((SHADOW.length * (i + 1)) / SHADOW.steps));
const SHADOW_FILL = `rgb(0 0 0 / ${(1 - (1 - SHADOW.darkest) ** (1 / SHADOW.steps)).toFixed(4)})`;

interface Drawn {
  points: [number, number][];
  /** Left unfilled, inside `points`. */
  hole?: [number, number][];
  layer: number;
  depth: number;
  fill: string;
  edge: string | undefined;
  edgeAlpha: number;
  glow: number;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, floor: readonly Face[], shot: Shot, seconds: number,
): void {
  const { width: w, height: h } = ctx.canvas;
  const cam = cameraFor(shot.pose, w, h);
  drawSky(ctx, cam, h);
  capShaft(ctx, cam);

  const eyeY = cam.pos[1];
  const faces = [
    ...floor,
    ...buildTower(eyeY - TOWER_BELOW, eyeY + TOWER_ABOVE),
    ...buildCrystals(seconds),
  ];
  const drawn = [...faces.flatMap((f) => project(f, cam, w, h) ?? []), ...shadow(cam, w, h)];
  drawn.sort((a, b) => a.layer - b.layer || b.depth - a.depth);

  const px = h / 720;
  ctx.lineJoin = "round";
  for (const d of drawn) {
    trace(ctx, d.points, 1);
    if (d.hole) trace(ctx, d.hole, 1, false);
    ctx.fillStyle = d.fill;
    ctx.fill("evenodd");
    if (d.edge && d.edgeAlpha > 0.02) {
      ctx.globalAlpha = d.edgeAlpha;
      ctx.strokeStyle = d.edge;
      ctx.lineWidth = px;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const k = glow.canvas.width / w;
  glow.clearRect(0, 0, glow.canvas.width, glow.canvas.height);
  for (const d of drawn) {
    if (d.glow <= 0.01) continue;
    trace(glow, d.points, k);
    glow.fillStyle = `rgb(${GLOW_GOLD} / ${d.glow.toFixed(3)})`;
    glow.fill();
  }
  drawShaftLight(ctx, glow, cam, h, k);
  if (Math.abs(shot.speed) > 0.5) drawStreaks(ctx, glow, cam, shot.speed, px, k);
}

function project(f: Face, cam: Camera, w: number, h: number): Drawn | null {
  const fog = fogAt(f.center, cam.pos);
  // Gone into the dark is gone; gone into the light is still drawn, as light, so the shaft ends in it.
  if (fog.dark > 0.985) return null;
  const points = screenPoints(f.points, cam, w, h);
  if (!points) return null;
  const seen = seenThrough(fog);
  const toFace = sub(f.center, cam.pos);
  const m = f.material;
  return {
    points,
    layer: LAYERS.indexOf(f.layer),
    depth: toFace[0] ** 2 + toFace[1] ** 2 + toFace[2] ** 2,
    fill: css(lit(m, f.normal, f.center, cam.pos), fog, m.alpha),
    edge: m.edge,
    edgeAlpha: seen,
    glow: m.bloom ? 0.6 * (1 - fog.dark) : 0,
  };
}

function shadow(cam: Camera, w: number, h: number): Drawn[] {
  const layer = LAYERS.indexOf("shadow");
  const hole = screenPoints(FOOTPRINT, cam, w, h, false) ?? undefined;
  return SHADOW_STEPS.flatMap((step) => {
    const points = screenPoints(step, cam, w, h);
    return points ? [{ points, hole, layer, depth: 0, fill: SHADOW_FILL, edge: undefined, edgeAlpha: 0, glow: 0 }] : [];
  });
}

/** A polygon on the screen, in pixels, or null if none of it is (or, if `cull`, none of it is in view). */
function screenPoints(
  world: readonly Vec3[], cam: Camera, w: number, h: number, cull = true,
): [number, number][] | null {
  const view = world.map((p) => toView(cam, p));
  if (view.every((v) => v[2] < NEAR)) return null;
  const points = clipNear(view, NEAR).map((v) => onScreen(cam, v));
  if (points.length < 3) return null;
  if (!cull) return points;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  if (Math.max(...xs) < 0 || Math.min(...xs) > w || Math.max(...ys) < 0 || Math.min(...ys) > h) return null;
  return points;
}

/** `points` as a closed path: a new one, or (`fresh` false) added to the path so far. */
function trace(
  ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], k: number, fresh = true,
): void {
  if (fresh) ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * k, y * k) : ctx.lineTo(x * k, y * k)));
  ctx.closePath();
}

/** Coloured by how high each row of the screen looks (down its middle). */
function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  for (const at of [0, 0.15, 0.3, 0.45, 0.55, 0.62, 0.7, 0.85, 1]) {
    const lift = (cam.centerPx[1] - at * h) / cam.focalPx;
    const dir = [0, 1, 2].map((i) => cam.forward[i]! + cam.up[i]! * lift);
    gradient.addColorStop(at, skyAt(Math.atan2(dir[1]!, Math.hypot(dir[0]!, dir[2]!))));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, h);
}

function skyAt(elevation: number): string {
  const i = SKY.findIndex(([e]) => e >= elevation);
  if (i <= 0) return SKY[i === 0 ? 0 : SKY.length - 1]![1];
  const [[e0, c0], [e1, c1]] = [SKY[i - 1]!, SKY[i]!];
  const t = (elevation - e0) / (e1 - e0);
  const [a, b] = [linear(c0), linear(c1)];
  const rgb = a.map((c, j) => Math.round(255 * (c + (b[j]! - c) * t) ** (1 / 2.2)));
  return `rgb(${rgb.join(" ")})`;
}

/** Light over the top of what's built, behind everything: else the tower's last hole would show the night. */
function capShaft(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const top = toView(cam, [0, cam.pos[1] + TOWER_ABOVE, 0]);
  if (top[2] <= NEAR) return;
  const [x, y] = onScreen(cam, top);
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(x, y, (cam.focalPx * TOWER.radius * 1.1) / top[2], 0, Math.PI * 2);
  ctx.fill();
}

/** The light the tower climbs into, where its middle goes on up, when that's in view. */
function drawShaftLight(
  ctx: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, cam: Camera, h: number, k: number,
): void {
  const v = toView(cam, [0, cam.pos[1] + 1000, 0]);
  if (v[2] <= 0) return;
  const [x, y] = onScreen(cam, v);
  const radius = h * 0.55 * Math.max(0, v[2] / 1000) ** 4;
  if (radius < 4 || y < -radius || y > h + radius) return;
  for (const [c, scale, alpha] of [[ctx, 1, 0.95], [glow, k, 0.8]] as const) {
    const g = c.createRadialGradient(x * scale, y * scale, 0, x * scale, y * scale, radius * scale);
    g.addColorStop(0, `rgb(255 255 255 / ${alpha})`);
    g.addColorStop(0.25, `rgb(255 250 235 / ${alpha * 0.6})`);
    g.addColorStop(1, "rgb(255 250 235 / 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  }
}

/** Light hanging in the shaft, smeared along the climb the faster it goes. */
function drawStreaks(
  ctx: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, cam: Camera, speed: number, px: number, k: number,
): void {
  const eyeY = cam.pos[1];
  const fast = Math.min(1, Math.abs(speed) / 12);
  for (const s of STREAKS) {
    const y = eyeY - 1 + ((((s.at[1] - eyeY + 1) % STREAK_SPAN) + STREAK_SPAN) % STREAK_SPAN);
    const tail = s.length * (0.3 + 2.2 * fast) * Math.sign(speed);
    const ends: Vec3[] = [[s.at[0], y, s.at[2]], [s.at[0], y + tail, s.at[2]]];
    const view = clipNear(ends.map((p) => toView(cam, p)), NEAR);
    if (view.length < 2) continue;
    const [[x0, y0], [x1, y1]] = [onScreen(cam, view[0]!), onScreen(cam, view[1]!)];
    const fade = fast * (1 - Math.min(1, (y - eyeY) / STREAK_SPAN));
    for (const [c, scale, colour, width] of [[ctx, 1, "255 236 190", 1.6], [glow, k, GLOW_GOLD, 3]] as const) {
      c.strokeStyle = `rgb(${colour} / ${(0.85 * fade).toFixed(3)})`;
      c.lineWidth = width * px * scale;
      c.beginPath();
      c.moveTo(x0 * scale, y0 * scale);
      c.lineTo(x1 * scale, y1 * scale);
      c.stroke();
    }
  }
}
