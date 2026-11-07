import { Vector3, type Camera } from "@babylonjs/core";
import {
  Body, clamp, Health, Player, SCREEN_DIR, Skilled, Wielder, type PlayerAction, type PlayerData, type SwingData,
  type SwingDir, type Vec3, type World,
} from "@infinite-tower/shared";
import { LocalPlayer } from "../../modes/components.js";
import { drawChantWords } from "./chantWords.js";
import type { ArenaScene } from "./scene.js";

const WEDGES = 8;
// Wedge 6 would be a swing from below: there is no upward swing.
const SHOWN_WEDGES = [0, 1, 2, 3, 4, 5, 7];
// In the HUD's CSS pixels. The ring's centre sits clear above the foe's bar and its statuses (BossBar, ~110 px up).
export const AIM_HUD = {
  ringAboveBottomPx: 160, ringRadiusPx: 30, wedgeLengthPx: 11, wedgeThickPx: 3, stabPx: 4, crossGapPx: 3,
  crossArmPx: 5, crossThickPx: 1.5,
};
const AIMING: readonly PlayerAction[] = ["draw", "loose", "chant", "cast", "beam"];
const DIM = "rgba(255, 255, 255, 0.28)";
const GOLD = "rgba(232, 196, 90, 0.9)";
const CROSS = "rgba(255, 255, 255, 0.85)";
const EDGE = "rgba(11, 13, 26, 0.45)";
const MARKER_GAP_M = 0.5;
const MARKER_SPIN_RAD_PER_SEC = 2.5;
const MARKER_WAIST_M = 0.17;
const MARKER_HALF_HEIGHT_M = 0.3;
const MARKER_RGB = [221, 68, 45] as const;
const MARKER_SIDE_SHADE = 0.25;
const MARKER_UNDERSIDE_SHADE = 0.15;

export function wedgeOf(way: SwingDir): number {
  const going = SCREEN_DIR[way];
  return (Math.round(Math.atan2(-going.y, -going.x) / (2 * Math.PI / WEDGES)) + WEDGES) % WEDGES;
}

export interface RingLights { lit: number; stab: boolean }

export function ringLights(way: SwingDir, swing: SwingData | null): RingLights {
  return { lit: wedgeOf(way), stab: swing !== null && swing.way === "stab" && swing.step < swing.liveAt };
}

export interface AimHud { ring: RingLights | null; crosshair: boolean }

export function aimHud(
  player: PlayerData, hp: number, swing: SwingData | null, way: SwingDir, fighting: boolean,
): AimHud {
  if (hp <= 0 || !fighting) return { ring: null, crosshair: false };
  return { ring: player.way === null ? null : ringLights(way, swing), crosshair: AIMING.includes(player.action) };
}

export const aimLayout = (widthPx: number, heightPx: number, scale: number) => ({
  ring: { x: widthPx / 2, y: heightPx - AIM_HUD.ringAboveBottomPx * scale },
  crosshair: { x: widthPx / 2, y: heightPx / 2 },
  scale,
});

export interface ScreenPoint { x: number; y: number; pxPerM: number }

type Project = (at: Vec3) => ScreenPoint | null;

const viewed = new Vector3(), projected = new Vector3();

export function onScreen(at: Vec3, camera: Camera, widthPx: number, heightPx: number): ScreenPoint | null {
  Vector3.TransformCoordinatesFromFloatsToRef(at.x, at.y, at.z, camera.getViewMatrix(), viewed);
  if (viewed.z < camera.minZ) return null;
  const projection = camera.getProjectionMatrix();
  Vector3.TransformCoordinatesToRef(viewed, projection, projected);
  return {
    x: ((projected.x + 1) / 2) * widthPx,
    y: ((1 - projected.y) / 2) * heightPx,
    pxPerM: (projection.m[5]! * heightPx) / 2 / viewed.z,
  };
}

// Drawn at full resolution on a canvas of its own over the pixel-art render, so it reads as HUD.
export function arenaOverlay(
  ctx: ArenaScene, canvas: HTMLCanvasElement,
): { frame(world: World | null, dt: number): void } {
  const g = canvas.getContext("2d")!;
  let spinRad = 0, drawn = false;
  return {
    frame(world, dt) {
      const widthPx = Math.round(canvas.clientWidth * devicePixelRatio);
      const heightPx = Math.round(canvas.clientHeight * devicePixelRatio);
      if (canvas.width !== widthPx || canvas.height !== heightPx) {
        canvas.width = widthPx;
        canvas.height = heightPx;
      } else if (drawn) g.clearRect(0, 0, widthPx, heightPx);
      drawn = world !== null;
      spinRad += MARKER_SPIN_RAD_PER_SEC * dt;
      if (!world) return;
      const project: Project = (at) => onScreen(at, ctx.camera, widthPx, heightPx);
      for (const [e, skilled] of world.query(Skilled)) {
        const node = ctx.nodes.get(e);
        if (skilled.chanting && node && !world.has(e, LocalPlayer)) drawChantWords(g, project, skilled, node.position);
      }
      drawMarker(g, ctx, world, project, spinRad);
      drawAim(g, ctx, world, widthPx, heightPx);
    },
  };
}

function drawAim(g: CanvasRenderingContext2D, ctx: ArenaScene, world: World, widthPx: number, heightPx: number): void {
  const me = world.first(LocalPlayer, Player, Wielder, Health);
  if (!me) return;
  const fighting = ctx.battle.outcome.state === "fighting";
  const { ring, crosshair } = aimHud(me[2], me[4].hp, me[3].swing, ctx.battle.way, fighting);
  const { ring: { x, y }, crosshair: centre, scale: s } = aimLayout(widthPx, heightPx, devicePixelRatio), H = AIM_HUD;
  g.strokeStyle = EDGE;
  g.lineWidth = s;
  if (ring) {
    for (const i of SHOWN_WEDGES) {
      const a = (i * 2 * Math.PI) / WEDGES;
      g.setTransform(1, 0, 0, 1, x + Math.cos(a) * H.ringRadiusPx * s, y - Math.sin(a) * H.ringRadiusPx * s);
      g.rotate(-a);
      g.fillStyle = i === ring.lit ? GOLD : DIM;
      g.beginPath();
      g.rect((-H.wedgeThickPx * s) / 2, (-H.wedgeLengthPx * s) / 2, H.wedgeThickPx * s, H.wedgeLengthPx * s);
      g.fill();
      g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (ring?.stab) {
    const r = H.stabPx * s;
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x, y - r);
    g.lineTo(x - r, y);
    g.lineTo(x, y + r);
    g.closePath();
    g.fill();
    g.stroke();
  }
  if (!crosshair) return;
  const gap = H.crossGapPx * s, arm = H.crossArmPx * s, thick = H.crossThickPx * s;
  g.fillStyle = CROSS;
  g.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const w = dx === 0 ? thick : arm, h = dx === 0 ? arm : thick;
    g.rect(centre.x + dx * (gap + arm / 2) - w / 2, centre.y + dy * (gap + arm / 2) - h / 2, w, h);
  }
  g.rect(centre.x - thick / 2, centre.y - thick / 2, thick, thick);
  g.fill();
  g.stroke();
}

function drawMarker(
  g: CanvasRenderingContext2D, ctx: ArenaScene, world: World, project: Project, spinRad: number,
): void {
  const lock = ctx.battle.lock, body = lock === null ? undefined : world.get(lock, Body);
  if (!body) return;
  const { x, z } = body.pos, y = body.pos.y + 2 * body.centerHeight + MARKER_GAP_M;
  const top = project({ x, y: y + MARKER_HALF_HEIGHT_M, z }), bottom = project({ x, y: y - MARKER_HALF_HEIGHT_M, z });
  const waist = [0, 1, 2, 3].map((k) => {
    const a = spinRad + (k * Math.PI) / 2;
    return project({ x: x + Math.cos(a) * MARKER_WAIST_M, y, z: z + Math.sin(a) * MARKER_WAIST_M });
  });
  if (!top || !bottom || waist.some((p) => !p)) return;
  const corners = waist as ScreenPoint[], midX = (top.x + bottom.x) / 2, widthPx = MARKER_WAIST_M * top.pxPerM;
  const faces = corners.flatMap((a, k) => {
    const b = corners[(k + 1) % 4]!;
    return [[top, a, b], [bottom, a, b]] as const;
  });
  // Farthest first: a facet's corners nearer the camera take more pixels a metre.
  faces.sort((f1, f2) => f1[1].pxPerM + f1[2].pxPerM - f2[1].pxPerM - f2[2].pxPerM);
  g.lineWidth = 1;
  for (const [tip, a, b] of faces) {
    // Unlit, a turning octahedron's facets would be one flat red: shading them shows the turn.
    const right = clamp(((a.x + b.x) / 2 - midX) / widthPx, -1, 1);
    const shade = 1 - MARKER_SIDE_SHADE * (right + 1) / 2 - (tip === bottom ? MARKER_UNDERSIDE_SHADE : 0);
    const [red, green, blue] = MARKER_RGB.map((c) => Math.round(c * shade));
    g.fillStyle = g.strokeStyle = `rgb(${red}, ${green}, ${blue})`;
    g.beginPath();
    g.moveTo(tip.x, tip.y);
    g.lineTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.closePath();
    g.fill();
    g.stroke();
  }
}
