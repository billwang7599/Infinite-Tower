import { Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import {
  CHUNK_TILES, chunkKey, chunksNear, dampFactor, distToRect, tileAt, VIEW, type Rect, type Vec2, type Vec3,
  type WorldMap,
} from "@infinite-tower/shared";
import type { OverworldState } from "../../modes/overworld/components.js";
import { CAMERA_PITCH } from "../../modes/overworld/facing.js";
import { waterMap, WATER_DEPTH_TILES, type WaterMap } from "../../modes/overworld/water.js";
import { campfireLights, REGION_LOOKS } from "../regions/index.js";
import type { SkyLook } from "../sky/sky.js";
import { CAMERA, type OverworldScene } from "./scene.js";
import { buildChunk, detach, type ChunkDrawing } from "./terrain.js";
import type { TerrainArt } from "./terrainArt.js";

/** Past the ground the camera sees: water's beds lie a little lower, so they're seen a little further. */
const SEEN_MARGIN_TILES = 2;
/** As far as the camera ever sees: what's built, and what the server sends, is reckoned from it. */
export const SHOWN_TILES = Math.ceil(seenGround(CAMERA_PITCH.drawnForRad).fromFocusTiles) + SEEN_MARGIN_TILES;

/** Nearer than this a chunk casts shadows and is updated every frame; further, one far chunk a frame. */
export const NEAR_TILES = 32;
/** Built ahead past SHOWN_TILES, so walking on never waits on a chunk. */
export const AHEAD_TILES = CHUNK_TILES;
/** So a chunk at an edge isn't put in and out as you step about. */
export const HIDE_MARGIN_TILES = 2;
const DROPPED_TILES = SHOWN_TILES + AHEAD_TILES + 2 * CHUNK_TILES;
/** A chunk straight ahead builds as if this much nearer, one behind as if this much further. */
const AHEAD_BIAS_TILES = CHUNK_TILES;
/** A chunk this near that isn't built yet (after waking somewhere new) is built at once. */
const MUST_BUILD_TILES = CHUNK_TILES;
const BUILD_BUDGET_MS = 3;
const SKY_BLEND_RATE = 1.5;
/** How far either side of where one region gives way to the next their skies blend. */
export const SKY_BLEND_TILES = 12;
const WALK_DIR_RATE = 4;
const FOG_FADE_M = 16;
/** The plain ground under the world, below the deepest water's bed so it never shows through it. */
const SKIRT = { depthTiles: WATER_DEPTH_TILES.deep + 0.1, sizeTiles: 4 * SHOWN_TILES, shade: 0.8 };

/** The screen's top corners on the ground, the farthest it sees: tiles from the focus, metres from the camera. */
export function seenGround(pitchRad: number): { fromFocusTiles: number; fromCameraM: number } {
  const up = Math.tan(CAMERA.fovRad / 2), side = up * VIEW.maxAspect;
  const sin = Math.sin(pitchRad), cos = Math.cos(pitchRad);
  const along = (CAMERA.pivotTiles + sin * CAMERA.distanceTiles) / (sin - cos * up);
  const ahead = (cos + sin * up) * along - cos * CAMERA.distanceTiles;
  return { fromFocusTiles: Math.hypot(ahead, side * along), fromCameraM: along * Math.hypot(1, up, side) };
}

export function skyBlendAt(map: Pick<WorldMap, "regions">, x: number, z: number) {
  const [near, next] = [...map.regions].map((r) => ({ r, dist: distToRect(r.area, x, z) }))
    .sort((a, b) => a.dist - b.dist);
  const nextShare = next ? Math.max(0, 0.5 - (next.dist - near!.dist) / (2 * SKY_BLEND_TILES)) : 0;
  return { near: near!.r, next: next?.r ?? near!.r, nextShare };
}

export type Level = "none" | "far" | "near";

export function levelAt(distTiles: number, now: Level, seenTiles: number): Level {
  if (distTiles <= NEAR_TILES + (now === "near" ? HIDE_MARGIN_TILES : 0)) return "near";
  return distTiles <= seenTiles + (now === "none" ? 0 : HIDE_MARGIN_TILES) ? "far" : "none";
}

/** Lower builds first. `ahead`: a unit way you walk or look, or zero. */
export function buildRank(rect: Rect, focus: Vec2, ahead: Vec2): number {
  const dx = rect.x + rect.w / 2 - focus.x, dz = rect.z + rect.h / 2 - focus.z;
  const along = (dx * ahead.x + dz * ahead.z) / (Math.hypot(dx, dz) || 1);
  return distToRect(rect, focus.x, focus.z) - AHEAD_BIAS_TILES * along;
}

/** Linear, on top of the region's own: full at the farthest ground the camera ever sees. */
const fogEndM = seenGround(CAMERA_PITCH.drawnForRad).fromCameraM;
export const FOG = { startM: fogEndM - FOG_FADE_M, endM: fogEndM };

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
  level: Level;
  /** Far chunks are updated in turn: the time since this one last was. */
  idleTime: number;
}

function anyTile(map: WorldMap, r: Rect): boolean {
  for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.h; z++) if (tileAt(map, x + 0.5, z + 0.5)) return true;
  return false;
}

export function worldDrawing(view: OverworldScene, state: OverworldState, art: TerrainArt): WorldDrawing {
  const { scene, sky } = view, map = state.map!, lights = campfireLights(map);
  const chunks: Chunk[] = chunksNear(map.bounds, 0, 0, Infinity)
    .map((rect) => ({ rect, job: null, drawing: null, empty: false, level: "none", idleTime: 0 }));
  let yawRad = NaN, skyLook: SkyLook | null = null, water: { revision: number; map: WaterMap } | null = null;
  let farTurn = 0, lastFocus: Vec2 | null = null;
  const walkDir = { x: 0, z: 0 }, ahead = { x: 0, z: 0 };
  scene.fogStart = FOG.startM;
  scene.fogEnd = FOG.endM;
  const skirt = MeshBuilder.CreateGround("world-skirt", { width: SKIRT.sizeTiles, height: SKIRT.sizeTiles }, scene);
  const skirtLook = new StandardMaterial("world-skirt", scene);
  skirtLook.specularColor = Color3.Black();
  skirt.material = skirtLook;
  skirt.position.y = -SKIRT.depthTiles;
  skirt.isPickable = false;

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
  const setLevel = (c: Chunk, level: Level) => {
    const d = c.drawing;
    if (d && c.level === "none") {
      for (const m of d.meshes) scene.addMesh(m);
      if (!Number.isNaN(yawRad)) d.face(yawRad);
    }
    if (d && level === "none") detach(scene, d.meshes);
    if (d && level === "near" && c.level !== "near") for (const [m, only] of d.casters) sky.castShadows(m, only);
    if (d && c.level === "near" && level !== "near") sky.dropShadows(d.casters.map(([m]) => m));
    if (d && level !== "none" && (level === "near") !== (c.level === "near")) {
      for (const m of d.receivers) m.receiveShadows = level === "near";
    }
    c.level = level;
    c.idleTime = 0;
  };
  const drop = (c: Chunk) => {
    if (c.job) build(c);
    setLevel(c, "none");
    c.drawing?.dispose();
    c.drawing = null;
    c.empty = false;
  };
  const buildAhead = (focus: Vec3) => {
    const untilMs = performance.now() + BUILD_BUDGET_MS, rank = new Map<Chunk, number>();
    for (const c of chunks) {
      if (!done(c) && distToRect(c.rect, focus.x, focus.z) <= SHOWN_TILES + AHEAD_TILES && ready(c)) {
        rank.set(c, buildRank(c.rect, focus, ahead));
      }
    }
    for (const c of [...rank.keys()].sort((a, b) => rank.get(a)! - rank.get(b)!)) {
      while (!done(c) && performance.now() < untilMs) step(c);
    }
  };
  const aim = (dt: number, eye: Vec3, focus: Vec3) => {
    if (lastFocus && dt > 0) {
      const k = dampFactor(WALK_DIR_RATE, dt);
      walkDir.x += ((focus.x - lastFocus.x) / dt - walkDir.x) * k;
      walkDir.z += ((focus.z - lastFocus.z) / dt - walkDir.z) * k;
    }
    lastFocus = { x: focus.x, z: focus.z };
    const walking = Math.hypot(walkDir.x, walkDir.z) > 0.5;
    const x = walking ? walkDir.x : focus.x - eye.x, z = walking ? walkDir.z : focus.z - eye.z;
    const n = Math.hypot(x, z) || 1;
    ahead.x = x / n;
    ahead.z = z / n;
  };

  return {
    map,
    frame(dt, eye, focus) {
      const { near, next, nextShare } = skyBlendAt(map, focus.x, focus.z);
      const target = blendLook(copyLook(REGION_LOOKS[near.theme].env), REGION_LOOKS[next.theme].env, nextShare);
      if (!skyLook) sky.look(skyLook = copyLook(target), lights);
      else sky.tint(blendLook(skyLook, target, dampFactor(SKY_BLEND_RATE, dt)));
      skyLook.skyLight.ground.scaleToRef(SKIRT.shade, skirtLook.diffuseColor);
      skirt.position.x = focus.x;
      skirt.position.z = focus.z;
      aim(dt, eye, focus);
      const lookX = focus.x - eye.x, lookZ = focus.z - eye.z;
      const pitchRad = Math.atan2(eye.y - focus.y, Math.hypot(lookX, lookZ));
      const seenTiles = seenGround(pitchRad).fromFocusTiles + SEEN_MARGIN_TILES;
      const behindCamera = ({ x, z, w, h }: Rect) =>
        [x, x + w].every((cx) => [z, z + h].every((cz) => (cx - eye.x) * lookX + (cz - eye.z) * lookZ < 0));
      const far: Chunk[] = [];
      for (const c of chunks) {
        const dist = distToRect(c.rect, focus.x, focus.z);
        if (dist > DROPPED_TILES) {
          if (c.drawing || c.job) drop(c);
          continue;
        }
        let level = levelAt(dist, c.level, seenTiles);
        if (level === "far" && behindCamera(c.rect)) level = "none";
        if (level !== "none" && !done(c) && dist <= MUST_BUILD_TILES && ready(c)) build(c);
        if (level !== c.level && (level === "none" || done(c))) setLevel(c, level);
        if (c.level === "far" && c.drawing) far.push(c);
      }
      buildAhead(focus);
      for (const c of chunks) if (c.level === "near" && c.drawing) c.drawing.frame(dt, eye, focus, sky);
      for (const c of far) c.idleTime += dt;
      const turn = far[farTurn++ % Math.max(far.length, 1)];
      if (turn) {
        turn.drawing!.frame(turn.idleTime, eye, focus, sky);
        turn.idleTime = 0;
      }
    },
    warm: buildAhead,
    face(yaw) {
      yawRad = yaw;
      for (const c of chunks) if (c.level !== "none") c.drawing?.face(yaw);
    },
    dispose() {
      for (const c of chunks) drop(c);
      sky.clearShadows();
      skirt.dispose();
      skirtLook.dispose();
      scene.fogStart = 0;
    },
  };
}

function copyLook(look: SkyLook): SkyLook {
  return {
    sky: look.sky.clone(), fogDensity: look.fogDensity, ambient: look.ambient.clone(),
    skyLight: { color: look.skyLight.color.clone(), ground: look.skyLight.ground.clone(), intensity: look.skyLight.intensity },
    sun: { color: look.sun.color.clone(), intensity: look.sun.intensity },
    moon: { color: look.moon.color.clone(), intensity: look.moon.intensity, nightFill: look.moon.nightFill },
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
  towards(look.moon.color, to.moon.color);
  look.fogDensity = by(look.fogDensity, to.fogDensity);
  look.skyLight.intensity = by(look.skyLight.intensity, to.skyLight.intensity);
  look.sun.intensity = by(look.sun.intensity, to.sun.intensity);
  look.moon.intensity = by(look.moon.intensity, to.moon.intensity);
  look.moon.nightFill = by(look.moon.nightFill, to.moon.nightFill);
  return look;
}
