import { Color3 } from "@babylonjs/core";
import { CHUNK_TILES, dampFactor, regionAt, tileAt, type Rect, type Vec3, type WorldMap } from "@infinite-tower/shared";
import { waterMap } from "../../modes/overworld/water.js";
import { campfireLights, REGION_LOOKS } from "../regions/index.js";
import type { SkyLook } from "../sky/sky.js";
import type { OverworldScene } from "./scene.js";
import { buildChunk, detach, type ChunkDrawing } from "./terrain.js";
import type { TerrainArt } from "./terrainArt.js";

export const SHOWN_TILES = 30;
/** Built ahead past SHOWN_TILES, so walking on never waits on a chunk. */
export const AHEAD_TILES = CHUNK_TILES;
/** So a chunk at the edge isn't put in and out as you step about. */
const HIDE_MARGIN_TILES = 2;
const BUILD_BUDGET_MS = 3;
const SKY_BLEND_RATE = 1.5;

export interface WorldDrawing {
  readonly map: WorldMap;
  frame(dt: number, eye: Vec3, focus: Vec3): void;
  face(yawRad: number): void;
  dispose(): void;
}

interface Chunk {
  rect: Rect;
  job: Generator<void, ChunkDrawing> | null;
  drawing: ChunkDrawing | null;
  shown: boolean;
}

const distToRect = (r: Rect, x: number, z: number) =>
  Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.z - z, 0, z - r.z - r.h));

export function chunksOf(map: WorldMap): Rect[] {
  const { bounds } = map, rects: Rect[] = [];
  for (let x = bounds.x; x < bounds.x + bounds.w; x += CHUNK_TILES) {
    for (let z = bounds.z; z < bounds.z + bounds.h; z += CHUNK_TILES) {
      const rect = { x, z, w: CHUNK_TILES, h: CHUNK_TILES };
      if (anyTile(map, rect)) rects.push(rect);
    }
  }
  return rects;
}

function anyTile(map: WorldMap, r: Rect): boolean {
  for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.h; z++) if (tileAt(map, x + 0.5, z + 0.5)) return true;
  return false;
}

export function worldDrawing(view: OverworldScene, map: WorldMap, art: TerrainArt): WorldDrawing {
  const { scene, sky } = view;
  const water = waterMap(map), lights = campfireLights(map);
  const chunks: Chunk[] = chunksOf(map).map((rect) => ({ rect, job: null, drawing: null, shown: false }));
  let yawRad = NaN, skyLook: SkyLook | null = null;

  const step = (c: Chunk) => {
    c.job ??= buildChunk(scene, map, water, c.rect, art, lights);
    const next = c.job.next();
    if (!next.done) return;
    c.job = null;
    c.drawing = next.value;
  };
  const build = (c: Chunk) => { while (!c.drawing) step(c); };
  const show = (c: Chunk) => {
    build(c);
    const drawing = c.drawing!;
    for (const m of drawing.meshes) scene.addMesh(m);
    for (const [m, only] of drawing.casters) sky.castShadows(m, only);
    if (!Number.isNaN(yawRad)) drawing.face(yawRad);
    c.shown = true;
  };
  const hide = (c: Chunk) => {
    const drawing = c.drawing!;
    detach(scene, drawing.meshes);
    sky.dropShadows(drawing.casters.map(([m]) => m));
    c.shown = false;
  };

  return {
    map,
    frame(dt, eye, focus) {
      const target = REGION_LOOKS[regionAt(map, focus.x, focus.z).theme].env;
      if (!skyLook) sky.look(skyLook = copyLook(target), lights);
      else sky.tint(blendLook(skyLook, target, dampFactor(SKY_BLEND_RATE, dt)));
      for (const c of chunks) {
        const dist = distToRect(c.rect, focus.x, focus.z);
        if (!c.shown && dist <= SHOWN_TILES) show(c);
        else if (c.shown && dist > SHOWN_TILES + HIDE_MARGIN_TILES) hide(c);
      }
      const untilMs = performance.now() + BUILD_BUDGET_MS;
      const ahead = chunks
        .filter((c) => !c.drawing && distToRect(c.rect, focus.x, focus.z) <= SHOWN_TILES + AHEAD_TILES)
        .sort((a, b) => distToRect(a.rect, focus.x, focus.z) - distToRect(b.rect, focus.x, focus.z));
      for (const c of ahead) {
        while (!c.drawing && performance.now() < untilMs) step(c);
      }
      for (const c of chunks) if (c.shown) c.drawing!.frame(dt, eye, focus, sky);
    },
    face(yaw) {
      yawRad = yaw;
      for (const c of chunks) if (c.shown) c.drawing!.face(yaw);
    },
    dispose() {
      for (const c of chunks) {
        if (c.shown) hide(c);
        c.drawing?.dispose();
      }
      sky.clearShadows();
    },
  };
}

function copyLook(look: SkyLook): SkyLook {
  return {
    sky: look.sky.clone(), fogDensity: look.fogDensity, ambient: look.ambient.clone(),
    skyLight: { color: look.skyLight.color.clone(), ground: look.skyLight.ground.clone(), intensity: look.skyLight.intensity },
    sun: { color: look.sun.color.clone(), intensity: look.sun.intensity },
  };
}

function blendLook(look: SkyLook, to: SkyLook, k: number): SkyLook {
  const towards = (c: Color3, t: Color3) => Color3.LerpToRef(c, t, k, c);
  const by = (a: number, b: number) => a + (b - a) * k;
  towards(look.sky, to.sky);
  towards(look.ambient, to.ambient);
  towards(look.skyLight.color, to.skyLight.color);
  towards(look.skyLight.ground, to.skyLight.ground);
  towards(look.sun.color, to.sun.color);
  look.fogDensity = by(look.fogDensity, to.fogDensity);
  look.skyLight.intensity = by(look.skyLight.intensity, to.skyLight.intensity);
  look.sun.intensity = by(look.sun.intensity, to.sun.intensity);
  return look;
}
