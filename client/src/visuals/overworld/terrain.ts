import {
  Color3, Color4, MeshBuilder, TransformNode, Vector4, VertexBuffer, type AbstractMesh, type InstancedMesh, type Mesh,
  type Scene, type StandardMaterial,
} from "@babylonjs/core";
import {
  dampFactor, regionAt, wrapAngle, type Rect, type Theme, type Vec3, type WorldMap,
} from "@infinite-tower/shared";
import type { WaterMap } from "../../modes/overworld/water.js";
import { FLICKER_TIME, tileLooksOf } from "../regions/index.js";
import { paintGround, tileProps } from "../regions/tiles.js";
import { cardYawRad, type MapLight, type Sky } from "../sky/sky.js";
import { chunkWater } from "../water/chunk.js";
import { PX_PER_TILE } from "../../gfx/grid.js";
import { pixelCanvas } from "../sprites.js";
import { Pen } from "./props.js";
import { standingQuad } from "./scene.js";
import { chunkScenery, hidesWalker, type Ledge, type Prop } from "./scenery.js";
import { lit, SHADOW_ONLY_LAYER, type TerrainArt } from "./terrainArt.js";

/** Every ledge is a block this deep below its top: deeper than any drop, so no gap shows under a cliff. */
const BLOCK_DEPTH = 8;
const CAMPFIRE_TILES = 1.4;
const CARD_TURN_STEP_RAD = 0.02;
const SEE_THROUGH = { visibility: 0.15, rate: 12 };

/** `only`: cast by the sun or moon alone, or by that map light alone. */
export type Caster = [AbstractMesh, ("direct" | MapLight)?];

export interface ChunkDrawing {
  meshes: AbstractMesh[];
  casters: Caster[];
  frame(dt: number, eye: Vec3, feet: Vec3, sky: Sky): void;
  face(yawRad: number): void;
  dispose(): void;
}

// Every mesh goes under the hidden root before a yield, or it would show half built.
export function* buildChunk(
  scene: Scene, map: WorldMap, water: WaterMap, chunk: Rect, art: TerrainArt, lights: readonly MapLight[],
): Generator<void, ChunkDrawing> {
  const name = `${chunk.x},${chunk.z}`, root = new TransformNode(`chunk-${name}`, scene);
  root.setEnabled(false);
  const looksAt = tileLooksOf(map), scenery = chunkScenery(map, chunk), casters: Caster[] = [];
  yield;
  const canvas = pixelCanvas(scene, `chunk-${name}`, chunk.w * PX_PER_TILE, chunk.h * PX_PER_TILE, () => {}, false);
  yield* paintGround(new Pen(canvas.getContext() as CanvasRenderingContext2D), map, chunk, looksAt);
  canvas.update();
  const field = lit(scene, `chunk-field-${name}`, canvas);
  const carved = yield* chunkWater(scene, map, water, chunk, art.water(mainTheme(map, chunk)), root);

  const standing: { ledge: Ledge; parts: Mesh[] }[] = [];
  for (const [i, ledge] of scenery.ledges.entries()) {
    const ground = i === 0 ? carved.ground : null;
    const [top, side] = art.looks[ledge.look ?? "castle"];
    const parts = buildLedge(scene, ledge, `${name}-${i}`, ground ? field : top, side, ground);
    const awning = ledge.awning ? art.stalls.awning({ ...ledge, awning: ledge.awning }, i) : [];
    parts.push(...awning);
    for (const m of awning) casters.push([m]);
    for (const m of [...parts, ...ground && carved.surface ? [carved.surface] : []]) {
      m.parent = root;
      m.receiveShadows = true;
      m.freezeWorldMatrix();
    }
    casters.push([parts[0]!]);
    if (ground) casters.push([ground]);
    if (ledge.topY > 0) standing.push({ ledge, parts });
    yield;
  }
  const props = yield* placeProps(art, [...scenery.props, ...tileProps(map, chunk, looksAt)], lights, root, casters);
  const campfires = buildCampfires(scene, art.fire, map, chunk, root);
  const upright = [...props.upright, ...campfires.meshes];
  const meshes = root.getChildMeshes();
  detach(scene, meshes);
  root.setEnabled(true);
  return {
    meshes,
    casters,
    frame(dt, eye, feet, sky) {
      const k = dampFactor(SEE_THROUGH.rate, dt);
      for (const { ledge, parts } of standing) {
        const want = hidesWalker(ledge, eye, feet) ? SEE_THROUGH.visibility : 1;
        for (const m of parts) m.visibility += (want - m.visibility) * k;
      }
      campfires.flicker(dt);
      props.light(sky);
    },
    face(yawRad) {
      for (const m of upright) {
        m.rotation.y = yawRad;
        m.freezeWorldMatrix();
      }
    },
    dispose() {
      root.dispose(false, false);
      field.dispose(true, true);
    },
  };
}

function mainTheme(map: WorldMap, chunk: Rect): Theme {
  const most = map.regions.reduce((best, r) => (overlapArea(r.area, chunk) > overlapArea(best.area, chunk) ? r : best));
  if (overlapArea(most.area, chunk) > 0) return most.theme;
  return regionAt(map, chunk.x + chunk.w / 2, chunk.z + chunk.h / 2).theme;
}

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z));

/** One pass: scene.removeMesh splices once per mesh. */
export function detach(scene: Scene, meshes: readonly AbstractMesh[]): void {
  const gone = new Set(meshes);
  let kept = 0;
  for (const m of scene.meshes) if (!gone.has(m)) scene.meshes[kept++] = m;
  scene.meshes.length = kept;
}

function buildLedge(
  scene: Scene, { rect, topY }: Ledge, name: string, top: StandardMaterial, side: StandardMaterial,
  carved: Mesh | null,
): Mesh[] {
  const cx = rect.x + rect.w / 2, cz = rect.z + rect.h / 2, wide = (n: number) => new Vector4(0, 0, n / 2, BLOCK_DEPTH / 2);
  const block = MeshBuilder.CreateBox(`ledge-${name}`, {
    width: rect.w, depth: rect.h, height: BLOCK_DEPTH, wrap: true,
    faceUV: [wide(rect.w), wide(rect.w), wide(rect.h), wide(rect.h), wide(0), wide(0)],
  }, scene);
  block.position.set(cx, topY - BLOCK_DEPTH / 2 - 0.01, cz);
  block.material = side;
  if (carved) {
    // Open-topped, so the water's bed shows through the carved ground's holes.
    const normals = block.getVerticesData(VertexBuffer.NormalKind)!, indices = block.getIndices()!;
    block.setIndices(indices.filter((_, k) => normals[indices[k - (k % 3)]! * 3 + 1]! < 0.5));
  }
  const ground = carved ?? MeshBuilder.CreateGround(`ledge-top-${name}`, { width: rect.w, height: rect.h }, scene);
  if (!carved) {
    ground.position.set(cx, topY, cz);
    scaleUVs(ground, rect.w / 2, rect.h / 2);
  }
  ground.material = top;
  return [block, ground];
}

function scaleUVs(mesh: Mesh, u: number, v: number): void {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!;
  for (let k = 0; k < uvs.length; k += 2) { uvs[k] = uvs[k]! * u; uvs[k + 1] = uvs[k + 1]! * v; }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

interface PlacedProps { upright: InstancedMesh[]; light(sky: Sky): void }

function* placeProps(
  art: TerrainArt, props: Prop[], lights: readonly MapLight[], root: TransformNode, casters: Caster[],
): Generator<void, PlacedProps> {
  const tinted: { inst: InstancedMesh; at: Vec3 }[] = [], cards: InstancedMesh[] = [];
  const upright: InstancedMesh[] = [];
  for (const [i, p] of props.entries()) {
    const tpl = art.prop(p.kind, i % 2 === 1);
    const inst = tpl.quad.createInstance(`prop-${p.kind}-${i}`);
    inst.parent = root;
    inst.position.set(p.x, p.y, p.z);
    inst.scaling.setAll(p.scale);
    inst.instancedBuffers.color = new Color4(1, 1, 1, 1);
    tinted.push({ inst, at: { x: p.x, y: p.y + (tpl.height * p.scale) / 2, z: p.z } });
    if (tpl.card) {
      const shadowCard = (cardName: string) => {
        const card = tpl.card!.createInstance(cardName);
        card.parent = root;
        card.layerMask = SHADOW_ONLY_LAYER;
        card.position.copyFrom(inst.position);
        card.scaling.copyFrom(inst.scaling);
        return card;
      };
      const card = shadowCard(`prop-card-${p.kind}-${i}`);
      casters.push([card, "direct"]);
      cards.push(card);
      lights.forEach((light, k) => {
        if (Math.hypot(light.at.x - p.x, light.at.z - p.z) >= light.rangeM) return;
        const lampCard = shadowCard(`prop-card-${p.kind}-${i}-light-${k}`);
        lampCard.rotation.y = cardYawRad({ x: light.at.x - p.x, y: 0, z: light.at.z - p.z });
        lampCard.freezeWorldMatrix();
        casters.push([lampCard, light]);
      });
    }
    upright.push(inst);
    if (i % 64 === 63) yield;
  }
  const tint = new Color3();
  let cardYaw = NaN;
  return {
    upright,
    light(sky) {
      for (const { inst, at } of tinted) {
        sky.tintAt(at, tint);
        const color = inst.instancedBuffers.color as Color4;
        color.set(tint.r, tint.g, tint.b, 1);
      }
      const yaw = sky.cardYaw();
      if (Math.abs(wrapAngle(yaw - cardYaw)) < CARD_TURN_STEP_RAD) return;
      cardYaw = yaw;
      for (const card of cards) {
        card.rotation.y = yaw;
        card.freezeWorldMatrix();
      }
    },
  };
}

function buildCampfires(
  scene: Scene, frames: StandardMaterial[], map: WorldMap, chunk: Rect, root: TransformNode,
): { meshes: Mesh[]; flicker: (dt: number) => void } {
  const inChunk = map.campfires.filter((c) =>
    c.x >= chunk.x && c.x < chunk.x + chunk.w && c.z >= chunk.z && c.z < chunk.z + chunk.h);
  if (inChunk.length === 0) return { meshes: [], flicker: () => {} };
  const fires = inChunk.map((c, i) => {
    const m = standingQuad(scene, `campfire-${chunk.x},${chunk.z}-${i}`, CAMPFIRE_TILES, CAMPFIRE_TILES, 0.1);
    m.position.set(c.x, 0, c.z);
    m.material = frames[0]!;
    m.parent = root;
    return m;
  });
  let time = 0;
  const flicker = (dt: number) => {
    time += dt;
    const frame = frames[Math.floor(time / FLICKER_TIME) % 2]!;
    for (const m of fires) m.material = frame;
  };
  return { meshes: fires, flicker };
}
