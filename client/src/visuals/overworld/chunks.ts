import { Color3 } from "@babylonjs/core";
import {
  CHUNK_TILES, chunkKey, chunksNear, dampFactor, distToRect, regionAt, tileAt, type Rect, type Vec3, type WorldMap,
} from "@infinite-tower/shared";
import type { OverworldState } from "../../modes/overworld/components.js";
import { waterMap, type WaterMap } from "../../modes/overworld/water.js";
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
const DROPPED_TILES = SHOWN_TILES + AHEAD_TILES + 2 * CHUNK_TILES;
const BUILD_BUDGET_MS = 3;
const SKY_BLEND_RATE = 1.5;

export interface WorldDrawing {
  readonly map: WorldMap;
  frame(dt: number, eye: Vec3, focus: Vec3): void;
  warm(focus: Vec3): void;
  face(yawRad: number): void;
  dispose(): void;
}

interface Chunk {
  rect: Rect;
  job: Generator<void, ChunkDrawing> | null;
  drawing: ChunkDrawing | null;
  /** Held, and nothing in it to draw. */
  empty: boolean;
  shown: boolean;
}

function anyTile(map: WorldMap, r: Rect): boolean {
  for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.h; z++) if (tileAt(map, x + 0.5, z + 0.5)) return true;
  return false;
}

export function worldDrawing(view: OverworldScene, state: OverworldState, art: TerrainArt): WorldDrawing {
  const { scene, sky } = view, map = state.map!, lights = campfireLights(map);
  const chunks: Chunk[] = chunksNear(map.bounds, 0, 0, Infinity)
    .map((rect) => ({ rect, job: null, drawing: null, empty: false, shown: false }));
  let yawRad = NaN, skyLook: SkyLook | null = null, water: { revision: number; map: WaterMap } | null = null;

  const waterNow = () => {
    const { revision, flow } = state.held;
    if (water?.revision !== revision) water = { revision, map: waterMap(map, flow) };
    return water.map;
  };
  // Its scenery and water look at the tiles round it, so its neighbours have to be here too.
  const ready = ({ rect }: Chunk) => [-1, 0, 1].every((dx) => [-1, 0, 1].every((dz) => {
    const x = rect.x + dx * CHUNK_TILES, z = rect.z + dz * CHUNK_TILES;
    const { bounds: b } = map, inside = x >= b.x && x < b.x + b.w && z >= b.z && z < b.z + b.h;
    return !inside || state.held.keys.has(chunkKey(x, z));
  }));
  const done = (c: Chunk) => c.drawing !== null || c.empty;
  const step = (c: Chunk) => {
    if (!c.job) {
      if (!anyTile(map, c.rect)) { c.empty = true; return; }
      c.job = buildChunk(scene, map, waterNow(), c.rect, art, lights);
    }
    const next = c.job.next();
    if (!next.done) return;
    c.job = null;
    c.drawing = next.value;
  };
  const build = (c: Chunk) => { while (!done(c)) step(c); };
  const show = (c: Chunk) => {
    build(c);
    if (!c.drawing) return;
    for (const m of c.drawing.meshes) scene.addMesh(m);
    for (const [m, only] of c.drawing.casters) sky.castShadows(m, only);
    if (!Number.isNaN(yawRad)) c.drawing.face(yawRad);
    c.shown = true;
  };
  const hide = (c: Chunk) => {
    detach(scene, c.drawing!.meshes);
    sky.dropShadows(c.drawing!.casters.map(([m]) => m));
    c.shown = false;
  };
  const drop = (c: Chunk) => {
    if (c.job) build(c);
    if (c.shown) hide(c);
    c.drawing?.dispose();
    c.drawing = null;
    c.empty = false;
  };
  const buildAhead = (focus: Vec3) => {
    const untilMs = performance.now() + BUILD_BUDGET_MS, dist = (c: Chunk) => distToRect(c.rect, focus.x, focus.z);
    const ahead = chunks.filter((c) => !done(c) && dist(c) <= SHOWN_TILES + AHEAD_TILES && ready(c))
      .sort((a, b) => dist(a) - dist(b));
    for (const c of ahead) {
      while (!done(c) && performance.now() < untilMs) step(c);
    }
  };

  return {
    map,
    frame(dt, eye, focus) {
      const target = REGION_LOOKS[regionAt(map, focus.x, focus.z).theme].env;
      if (!skyLook) sky.look(skyLook = copyLook(target), lights);
      else sky.tint(blendLook(skyLook, target, dampFactor(SKY_BLEND_RATE, dt)));
      for (const c of chunks) {
        const dist = distToRect(c.rect, focus.x, focus.z);
        if (dist > DROPPED_TILES && (c.drawing || c.job)) drop(c);
        else if (!c.shown && dist <= SHOWN_TILES && ready(c)) show(c);
        else if (c.shown && dist > SHOWN_TILES + HIDE_MARGIN_TILES) hide(c);
      }
      buildAhead(focus);
      for (const c of chunks) if (c.shown) c.drawing!.frame(dt, eye, focus, sky);
    },
    warm: buildAhead,
    face(yaw) {
      yawRad = yaw;
      for (const c of chunks) if (c.shown) c.drawing!.face(yaw);
    },
    dispose() {
      for (const c of chunks) drop(c);
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
