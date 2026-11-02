import {
  Color3, Color4, DynamicTexture, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector4, VertexBuffer,
  type AbstractMesh, type InstancedMesh, type Mesh, type Scene,
} from "@babylonjs/core";
import { dampFactor, mapHalfSize, seededRandom, wrapAngle, type LevelMap, type Vec3 } from "@infinite-tower/shared";
import { campfireLights, drawCampfire, FLICKER_TIME, LEVEL_LOOKS } from "../levels/index.js";
import { paintGround, tileProps } from "../levels/tiles.js";
import { cardYawRad, type MapLight, type Sky } from "../sky/sky.js";
import { pixelCanvas, spriteMaterial } from "../sprites.js";
import { levelWater } from "../water/level.js";
import { PX_PER_TILE } from "../../gfx/grid.js";
import { Pen, PROP_ART } from "./props.js";
import { cutoutMaterial, standingQuad, type OverworldScene } from "./scene.js";
import { stallLooks, type StallLooks } from "./stalls.js";
import { hidesWalker, isTall, openExits, type Ledge, type Prop, type PropKind } from "./scenery.js";

/** Every ledge is a block this deep below its top: deeper than any drop, so no gap shows under a cliff. */
const BLOCK_DEPTH = 8;
const FRINGE_TILES = 0.4;
const CAMPFIRE_TILES = 1.4;
/** Seen only by shadow maps: the camera's layer mask leaves this bit out. */
const SHADOW_ONLY_LAYER = 0x10000000;
const CARD_TURN_STEP_RAD = 0.02;
const SEE_THROUGH = { visibility: 0.15, rate: 12 };

export interface LevelDrawing {
  enter(): void;
  leave(): void;
  frame(dt: number, eye: Vec3, feet: Vec3): void;
  face(yawRad: number): void;
}

type Caster = [AbstractMesh, ("direct" | MapLight)?];

interface LevelArt {
  looks: Record<
    NonNullable<Ledge["look"]> | "grass", readonly [StandardMaterial, StandardMaterial, StandardMaterial | null]
  >;
  stalls: StallLooks;
  props: Map<PropKind, StandardMaterial>;
  fire: StandardMaterial[];
}

export interface LevelDrawings {
  of(level: LevelMap): LevelDrawing;
  warm(levels: readonly LevelMap[], budgetMs: number): void;
}

export function levelDrawings(view: OverworldScene): LevelDrawings {
  const built = new Map<string, LevelDrawing>(), building = new Map<string, Generator<void, LevelDrawing>>();
  let art: LevelArt | undefined;
  const step = (level: LevelMap) => {
    let job = building.get(level.id);
    if (!job) building.set(level.id, job = buildLevel(view, level, art ??= levelArt(view.scene)));
    const next = job.next();
    if (!next.done) return;
    building.delete(level.id);
    built.set(level.id, next.value);
  };
  return {
    of(level) {
      while (!built.has(level.id)) step(level);
      return built.get(level.id)!;
    },
    warm(levels, budgetMs) {
      const untilMs = performance.now() + budgetMs;
      for (const level of levels) {
        while (!built.has(level.id)) {
          if (performance.now() >= untilMs) return;
          step(level);
        }
      }
    },
  };
}

function lit(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  return m;
}

function levelArt(scene: Scene): LevelArt {
  const tile = (name: string, draw: (pen: Pen) => void) =>
    lit(scene, `overworld-${name}`, tiled(pixelCanvas(scene, name, 32, 32, draw, false)));
  const brick = tile("brick", drawBricks), grass = tile("grass", (p) => drawGrass(p, 32, 32, 5));
  const fringe = cutoutMaterial(scene, "overworld-fringe", tiled(pixelCanvas(scene, "fringe", 16, 8, drawFringe)));
  fringe.disableLighting = false;
  fringe.emissiveColor = Color3.Black();
  const stalls = stallLooks(scene, (name, tex) => lit(scene, name, tex), brick);
  return {
    looks: {
      grass: [grass, brick, fringe], castle: [brick, brick, null],
      house: [tile("roof", drawRoof), tile("plaster", drawPlaster), null],
      counter: stalls.counter, hearth: stalls.hearth,
      quarry: [tile("cut-top", drawCutTop), tile("cut-face", drawCutFace), null],
    },
    stalls,
    props: new Map(),
    fire: ([0, 1] as const).map((f) => spriteMaterial(scene, `campfire-${f}`, drawCampfire(f))),
  };
}

// Every mesh goes under the hidden root before a yield, or it would show on the level being walked.
function* buildLevel(view: OverworldScene, level: LevelMap, art: LevelArt): Generator<void, LevelDrawing> {
  const { scene, sky } = view, root = new TransformNode(`level-${level.id}`, scene);
  root.setEnabled(false);
  const look = LEVEL_LOOKS[level.theme], scenery = openExits(look.scenery(level), level);
  const lights = campfireLights(level);
  const casters: Caster[] = [];
  const { halfWidth, halfDepth } = mapHalfSize(level);
  yield;
  const ground = pixelCanvas(scene, `field-${level.id}`, halfWidth * 2 * PX_PER_TILE, halfDepth * 2 * PX_PER_TILE,
    () => {}, false);
  yield* paintGround(new Pen(ground.getContext() as CanvasRenderingContext2D), level, look.tiles);
  ground.update();
  const field = lit(scene, `overworld-field-${level.id}`, ground);
  const water = yield* levelWater(scene, level, look.water, root);

  const standing: { ledge: Ledge; parts: Mesh[] }[] = [];
  for (const [i, ledge] of scenery.ledges.entries()) {
    const carved = i === 0 ? water.ground : null;
    const [top, side, edge] = art.looks[ledge.look ?? "grass"];
    const parts = buildLedge(scene, ledge, i, carved ? field : top, side, edge, carved);
    const awning = ledge.awning ? art.stalls.awning({ ...ledge, awning: ledge.awning }, i) : [];
    parts.push(...awning);
    for (const m of awning) casters.push([m]);
    for (const m of [...parts, ...carved ? [water.surface] : []]) {
      m.parent = root;
      m.receiveShadows = true;
      m.freezeWorldMatrix();
    }
    casters.push([parts[0]!]);
    if (carved) casters.push([carved]);
    if (ledge.topY > 0) standing.push({ ledge, parts });
    yield;
  }
  const props = yield* placeProps(
    scene, art.props, [...scenery.props, ...tileProps(level, look.tiles)], lights, root, casters,
  );
  const campfires = buildCampfires(scene, art.fire, level, root);
  const upright = [...props.upright, ...campfires.meshes];
  const meshes = root.getChildMeshes();
  detach(scene, meshes);
  root.setEnabled(true);
  return {
    enter() {
      for (const m of meshes) scene.addMesh(m);
      sky.look(look.env, lights);
      for (const [m, only] of casters) sky.castShadows(m, only);
    },
    leave() {
      detach(scene, meshes);
      sky.clearShadows();
    },
    frame(dt, eye, feet) {
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
  };
}

// Out of the scene, a hidden level costs the frame nothing. One pass: scene.removeMesh splices once per mesh.
function detach(scene: Scene, meshes: AbstractMesh[]): void {
  const gone = new Set(meshes);
  let kept = 0;
  for (const m of scene.meshes) if (!gone.has(m)) scene.meshes[kept++] = m;
  scene.meshes.length = kept;
}

function tiled(tex: DynamicTexture): DynamicTexture {
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function buildLedge(
  scene: Scene, { rect, topY }: Ledge, i: number, top: StandardMaterial, side: StandardMaterial,
  fringe: StandardMaterial | null, carved: Mesh | null,
): Mesh[] {
  const cx = rect.x + rect.w / 2, cz = rect.z + rect.h / 2, wide = (n: number) => new Vector4(0, 0, n / 2, BLOCK_DEPTH / 2);
  const block = MeshBuilder.CreateBox(`ledge-${i}`, {
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
  const ground = carved ?? MeshBuilder.CreateGround(`ledge-top-${i}`, { width: rect.w, height: rect.h }, scene);
  if (!carved) ground.position.set(cx, topY, cz);
  ground.material = top;
  if (i > 0) scaleUVs(ground, rect.w / 2, rect.h / 2);
  const edges: [number, number, number, number][] = [
    [cx, rect.z - 0.02, rect.w, 0], [cx, rect.z + rect.h + 0.02, rect.w, Math.PI],
    [rect.x - 0.02, cz, rect.h, Math.PI / 2], [rect.x + rect.w + 0.02, cz, rect.h, -Math.PI / 2],
  ];
  const fringes = fringe === null ? [] : edges.map(([x, z, length, turn], k) => {
    const f = MeshBuilder.CreatePlane(`ledge-fringe-${i}-${k}`, { width: length, height: FRINGE_TILES }, scene);
    f.position.set(x, topY - FRINGE_TILES / 2 + 0.03, z);
    f.rotation.y = turn;
    f.material = fringe;
    scaleUVs(f, length, 1);
    return f;
  });
  return [block, ground, ...fringes];
}

/** Mirrors the picture without a negative scale, which would draw each instance on its own. */
function mirrorUVs(mesh: Mesh): void {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!;
  for (let k = 0; k < uvs.length; k += 2) uvs[k] = 1 - uvs[k]!;
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

function scaleUVs(mesh: Mesh, u: number, v: number): void {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!;
  for (let k = 0; k < uvs.length; k += 2) { uvs[k] = uvs[k]! * u; uvs[k + 1] = uvs[k + 1]! * v; }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

interface PlacedProps { upright: InstancedMesh[]; light(sky: Sky): void }

function* placeProps(
  scene: Scene, materials: Map<PropKind, StandardMaterial>, props: Prop[], lights: MapLight[], root: TransformNode,
  casters: Caster[],
): Generator<void, PlacedProps> {
  const templates = new Map<string, { quad: Mesh; card: Mesh | null }>();
  const tinted: { inst: InstancedMesh; at: Vec3 }[] = [], cards: InstancedMesh[] = [];
  const upright: InstancedMesh[] = [];
  for (const [i, p] of props.entries()) {
    const mirrored = i % 2 === 1, key = `${p.kind}${mirrored ? "-mirrored" : ""}`;
    const art = PROP_ART[p.kind], width = art.widthPx / PX_PER_TILE, height = art.heightPx / PX_PER_TILE;
    let tpl = templates.get(key);
    if (!tpl) {
      let material = materials.get(p.kind);
      if (!material) {
        materials.set(p.kind, material = cutoutMaterial(scene, `prop-${p.kind}`, propTexture(scene, p.kind, 31)));
      }
      const quad = standingQuad(scene, `prop-${key}`, width, height);
      quad.material = material;
      quad.registerInstancedBuffer(VertexBuffer.ColorKind, 4);
      quad.instancedBuffers.color = new Color4(1, 1, 1, 1);
      let card: Mesh | null = null;
      if (isTall(p.kind)) {
        // Its shadow comes from an upright card turned to the light, never edge-on as the quad turns to the camera.
        card = standingQuad(scene, `prop-card-${key}`, width, height);
        card.rotation.x = 0;
        card.material = material;
        card.layerMask = SHADOW_ONLY_LAYER;
        card.isVisible = false;
        card.parent = root;
      }
      for (const m of [quad, card]) if (m && mirrored) mirrorUVs(m);
      quad.isVisible = false;
      quad.parent = root;
      templates.set(key, tpl = { quad, card });
    }
    const inst = tpl.quad.createInstance(`prop-${p.kind}-${i}`);
    inst.parent = root;
    inst.position.set(p.x, p.y, p.z);
    inst.scaling.setAll(p.scale);
    inst.instancedBuffers.color = new Color4(1, 1, 1, 1);
    tinted.push({ inst, at: { x: p.x, y: p.y + (height * p.scale) / 2, z: p.z } });
    if (tpl.card) {
      const shadowCard = (name: string) => {
        const card = tpl.card!.createInstance(name);
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
    yield;
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

function drawGrass(pen: Pen, w: number, h: number, seed: number): void {
  const rand = seededRandom(seed);
  pen.rect(0, 0, w, h, "#5b8a3c");
  for (let i = 0; i < (w * h) / 1400; i++) {
    const x = rand() * w, y = rand() * h, c = rand() < 0.5 ? "#62903f" : "#55843a";
    for (let k = 0; k < 5; k++) {
      const bx = x + (rand() - 0.5) * 24, by = y + (rand() - 0.5) * 12, r = 3 + rand() * 6;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) pen.disc(bx + ox, by + oy, r, c);
    }
  }
  for (let i = 0; i < (w * h) / 12; i++) {
    const x = Math.floor(rand() * w), y = Math.floor(rand() * h), r = rand();
    pen.rect(x, y, 1, 2, r < 0.5 ? "#476f32" : "#527d38");
    if (r > 0.7) pen.rect(x, y, 1, 1, r > 0.95 ? "#a9c464" : "#7ea64a");
  }
}

function drawBricks(pen: Pen): void {
  const rand = seededRandom(3);
  pen.rect(0, 0, 32, 32, "#3a3540");
  for (let row = 0; row < 4; row++) {
    const y = row * 8, shift = row % 2 ? 6 : 0;
    for (let x = -shift; x < 32; x += 12) {
      const tone = ["#7a7280", "#6c6573", "#857c89", "#71697a"][Math.floor(rand() * 4)]!;
      pen.rect(x + 1, y + 1, 11, 6, tone);
      pen.rect(x + 1, y + 1, 11, 1, "#9a92a0");
      pen.rect(x + 1, y + 6, 11, 1, "#55505c");
      if (rand() < 0.35) pen.rect(x + 2 + rand() * 7, y + 5, 3, 2, "#4f7a3a");
    }
  }
}

function drawPlaster(pen: Pen): void {
  const rand = seededRandom(7);
  pen.rect(0, 0, 32, 32, "#b9ad94");
  for (let i = 0; i < 40; i++) pen.rect(rand() * 32, rand() * 32, 2, 1, rand() < 0.5 ? "#a99d84" : "#c6bba3");
  for (const x of [0, 15]) {
    pen.rect(x, 0, 2, 32, "#4a3324");
    pen.rect(x, 0, 1, 32, "#5e4330");
  }
  pen.rect(0, 0, 32, 2, "#4a3324");
  pen.rect(0, 16, 32, 2, "#4a3324");
  pen.rect(5, 6, 6, 6, "#2c2a33");
  pen.rect(5, 6, 6, 1, "#4a3324");
  pen.rect(7, 7, 1, 5, "#6b5a3e");
  pen.rect(20, 22, 6, 6, "#2c2a33");
  pen.rect(20, 22, 6, 1, "#4a3324");
}

function drawRoof(pen: Pen): void {
  const rand = seededRandom(9);
  pen.rect(0, 0, 32, 32, "#6e3328");
  for (let row = 0; row < 8; row++) {
    const y = row * 4, shift = row % 2 ? 2 : 0;
    for (let x = -shift; x < 32; x += 4) {
      pen.rect(x, y, 3, 3, ["#8a4433", "#7d3c2e", "#94503b"][Math.floor(rand() * 3)]!);
      pen.rect(x, y + 3, 4, 1, "#4f241c");
    }
  }
}

const CUT = {
  joint: "#8a806c", face: ["#b9af98", "#b0a68f", "#c2b8a1"], hi: "#d2c9b3", lo: "#9c927d", drill: "#7a705e",
};
const CUT_SLABS = [
  [0, 0, 15, 11], [16, 0, 16, 11], [0, 12, 20, 9], [21, 12, 11, 9], [0, 22, 11, 10], [12, 22, 20, 10],
] as const;

function drawCutTop(pen: Pen): void {
  const rand = seededRandom(11);
  pen.rect(0, 0, 32, 32, CUT.joint);
  for (const [x, y, w, h] of CUT_SLABS) {
    pen.rect(x, y, w, h, CUT.face[Math.floor(rand() * 3)]!);
    pen.rect(x, y, w, 1, CUT.hi);
  }
  for (let i = 0; i < 40; i++) pen.rect(rand() * 32, rand() * 32, 1, 1, rand() < 0.5 ? CUT.lo : CUT.hi);
}

function drawCutFace(pen: Pen): void {
  const rand = seededRandom(13);
  pen.rect(0, 0, 32, 32, CUT.joint);
  for (let row = 0; row < 4; row++) {
    const y = row * 8, shift = row % 2 ? 8 : 0;
    for (let x = -shift; x < 32; x += 16) {
      pen.rect(x + 1, y + 1, 15, 7, CUT.face[Math.floor(rand() * 3)]!);
      pen.rect(x + 1, y + 1, 15, 1, CUT.hi);
      pen.rect(x + 1, y + 7, 15, 1, CUT.lo);
      for (let k = 3; k < 15; k += 4) if (rand() < 0.5) pen.rect(x + k, y + 2, 1, 4, CUT.drill);
    }
  }
}

function drawFringe(pen: Pen): void {
  pen.rect(0, 0, 16, 2, "#4c8239");
  for (let x = 0; x < 16; x++) {
    const len = 2 + ((x * 7) % 5);
    pen.rect(x, 2, 1, len, x % 3 ? "#4c8239" : "#3b6a30");
  }
}

function buildCampfires(
  scene: Scene, frames: StandardMaterial[], level: LevelMap, root: TransformNode,
): { meshes: Mesh[]; flicker: (dt: number) => void } {
  if (level.campfires.length === 0) return { meshes: [], flicker: () => {} };
  const fires = level.campfires.map((c, i) => {
    const m = standingQuad(scene, `campfire-${i}`, CAMPFIRE_TILES, CAMPFIRE_TILES, 0.1);
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

function propTexture(scene: Scene, kind: PropKind, seed: number): DynamicTexture {
  const art = PROP_ART[kind], rand = seededRandom(seed);
  return pixelCanvas(scene, `prop-${kind}`, art.widthPx, art.heightPx, (pen) => art.draw(pen, rand));
}
