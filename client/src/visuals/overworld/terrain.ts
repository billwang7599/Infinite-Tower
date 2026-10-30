import {
  Color3, Color4, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector4, VertexBuffer, type DynamicTexture,
  type InstancedMesh, type Mesh, type Scene,
} from "@babylonjs/core";
import { mapHalfSize, seededRandom, wrapAngle, type LevelLayout, type Vec3 } from "@infinite-tower/shared";
import { campfireLights, drawCampfire, FLICKER_TIME, LEVEL_LOOKS } from "../levels/index.js";
import { paintGround, tileProps } from "../levels/tiles.js";
import { cardYawRad, type MapLight, type Sky } from "../sky/sky.js";
import { spriteMaterial } from "../sprites.js";
import { levelWater } from "../water/level.js";
import { pixelCanvas, propTexture, PROP_ART, PX_PER_TILE, type Pen } from "./props.js";
import { cutoutMaterial, standingQuad, type OverworldScene } from "./scene.js";
import { isTall, type Ledge, type Prop, type PropKind } from "./scenery.js";

/** Every ledge is a block this deep below its top: deeper than any drop, so no gap shows under a cliff. */
const BLOCK_DEPTH = 8;
const FRINGE_TILES = 0.4;
const CAMPFIRE_TILES = 1.4;
/** Seen only by shadow maps: the camera's layer mask leaves this bit out. */
const SHADOW_ONLY_LAYER = 0x10000000;
const CARD_TURN_STEP_RAD = 0.02;

export interface LevelDrawing {
  root: TransformNode;
  frame(dt: number): void;
  face(yawRad: number): void;
}

export function buildLevel(view: OverworldScene, level: LevelLayout): LevelDrawing {
  const { scene, sky } = view, root = new TransformNode(`level-${level.id}`, scene);
  const look = LEVEL_LOOKS[level.theme], scenery = look.scenery(level);
  const lights = campfireLights(level);
  sky.look(look.env, lights);
  const lit = (name: string, tex: DynamicTexture) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseTexture = tex;
    m.specularColor = Color3.Black();
    return m;
  };
  const brick = lit("overworld-brick", tiled(pixelCanvas(scene, "brick", 32, 32, drawBricks, false)));
  const grass = lit("overworld-grass", tiled(pixelCanvas(scene, "grass", 32, 32, (p) => drawGrass(p, 32, 32, 5), false)));
  const { halfWidth, halfDepth } = mapHalfSize(level);
  const field = lit("overworld-field", pixelCanvas(scene, `field-${level.id}`, halfWidth * 2 * PX_PER_TILE,
    halfDepth * 2 * PX_PER_TILE, (pen) => paintGround(pen, level, look.tiles), false));
  const fringe = cutoutMaterial(scene, "overworld-fringe", tiled(pixelCanvas(scene, "fringe", 16, 8, drawFringe)));
  fringe.disableLighting = false;
  fringe.emissiveColor = Color3.Black();
  const water = levelWater(scene, level, look.water);

  scenery.ledges.forEach((ledge, i) => {
    const carved = i === 0 ? water.ground : null;
    const parts = buildLedge(scene, ledge, i, carved ? field : grass, brick, fringe, carved);
    for (const m of [...parts, ...carved ? [water.surface] : []]) {
      m.parent = root;
      m.receiveShadows = true;
      m.freezeWorldMatrix();
    }
    sky.castShadows(parts[0]!);
    if (carved) sky.castShadows(carved);
  });
  const props = placeProps(view, [...scenery.props, ...tileProps(level, look.tiles)], lights, root);
  const campfires = buildCampfires(view, level, root);
  const upright = [...props.upright, ...campfires.meshes];
  return {
    root,
    frame(dt) {
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

function tiled(tex: DynamicTexture): DynamicTexture {
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function buildLedge(
  scene: Scene, { rect, topY }: Ledge, i: number, top: StandardMaterial, side: StandardMaterial, fringe: StandardMaterial,
  carved: Mesh | null,
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
  const fringes = edges.map(([x, z, length, turn], k) => {
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

function placeProps(
  { scene, sky }: OverworldScene, props: Prop[], lights: MapLight[], root: TransformNode,
): PlacedProps {
  const materials = new Map<PropKind, StandardMaterial>();
  const templates = new Map<string, { quad: Mesh; card: Mesh | null }>();
  const tinted: { inst: InstancedMesh; at: Vec3 }[] = [], cards: InstancedMesh[] = [];
  const upright = props.map((p, i) => {
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
      sky.castShadows(card, "direct");
      cards.push(card);
      lights.forEach((light, k) => {
        if (Math.hypot(light.at.x - p.x, light.at.z - p.z) >= light.rangeM) return;
        const lampCard = shadowCard(`prop-card-${p.kind}-${i}-light-${k}`);
        lampCard.rotation.y = cardYawRad({ x: light.at.x - p.x, y: 0, z: light.at.z - p.z });
        lampCard.freezeWorldMatrix();
        sky.castShadows(lampCard, light);
      });
    }
    return inst;
  });
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

function drawFringe(pen: Pen): void {
  pen.rect(0, 0, 16, 2, "#4c8239");
  for (let x = 0; x < 16; x++) {
    const len = 2 + ((x * 7) % 5);
    pen.rect(x, 2, 1, len, x % 3 ? "#4c8239" : "#3b6a30");
  }
}

function buildCampfires(
  { scene }: OverworldScene, level: LevelLayout, root: TransformNode,
): { meshes: Mesh[]; flicker: (dt: number) => void } {
  if (level.campfires.length === 0) return { meshes: [], flicker: () => {} };
  const frames = ([0, 1] as const).map((f) => spriteMaterial(scene, `campfire-${f}`, drawCampfire(f)));
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
