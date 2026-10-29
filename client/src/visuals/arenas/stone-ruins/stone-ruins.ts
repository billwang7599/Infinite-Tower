import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Texture, type Mesh, type Scene } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { colorMaterial } from "../../materials.js";
import type { ArenaLookDef } from "../index.js";
import { floor, lookRoot, ringSpots, scatter, settle, speckled } from "../parts.js";

const WALL_PIECES = 26;
/** Angles (radians) of the two arches standing in the wall. */
const ARCHES_RAD = [0.9, 3.6];
const FLAGSTONE_TILES = 8;

function flagstones(scene: Scene): StandardMaterial {
  const size = 256, rows = 4, rand = seededRandom(11);
  const tex = new DynamicTexture("ruins-flagstones", { width: size, height: size }, scene, true);
  const g = tex.getContext() as CanvasRenderingContext2D;
  g.fillStyle = "#2c2a27";
  g.fillRect(0, 0, size, size);
  const cell = size / rows, shades = ["#6d675e", "#625d55", "#757067", "#5a564f", "#68645a"];
  for (let y = 0; y < rows; y++) {
    const shift = (y % 2) * cell / 2;
    for (let x = -1; x < rows; x++) {
      g.fillStyle = shades[Math.floor(rand() * shades.length)]!;
      g.fillRect(x * cell + shift + 3, y * cell + 3, cell - 6, cell - 6);
      g.fillStyle = "rgba(60, 74, 46, 0.5)";
      if (rand() < 0.4) g.fillRect(x * cell + shift + 3, y * cell + cell - 14, cell * rand(), 11);
    }
  }
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = tex.vScale = FLAGSTONE_TILES;
  const m = new StandardMaterial("ruins-flagstones", scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  return m;
}

function build(ctx: ArenaScene, radius: number) {
  const { scene } = ctx;
  const { root, own } = lookRoot(scene, "stone-ruins");
  const rand = seededRandom(23);

  const grass = own(speckled(scene, "ruins-grass", {
    base: "#3b4232", specks: ["#454d39", "#323827", "#4f5640", "#2a3022"], count: 900, maxRadiusPx: 5, seed: 4,
  }, 18));
  floor(ctx, root, grass, own(flagstones(scene)), radius);

  const stone = own(speckled(scene, "ruins-stone", {
    base: "#7a746a", specks: ["#8a8478", "#68635a", "#56604a", "#938d80"], count: 500, maxRadiusPx: 6, seed: 5,
  }, 1));
  const pieces: Mesh[] = [];
  const place = (m: Mesh, a: number, r: number, y: number) => {
    m.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    m.rotation.y = a;
    m.material = stone;
    m.parent = root;
    pieces.push(m);
  };
  const column = (name: string, h: number, a: number, r: number) => {
    place(MeshBuilder.CreateCylinder(name, { height: h, diameter: 0.85, tessellation: 10 }, scene), a, r, h / 2);
    if (h > 2.8) place(MeshBuilder.CreateBox(`${name}-cap`, { width: 1.15, height: 0.3, depth: 1.15 }, scene), a, r, h);
  };

  for (let i = 0; i < WALL_PIECES; i++) {
    const a = ((i + rand() * 0.3) / WALL_PIECES) * Math.PI * 2;
    if (ARCHES_RAD.some((arch) => Math.abs(arch - a) < 0.35)) continue;
    const r = radius + 0.8 + rand() * 0.3;
    if (rand() < 0.5) column(`ruins-column-${i}`, 1 + rand() * 3.4, a, r);
    else {
      const h = 0.6 + rand() * 1.1;
      const shape = { width: 1.8 + rand() * 1.2, height: h, depth: 0.8 };
      place(MeshBuilder.CreateBox(`ruins-wall-${i}`, shape, scene), a, r, h / 2);
    }
  }
  for (const [i, a] of ARCHES_RAD.entries()) {
    const r = radius + 0.9, half = 1.6 / r, h = 4;
    column(`ruins-arch-${i}-l`, h, a - half, r);
    column(`ruins-arch-${i}-r`, h, a + half, r);
    place(MeshBuilder.CreateBox(`ruins-arch-${i}`, { width: 4.2, height: 0.6, depth: 1 }, scene), a, r, h + 0.45);
  }

  const drum = MeshBuilder.CreateCylinder("ruins-drum", { height: 1.4, diameter: 0.85, tessellation: 10 }, scene);
  drum.rotation.z = Math.PI / 2;
  drum.bakeCurrentTransformIntoVertices();
  drum.material = stone;
  scatter(ctx, root, [[drum, 0.42]], ringSpots(rand, 14, radius + 1.8, radius + 9, 0.8, 1.2));

  const block = MeshBuilder.CreateBox("ruins-far-wall", { width: 4, height: 5, depth: 1.2 }, scene);
  block.material = stone;
  scatter(ctx, root, [[block, 2.3]], ringSpots(rand, 22, radius + 9, radius + 26, 0.6, 1.5));

  const cypressShape = { height: 6, diameterTop: 0, diameterBottom: 1.6, tessellation: 7 };
  const cypress = MeshBuilder.CreateCylinder("ruins-cypress", cypressShape, scene);
  cypress.material = own(colorMaterial(scene, "ruins-cypress", new Color3(0.1, 0.2, 0.15)));
  scatter(ctx, root, [[cypress, 3]], ringSpots(rand, 30, radius + 5, radius + 30, 0.8, 1.6));

  return settle(ctx, root, pieces);
}

export const STONE_RUINS: ArenaLookDef = {
  env: {
    sky: new Color3(0.32, 0.3, 0.36),
    fogDensity: 0.026,
    ambient: new Color3(0.2, 0.19, 0.22),
    skyLight: { color: new Color3(0.6, 0.62, 0.8), ground: new Color3(0.2, 0.18, 0.16), intensity: 0.5 },
    sun: { color: new Color3(1, 0.76, 0.55), intensity: 1.35 },
  },
  build,
};
