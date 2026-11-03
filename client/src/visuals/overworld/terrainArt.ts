import {
  Color3, Color4, StandardMaterial, Texture, VertexBuffer, type DynamicTexture, type Mesh, type Scene,
} from "@babylonjs/core";
import { seededRandom, type Theme } from "@infinite-tower/shared";
import { drawCampfire, REGION_LOOKS } from "../regions/index.js";
import { spriteMaterial } from "../sprites.js";
import { waterMaterial } from "../water/water.js";
import { PX_PER_TILE } from "../../gfx/grid.js";
import { pixelCanvas } from "../sprites.js";
import { PROP_ART, type Pen } from "./props.js";
import { cutoutMaterial, standingQuad } from "./scene.js";
import { isTall, type Ledge, type PropKind } from "./scenery.js";
import { stallLooks, type StallLooks } from "./stalls.js";

/** Seen only by shadow maps: the camera's layer mask leaves this bit out. */
export const SHADOW_ONLY_LAYER = 0x10000000;

export interface PropTemplate { quad: Mesh; card: Mesh | null; height: number }

export interface TerrainArt {
  looks: Record<NonNullable<Ledge["look"]>, readonly [StandardMaterial, StandardMaterial]>;
  stalls: StallLooks;
  fire: StandardMaterial[];
  water(theme: Theme): StandardMaterial;
  prop(kind: PropKind, mirrored: boolean): PropTemplate;
}

export function lit(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  return m;
}

function tiled(tex: DynamicTexture): DynamicTexture {
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

export function terrainArt(scene: Scene): TerrainArt {
  const tile = (name: string, draw: (pen: Pen) => void) =>
    lit(scene, `overworld-${name}`, tiled(pixelCanvas(scene, name, 32, 32, draw, false)));
  const brick = tile("brick", drawBricks);
  const stalls = stallLooks(scene, (name, tex) => lit(scene, name, tex), brick);
  const waters = new Map<Theme, StandardMaterial>(), materials = new Map<PropKind, StandardMaterial>();
  const templates = new Map<string, PropTemplate>();
  return {
    looks: {
      castle: [brick, brick],
      house: [tile("roof", drawRoof), tile("plaster", drawPlaster)],
      counter: stalls.counter, hearth: stalls.hearth,
      quarry: [tile("cut-top", drawCutTop), tile("cut-face", drawCutFace)],
    },
    stalls,
    fire: ([0, 1] as const).map((f) => spriteMaterial(scene, `campfire-${f}`, drawCampfire(f))),
    water(theme) {
      let m = waters.get(theme);
      if (!m) waters.set(theme, m = waterMaterial(scene, `water-${theme}`, REGION_LOOKS[theme].water));
      return m;
    },
    prop(kind, mirrored) {
      const key = `${kind}${mirrored ? "-mirrored" : ""}`;
      let tpl = templates.get(key);
      if (tpl) return tpl;
      const art = PROP_ART[kind], width = art.widthPx / PX_PER_TILE, height = art.heightPx / PX_PER_TILE;
      let material = materials.get(kind);
      if (!material) materials.set(kind, material = cutoutMaterial(scene, `prop-${kind}`, propTexture(scene, kind, 31)));
      const quad = standingQuad(scene, `prop-${key}`, width, height);
      quad.material = material;
      quad.registerInstancedBuffer(VertexBuffer.ColorKind, 4);
      quad.instancedBuffers.color = new Color4(1, 1, 1, 1);
      let card: Mesh | null = null;
      if (isTall(kind)) {
        // Its shadow comes from an upright card turned to the light, never edge-on as the quad turns to the camera.
        card = standingQuad(scene, `prop-card-${key}`, width, height);
        card.rotation.x = 0;
        card.material = material;
        card.layerMask = SHADOW_ONLY_LAYER;
        card.isVisible = false;
      }
      for (const m of [quad, card]) if (m && mirrored) mirrorUVs(m);
      quad.isVisible = false;
      templates.set(key, tpl = { quad, card, height });
      return tpl;
    },
  };
}

function propTexture(scene: Scene, kind: PropKind, seed: number): DynamicTexture {
  const art = PROP_ART[kind], rand = seededRandom(seed);
  return pixelCanvas(scene, `prop-${kind}`, art.widthPx, art.heightPx, (pen) => art.draw(pen, rand));
}

/** Mirrors the picture without a negative scale, which would draw each instance on its own. */
function mirrorUVs(mesh: Mesh): void {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!;
  for (let k = 0; k < uvs.length; k += 2) uvs[k] = 1 - uvs[k]!;
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
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
