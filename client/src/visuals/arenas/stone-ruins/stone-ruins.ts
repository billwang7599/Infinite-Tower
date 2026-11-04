import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Texture, type Mesh, type Scene } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { colorMaterial } from "../../materials.js";
import type { ArenaLookDef } from "../index.js";
import {
  boulder, floor, hazedRings, lookRoot, patches, ringSpots, scatter, settle, speckled, tuft,
} from "../parts.js";

const WALL_PIECES = 26;
const SKY = new Color3(0.32, 0.3, 0.36);
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

  const far = MeshBuilder.CreateCylinder("ruins-far-cypress", { height: 10, diameterTop: 0, diameterBottom: 2.2,
    tessellation: 6 }, scene);
  hazedRings(ctx, root, own, far, 5, { color: new Color3(0.09, 0.16, 0.13), sky: SKY },
    { rand, count: 51, near: radius + 30, far: radius + 48 });
  const tower = MeshBuilder.CreateBox("ruins-tower", { width: 3, height: 12, depth: 3 }, scene);
  tower.material = stone;
  const top = MeshBuilder.CreateBox("ruins-tower-top", { width: 1.2, height: 2, depth: 3 }, scene);
  top.position.x = 0.9;
  top.material = stone;
  scatter(ctx, root, [[tower, 6], [top, 13]], ringSpots(rand, 3, radius + 22, radius + 30, 0.9, 1.2));

  const rubble = boulder(scene, "ruins-rubble");
  rubble.material = stone;
  scatter(ctx, root, [[rubble, 0.08]], ringSpots(rand, 50, radius + 0.5, radius + 6, 0.25, 0.8), false);
  const blades = tuft(scene, "ruins-tuft", 0.4);
  blades.material = own(colorMaterial(scene, "ruins-tuft", new Color3(0.36, 0.38, 0.22)));
  scatter(ctx, root, [[blades, 0]], ringSpots(rand, 80, radius - 0.5, radius + 7, 0.6, 1.2), false);
  patches(ctx, root, own, "ruins-moss", { base: "#3c4630", specks: ["#46523a", "#323a28", "#525e3e"] },
    ringSpots(rand, 10, 3, radius, 0.4, 0.9));
  patches(ctx, root, own, "ruins-earth", { base: "#4a4334", specks: ["#554d3c", "#3f392c", "#5e5644"] },
    ringSpots(rand, 20, radius + 1.5, radius + 9, 0.8, 2));

  return settle(ctx, root, pieces);
}

export const STONE_RUINS: ArenaLookDef = {
  env: {
    sky: SKY,
    fogDensity: 0.026,
    ambient: new Color3(0.2, 0.19, 0.22),
    skyLight: { color: new Color3(0.6, 0.62, 0.8), ground: new Color3(0.2, 0.18, 0.16), intensity: 0.5 },
    sun: { color: new Color3(1, 0.76, 0.55), intensity: 1.35 },
  },
  build,
};
