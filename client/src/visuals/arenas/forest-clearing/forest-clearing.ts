import { Color3, MeshBuilder, type Mesh } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { colorMaterial } from "../../materials.js";
import type { ArenaLookDef } from "../index.js";
import { boulder, floor, lookRoot, patches, ringSpots, scatter, settle, speckled, tuft } from "../parts.js";

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
  const farNeedles = own(colorMaterial(scene, "forest-far-needles", new Color3(0.1, 0.19, 0.15)));
  const farCrown = cone("forest-far-crown", 9, 0, 3.6);
  farCrown.material = farNeedles;
  scatter(ctx, root, [[farCrown, 5.5]], ringSpots(rand, 70, radius + 32, radius + 48, 1, 1.6), false);

  // Broadleaves between the pines, a lighter green so the treeline reads in layers.
  const leaves = own(colorMaterial(scene, "forest-leaves", new Color3(0.2, 0.31, 0.16)));
  const oakTrunk = cone("forest-oak-trunk", 2.4, 0.3, 0.5);
  oakTrunk.material = bark;
  const oakCrown = MeshBuilder.CreateSphere("forest-oak-crown", { diameter: 3, segments: 5 }, scene);
  oakCrown.scaling.y = 0.75;
  oakCrown.bakeCurrentTransformIntoVertices();
  oakCrown.material = leaves;
  scatter(ctx, root, [[oakTrunk, 1.2], [oakCrown, 3]], ringSpots(rand, 18, radius + 5, radius + 22, 0.8, 1.3));

  const rock = boulder(scene, "forest-boulder");
  rock.material = own(colorMaterial(scene, "forest-boulder", new Color3(0.4, 0.42, 0.37)));
  scatter(ctx, root, [[rock, 0.12]], ringSpots(rand, 14, radius + 2, radius + 7, 0.6, 1.6), false);
  const grass = tuft(scene, "forest-tuft", 0.45);
  grass.material = own(colorMaterial(scene, "forest-tuft", new Color3(0.3, 0.38, 0.18)));
  scatter(ctx, root, [[grass, 0]], ringSpots(rand, 70, radius + 0.6, radius + 6, 0.7, 1.3), false);
  patches(ctx, root, own, "forest-leaf-litter",
    { base: "#58432f", specks: ["#6a4f35", "#4a3826", "#73563a", "#3e3020"] },
    ringSpots(rand, 16, 2, radius - 1, 0.5, 1.4));
  patches(ctx, root, own, "forest-moss-patch",
    { base: "#2e4227", specks: ["#384f2e", "#26371f", "#41593a", "#1f2d1a"] },
    ringSpots(rand, 24, radius + 1.2, radius + 10, 0.8, 2.2));
  const capMat = own(colorMaterial(scene, "forest-cap", new Color3(0.72, 0.45, 0.32)));
  const cap = MeshBuilder.CreateSphere("forest-cap", { diameter: 0.18, segments: 4, slice: 0.5 }, scene);
  cap.material = capMat;
  const stem = cone("forest-stem", 0.12, 0.05, 0.06, 5);
  stem.material = own(colorMaterial(scene, "forest-stem", new Color3(0.82, 0.78, 0.66)));
  scatter(ctx, root, [[stem, 0.06], [cap, 0.11]], ringSpots(rand, 26, radius + 1.2, radius + 4, 0.8, 1.5), false);

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
