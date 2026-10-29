import { Color3, MeshBuilder, type Mesh } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { colorMaterial } from "../../materials.js";
import type { ArenaLookDef } from "../index.js";
import { floor, lookRoot, ringSpots, scatter, settle, speckled } from "../parts.js";

const STONES = 30;

function build(ctx: ArenaScene, radius: number) {
  const { scene } = ctx;
  const { root, own } = lookRoot(scene, "forest-clearing");
  const rand = seededRandom(7);

  const moss = own(speckled(scene, "forest-moss", {
    base: "#34492c", specks: ["#3e5733", "#2b3d25", "#4a6138", "#24331f"], count: 900, maxRadiusPx: 5, seed: 1,
  }, 18));
  const dirt = own(speckled(scene, "forest-dirt", {
    base: "#5e4b38", specks: ["#6b5741", "#4f3e2e", "#76624a", "#433426"], count: 900, maxRadiusPx: 4, seed: 2,
  }, 6));
  floor(ctx, root, moss, dirt, radius);

  const stone = own(speckled(scene, "forest-stone", {
    base: "#6a6966", specks: ["#7a7975", "#585754", "#4f5a48", "#83827d"], count: 500, maxRadiusPx: 6, seed: 3,
  }, 1));
  const stones: Mesh[] = [];
  for (let i = 0; i < STONES; i++) {
    const a = ((i + rand() * 0.4) / STONES) * Math.PI * 2;
    const h = 0.8 + rand() * 1.6, w = 0.9 + rand() * 0.8;
    const s = MeshBuilder.CreateBox(`forest-stone-${i}`, { width: w, height: h, depth: 0.7 + rand() * 0.5 }, scene);
    const r = radius + 0.7 + rand() * 0.4;
    s.position.set(Math.sin(a) * r, h / 2 - 0.1, Math.cos(a) * r);
    s.rotation.set((rand() - 0.5) * 0.15, a + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.15);
    s.material = stone;
    s.parent = root;
    stones.push(s);
  }

  const cone = (name: string, height: number, top: number, bottom: number, tessellation = 7) =>
    MeshBuilder.CreateCylinder(name, { height, diameterTop: top, diameterBottom: bottom, tessellation }, scene);
  const bark = own(colorMaterial(scene, "forest-bark", new Color3(0.24, 0.17, 0.12)));
  const needles = own(colorMaterial(scene, "forest-needles", new Color3(0.12, 0.25, 0.17)));
  const trunk = cone("forest-trunk", 3, 0.35, 0.55);
  trunk.material = bark;
  const crownLow = cone("forest-crown-low", 3.2, 0, 3.4);
  crownLow.material = needles;
  const crownHigh = cone("forest-crown-high", 2.6, 0, 2.4);
  crownHigh.material = needles;
  const trees = ringSpots(rand, 80, radius + 4, radius + 30, 0.8, 1.7);
  scatter(ctx, root, [[trunk, 1.5], [crownLow, 3.8], [crownHigh, 5.6]], trees);

  const fern = MeshBuilder.CreateSphere("forest-fern", { diameter: 1, segments: 4 }, scene);
  fern.scaling.y = 0.5;
  fern.bakeCurrentTransformIntoVertices();
  fern.material = own(colorMaterial(scene, "forest-fern", new Color3(0.18, 0.3, 0.14)));
  scatter(ctx, root, [[fern, 0.15]], ringSpots(rand, 40, radius + 1.6, radius + 5, 0.6, 1.4));

  const log = MeshBuilder.CreateCylinder("forest-log", { height: 3, diameter: 0.5, tessellation: 8 }, scene);
  log.rotation.z = Math.PI / 2;
  log.bakeCurrentTransformIntoVertices();
  log.material = bark;
  scatter(ctx, root, [[log, 0.25]], ringSpots(rand, 6, radius + 2, radius + 8, 0.8, 1.3));

  return settle(ctx, root, stones);
}

export const FOREST_CLEARING: ArenaLookDef = {
  env: {
    sky: new Color3(0.33, 0.29, 0.31),
    fogDensity: 0.028,
    ambient: new Color3(0.2, 0.18, 0.2),
    skyLight: { color: new Color3(0.62, 0.6, 0.78), ground: new Color3(0.2, 0.16, 0.12), intensity: 0.5 },
    sun: { color: new Color3(1, 0.72, 0.48), intensity: 1.45 },
  },
  build,
};
