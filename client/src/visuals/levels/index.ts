import {
  Color3, Constants, Matrix, MeshBuilder, StandardMaterial, TransformNode, type DynamicTexture, type Mesh, type Scene,
} from "@babylonjs/core";
import { mapHalfSize, type LevelLayout, type TileKind } from "@infinite-tower/shared";
import { flatSprite, layerY } from "../overworld/scene.js";
import { pixelCanvas, propTexture, PROP_ART, PX_PER_TILE } from "../overworld3d/props.js";
import { cutoutMaterial } from "../overworld3d/scene.js";
import type { Prop, PropKind, Scenery } from "../overworld3d/scenery.js";
import { spriteMaterial, type SpriteDraw } from "../sprites.js";
import { glowTexture } from "../textures.js";
import { GRASS_FIELD_TILES } from "./grass-field/tiles.js";
import { grassFieldScenery } from "./grass-field/scenery.js";
import { paintGround, tileProps, type TileLooks } from "./tiles.js";

interface LevelLook {
  tiles: TileLooks;
  /** What the flat view draws past the map's edge. */
  outside: TileKind;
  scenery(level: LevelLayout): Scenery;
}

export const LEVEL_LOOKS: Record<LevelLayout["theme"], LevelLook> = {
  "grass-field": { tiles: GRASS_FIELD_TILES, outside: "tree", scenery: grassFieldScenery },
};

export interface LevelDrawing {
  root: TransformNode;
  flicker(dt: number): void;
}

/** More than the camera's overscan, so the view never runs off the ground. */
const FLAT_MARGIN_TILES = 4;
/** Dusk: everything the flat level draws is this colour times its own. */
const FLAT_DUSK = new Color3(0.86, 0.8, 0.82);
const PROP_LAYER = 0.3;

export function buildLevel(scene: Scene, level: LevelLayout): LevelDrawing {
  const look = LEVEL_LOOKS[level.theme], root = new TransformNode(`level-${level.id}`, scene);
  const { halfWidth, halfDepth } = mapHalfSize(level), m = FLAT_MARGIN_TILES;
  const width = (halfWidth + m) * 2, depth = (halfDepth + m) * 2;
  const tex = pixelCanvas(scene, `ground-${level.id}`, width * PX_PER_TILE, depth * PX_PER_TILE,
    (pen) => paintGround(pen, level, look.tiles, look.outside, m), false);
  const ground = MeshBuilder.CreateGround("overworld-ground", { width, height: depth }, scene);
  ground.material = duskMaterial(scene, "overworld-ground", tex, false);
  ground.parent = root;
  placeFlatProps(scene, tileProps(level, look.tiles, look.outside, m), root);
  return { root, flicker: buildCampfires(scene, level, root) };
}

function duskMaterial(scene: Scene, name: string, tex: DynamicTexture, cutout: boolean): StandardMaterial {
  const mat = cutout ? cutoutMaterial(scene, name, tex) : new StandardMaterial(name, scene);
  mat.diffuseTexture = tex;
  mat.disableLighting = true;
  mat.specularColor = Color3.Black();
  mat.emissiveColor = FLAT_DUSK;
  return mat;
}

function placeFlatProps(scene: Scene, props: Prop[], root: TransformNode): void {
  const templates = new Map<PropKind, Mesh>();
  props.forEach((p, i) => {
    let tpl = templates.get(p.kind);
    if (!tpl) {
      const art = PROP_ART[p.kind], w = art.widthPx / PX_PER_TILE, h = art.heightPx / PX_PER_TILE;
      tpl = MeshBuilder.CreatePlane(`flat-${p.kind}`, { width: w, height: h }, scene);
      tpl.bakeTransformIntoVertices(Matrix.Translation(0, h / 2, 0));
      tpl.rotation.x = Math.PI / 2;
      tpl.material = duskMaterial(scene, `flat-${p.kind}`, propTexture(scene, p.kind, 31), true);
      tpl.isVisible = false;
      tpl.parent = root;
      templates.set(p.kind, tpl);
    }
    const inst = tpl.createInstance(`flat-${p.kind}-${i}`);
    inst.parent = root;
    inst.position.set(p.x, layerY(p.z, PROP_LAYER), p.z);
    inst.scaling.setAll(p.scale);
    if (i % 2 === 1) inst.scaling.x = -p.scale;
    inst.freezeWorldMatrix();
  });
}

export const FLICKER_TIME = 0.14;
const CAMPFIRE_TILES = 1.8;
const GLOW_TILES = 7;
const GLOW = new Color3(1, 0.55, 0.25);

/** Any theme's campfires, the flames flickering between two frames. */
function buildCampfires(scene: Scene, level: LevelLayout, root: TransformNode): (dt: number) => void {
  if (level.campfires.length === 0) return () => {};
  const frames = ([0, 1] as const).map((f) => spriteMaterial(scene, `campfire-${f}`, drawCampfire(f)));
  const glow = new StandardMaterial("campfire-glow", scene);
  glow.diffuseTexture = glowTexture(scene);
  glow.useAlphaFromDiffuseTexture = true;
  glow.disableLighting = true;
  glow.emissiveColor = GLOW;
  glow.alphaMode = Constants.ALPHA_ADD;
  const meshes = level.campfires.map((c, i) => {
    const m = flatSprite(scene, `campfire-${i}`, CAMPFIRE_TILES, frames[0]!);
    m.position.set(c.x, layerY(c.z, 0.25), c.z); // under actors standing in front of it, over the ground
    m.parent = root;
    const light = flatSprite(scene, `campfire-glow-${i}`, GLOW_TILES, glow);
    light.position.set(c.x, 1, c.z + 0.3);
    light.parent = root;
    return m;
  });
  let time = 0;
  return (dt) => {
    time += dt;
    const frame = frames[Math.floor(time / FLICKER_TIME) % 2]!;
    for (const m of meshes) m.material = frame;
    glow.alpha = 0.42 + Math.sin(time * 13) * 0.04 + Math.sin(time * 7.3) * 0.05;
  };
}

const LOG = "#5a3a1e", LOG_HI = "#7a5230", STONE = "#7c7f86", STONE_DARK = "#5d6067";

/** A ring of stones, two crossed logs and a fire (24x24 pixels, sprites.ts). */
export function drawCampfire(frame: 0 | 1): SpriteDraw {
  return (px) => {
    for (const [x, y] of [[4, 17], [8, 19], [13, 19], [17, 17], [3, 13], [18, 13]] as const) {
      px(x, y, 3, 2, STONE); px(x, y + 1, 3, 1, STONE_DARK);
    }
    px(6, 15, 12, 2, LOG); px(6, 15, 12, 1, LOG_HI);   // logs
    px(9, 13, 2, 5, LOG); px(13, 13, 2, 5, LOG);
    const lean = frame === 0 ? 0 : 1;
    px(8, 9, 8, 6, "#e0482a");                         // flames, outside in
    px(9 + lean, 6, 6, 5, "#f07b2a");
    px(10, 3 + lean, 4, 5, "#f7b23b");
    px(11 - lean, 1, 2, 3, "#f7b23b");
    px(11, 8, 2, 5, "#ffe08a");
  };
}
