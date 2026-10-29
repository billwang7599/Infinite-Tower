import {
  Color3, MeshBuilder, PointLight, StandardMaterial, Texture, TransformNode, Vector3, Vector4, VertexBuffer, type DynamicTexture,
  type AbstractMesh, type Mesh, type Scene,
} from "@babylonjs/core";
import { mapHalfSize, seededRandom, type LevelLayout } from "@infinite-tower/shared";
import { drawCampfire, FLICKER_TIME, LEVEL_LOOKS } from "../levels/index.js";
import { paintGround, tileProps } from "../levels/tiles.js";
import { spriteMaterial } from "../sprites.js";
import { pixelCanvas, propTexture, PROP_ART, PX_PER_TILE, type Pen } from "./props.js";
import { cutoutMaterial, spriteLook, standingQuad, type OverworldScene } from "./scene.js";
import { isTall, type Ledge, type Prop, type PropKind } from "./scenery.js";

/** Every ledge is a block this deep below its top: deeper than any drop, so no gap shows under a cliff. */
const BLOCK_DEPTH = 8;
const FRINGE_TILES = 0.4;
const CAMPFIRE_TILES = 1.4;

export interface LevelDrawing {
  root: TransformNode;
  flicker(dt: number): void;
  face(yawRad: number): void;
}

export function buildLevel(view: OverworldScene, level: LevelLayout): LevelDrawing {
  const { scene, sunShadows } = view, root = new TransformNode(`level-${level.id}`, scene);
  const look = LEVEL_LOOKS[level.theme], scenery = look.scenery(level);
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

  scenery.ledges.forEach((ledge, i) => {
    const parts = buildLedge(scene, ledge, i, i === 0 ? field : grass, brick, fringe);
    for (const m of parts) {
      m.parent = root;
      m.receiveShadows = true;
      m.freezeWorldMatrix();
    }
  });
  const upright = placeProps(view, [...scenery.props, ...tileProps(level, look.tiles)], root);
  const campfires = buildCampfires(view, level, root, sunShadows);
  upright.push(...campfires.meshes);
  return {
    root, flicker: campfires.flicker,
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
): Mesh[] {
  const cx = rect.x + rect.w / 2, cz = rect.z + rect.h / 2, wide = (n: number) => new Vector4(0, 0, n / 2, BLOCK_DEPTH / 2);
  const block = MeshBuilder.CreateBox(`ledge-${i}`, {
    width: rect.w, depth: rect.h, height: BLOCK_DEPTH, wrap: true,
    faceUV: [wide(rect.w), wide(rect.w), wide(rect.h), wide(rect.h), wide(0), wide(0)],
  }, scene);
  block.position.set(cx, topY - BLOCK_DEPTH / 2 - 0.01, cz);
  block.material = side;
  const ground = MeshBuilder.CreateGround(`ledge-top-${i}`, { width: rect.w, height: rect.h }, scene);
  ground.position.set(cx, topY, cz);
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

function scaleUVs(mesh: Mesh, u: number, v: number): void {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!;
  for (let k = 0; k < uvs.length; k += 2) { uvs[k] = uvs[k]! * u; uvs[k + 1] = uvs[k + 1]! * v; }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

/** One template quad per kind, every prop an instance of it (one draw call a kind). */
function placeProps({ scene, sunShadows }: OverworldScene, props: Prop[], root: TransformNode): AbstractMesh[] {
  const templates = new Map<PropKind, Mesh>();
  return props.map((p, i) => {
    let tpl = templates.get(p.kind);
    if (!tpl) {
      const art = PROP_ART[p.kind];
      tpl = standingQuad(scene, `prop-${p.kind}`, art.widthPx / PX_PER_TILE, art.heightPx / PX_PER_TILE);
      tpl.material = cutoutMaterial(scene, `prop-${p.kind}`, propTexture(scene, p.kind, 31));
      tpl.isVisible = false;
      tpl.parent = root;
      if (isTall(p.kind)) sunShadows.addShadowCaster(tpl);
      templates.set(p.kind, tpl);
    }
    const inst = tpl.createInstance(`prop-${p.kind}-${i}`);
    inst.parent = root;
    inst.position.set(p.x, p.y, p.z);
    inst.scaling.setAll(p.scale);
    if (i % 2 === 1) inst.scaling.x = -p.scale;
    return inst;
  });
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
  { scene }: OverworldScene, level: LevelLayout, root: TransformNode, shadows: OverworldScene["sunShadows"],
): { meshes: Mesh[]; flicker: (dt: number) => void } {
  if (level.campfires.length === 0) return { meshes: [], flicker: () => {} };
  const frames = ([0, 1] as const).map((f) => {
    const m = spriteLook(spriteMaterial(scene, `campfire-${f}`, drawCampfire(f)));
    m.emissiveColor = Color3.White();
    return m;
  });
  const fires = level.campfires.map((c, i) => {
    const m = standingQuad(scene, `campfire-${i}`, CAMPFIRE_TILES, CAMPFIRE_TILES, 0.1);
    m.position.set(c.x, 0, c.z);
    m.material = frames[0]!;
    m.parent = root;
    shadows.addShadowCaster(m);
    const light = new PointLight(`campfire-light-${i}`, m.position.add(new Vector3(0, 1.2, -0.3)), scene);
    light.diffuse = new Color3(1, 0.55, 0.22);
    light.specular = Color3.Black();
    light.range = 10;
    light.parent = root;
    return { m, light };
  });
  let time = 0;
  const flicker = (dt: number) => {
    time += dt;
    const frame = frames[Math.floor(time / FLICKER_TIME) % 2]!;
    for (const { m, light } of fires) {
      m.material = frame;
      light.intensity = 3 + Math.sin(time * 13) * 0.15 + Math.sin(time * 7.3) * 0.2;
    }
  };
  return { meshes: fires.map((f) => f.m), flicker };
}
