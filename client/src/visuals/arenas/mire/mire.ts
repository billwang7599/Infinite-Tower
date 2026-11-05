import { Color3, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { colorMaterial } from "../../materials.js";
import type { MapLight } from "../../sky/sky.js";
import { setWater, waterMaterial, type WaterLook } from "../../water/water.js";
import type { ArenaLookDef } from "../index.js";
import {
  boulder, floor, hazedRings, litRound, lookRoot, patches, ringSpots, scatter, settle, speckled, type FarSprite,
} from "../parts.js";

const STUMPS = 34;
const SKY = new Color3(0.25, 0.27, 0.26);
/** Above 1 so the bloom catches the mushrooms' glow. */
const GLOW = new Color3(0.45, 1.5, 1.15);
const CLUMPS_RAD = [0.5, 2.1, 3.6, 5.2];
const CLUMP_CAPS = 7;
const POOL_DEPTH = 0.5;
const POOLS: WaterLook = {
  body: new Color3(0.05, 0.07, 0.04),
  murkPerTile: 5,
  reflectivity: 0.12,
  glint: new Color3(1.2, 1.15, 1),
  rippleSlope: 0.12,
  waveHeightTiles: 0,
  foam: new Color3(0.32, 0.36, 0.2),
  foamTiles: 0.12,
};

const FAR_SNAG: FarSprite = {
  widthPx: 40, heightPx: 80, heightM: 11,
  draw(pen) {
    const branch = (fromX: number, fromY: number, dx: number, length: number, thick: number) => {
      for (let i = 0; i < length; i++) litRound(pen, fromX + dx * i, fromY - i, thick * (1 - i / length) / 2 + 0.5);
    };
    branch(22, 34, 1, 15, 3);
    branch(19, 44, -1, 13, 3);
    branch(24, 22, 1, 6, 2);
    for (let y = 0; y < 80; y++) litRound(pen, 20.5 + (80 - y) / 40, y, 0.5 + 2.5 * y / 80);
  },
};

function lights(radius: number): MapLight[] {
  return CLUMPS_RAD.map((a) => ({
    at: { x: Math.sin(a) * (radius + 0.8), y: 1, z: Math.cos(a) * (radius + 0.8) },
    color: new Color3(0.35, 1, 0.8), intensity: 4, rangeM: 9, flicker: 0.12,
  }));
}

function build(ctx: ArenaScene, radius: number) {
  const { scene } = ctx;
  const { root, own } = lookRoot(scene, "mire");
  const rand = seededRandom(31);

  const mud = own(speckled(scene, "mire-mud", {
    base: "#363b2a", specks: ["#41472f", "#2c3021", "#4a5136", "#262a1d"], count: 900, maxRadiusPx: 6, seed: 6,
  }, 16));
  const peat = own(speckled(scene, "mire-peat", {
    base: "#4a4232", specks: ["#554c3a", "#3d3629", "#56603f", "#352f24"], count: 900, maxRadiusPx: 5, seed: 7,
  }, 6));
  floor(ctx, root, mud, peat, radius);

  const wood = own(colorMaterial(scene, "mire-wood", new Color3(0.2, 0.17, 0.14)));
  const stumps: Mesh[] = [];
  for (let i = 0; i < STUMPS; i++) {
    const a = ((i + rand() * 0.5) / STUMPS) * Math.PI * 2, h = 0.5 + rand() * 1.6;
    const s = MeshBuilder.CreateCylinder(`mire-stump-${i}`, {
      height: h, diameterTop: 0.3 + rand() * 0.3, diameterBottom: 0.7 + rand() * 0.5, tessellation: 7,
    }, scene);
    const r = radius + 0.8 + rand() * 0.6;
    s.position.set(Math.sin(a) * r, h / 2 - 0.05, Math.cos(a) * r);
    s.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
    s.material = wood;
    s.parent = root;
    stumps.push(s);
  }

  const water = own(waterMaterial(scene, "mire-water", POOLS));
  water.zOffset = -2;
  const pool = MeshBuilder.CreateDisc("mire-pool", { radius: 1, tessellation: 20 }, scene);
  pool.rotation.x = Math.PI / 2;
  pool.bakeCurrentTransformIntoVertices();
  setWater(pool, (x, z) => {
    const shore = 1 - Math.hypot(x, z);
    return { flowX: 0, flowZ: 0, shore, column: POOL_DEPTH * shore };
  });
  pool.material = water;
  pool.receiveShadows = true;
  const pools = ringSpots(rand, 16, radius + 3, radius + 16, 1.5, 4);
  scatter(ctx, root, [[pool, 0.02]], pools, false);
  const pad = MeshBuilder.CreateDisc("mire-pad", { radius: 0.22, tessellation: 7, arc: 0.85 }, scene);
  pad.rotation.x = Math.PI / 2;
  pad.bakeCurrentTransformIntoVertices();
  pad.material = own(colorMaterial(scene, "mire-pad", new Color3(0.26, 0.36, 0.18)));
  scatter(ctx, root, [[pad, 0.05]], pools.flatMap(({ x, z, scale }) => [0, 1, 2].map(() => {
    const a = rand() * Math.PI * 2, r = rand() * scale * 0.6;
    return { x: x + Math.sin(a) * r, z: z + Math.cos(a) * r, scale: 0.7 + rand() * 0.8, yaw: rand() * Math.PI * 2 };
  })), false);

  const branch = (h: number, d: number, tilt: number, yaw: number, y: number) => {
    const shape = { height: h, diameterTop: 0.05, diameterBottom: d, tessellation: 5 };
    const b = MeshBuilder.CreateCylinder("mire-branch", shape, scene);
    b.rotation.set(tilt, yaw, 0);
    b.position.y = y;
    return b;
  };
  const deadTree = Mesh.MergeMeshes([
    branch(6, 0.55, 0.05, 0, 0),
    branch(2.4, 0.22, 0.9, 0.4, 1.2),
    branch(2, 0.18, -0.8, 2.2, 0.8),
    branch(1.6, 0.14, 1, 4.1, 1.8),
  ], true)!;
  deadTree.name = "mire-dead-tree";
  deadTree.material = wood;
  scatter(ctx, root, [[deadTree, 3]], ringSpots(rand, 60, radius + 4, radius + 30, 0.7, 1.4));

  const reed = Mesh.MergeMeshes([-0.15, 0, 0.12].map((x, i) => {
    const r = MeshBuilder.CreateCylinder("mire-reed", { height: 1.4 + i * 0.3, diameter: 0.05, tessellation: 3 },
      scene);
    r.position.set(x, 0, i * 0.08);
    return r;
  }), true)!;
  reed.name = "mire-reeds";
  reed.material = own(colorMaterial(scene, "mire-reed", new Color3(0.32, 0.33, 0.2)));
  scatter(ctx, root, [[reed, 0.7]], ringSpots(rand, 50, radius + 1.6, radius + 12, 0.7, 1.3), false);

  const cap = MeshBuilder.CreateSphere("mire-cap", { diameter: 0.5, segments: 4 }, scene);
  cap.scaling.y = 0.45;
  cap.bakeCurrentTransformIntoVertices();
  const glow = own(new StandardMaterial("mire-glow", scene));
  glow.disableLighting = true;
  glow.emissiveColor = GLOW;
  cap.material = glow;
  const clumps = lights(radius).flatMap(({ at }) => Array.from({ length: CLUMP_CAPS }, () => {
    const a = rand() * Math.PI * 2, r = rand() * 0.7;
    return { x: at.x + Math.sin(a) * r, z: at.z + Math.cos(a) * r, scale: 0.9 + rand() * 0.8, yaw: rand() * Math.PI };
  }));
  scatter(ctx, root, [[cap, 0.1]], [...ringSpots(rand, 60, radius + 0.4, radius + 3, 0.6, 1.5), ...clumps], false);

  hazedRings(ctx, root, own, "mire-far-snag", FAR_SNAG, { color: new Color3(0.14, 0.14, 0.12), sky: SKY },
    { rand, count: 42, near: radius + 30, far: radius + 48 });
  const log = MeshBuilder.CreateCylinder("mire-log", { height: 3.2, diameterTop: 0.35, diameterBottom: 0.5,
    tessellation: 7 }, scene);
  log.rotation.z = Math.PI / 2;
  log.bakeCurrentTransformIntoVertices();
  log.material = wood;
  scatter(ctx, root, [[log, 0.2]], ringSpots(rand, 7, radius + 2.5, radius + 9, 0.8, 1.2));
  const stone = boulder(scene, "mire-stone");
  stone.material = own(colorMaterial(scene, "mire-stone", new Color3(0.3, 0.33, 0.27)));
  scatter(ctx, root, [[stone, 0.1]], ringSpots(rand, 12, radius + 1.5, radius + 6, 0.5, 1.3), false);
  const cattail = MeshBuilder.CreateCylinder("mire-cattail", { height: 0.22, diameter: 0.08, tessellation: 5 }, scene);
  cattail.material = own(colorMaterial(scene, "mire-cattail", new Color3(0.36, 0.24, 0.14)));
  scatter(ctx, root, [[cattail, 1.55]], ringSpots(rand, 30, radius + 1.6, radius + 12, 0.8, 1.1), false);
  patches(ctx, root, own, "mire-moss", { base: "#444a30", specks: ["#4e5538", "#3a3f29", "#565e3e"] },
    ringSpots(rand, 14, 2, radius - 1, 0.4, 1.1));
  patches(ctx, root, own, "mire-algae", { base: "#3e4a28", specks: ["#4a5830", "#323c20", "#56663a"] },
    ringSpots(rand, 20, radius + 1.2, radius + 10, 0.8, 2.2));

  return settle(ctx, root, stumps);
}

export const MIRE: ArenaLookDef = {
  env: {
    sky: SKY,
    fogDensity: 0.036,
    ambient: new Color3(0.17, 0.19, 0.18),
    skyLight: { color: new Color3(0.55, 0.65, 0.65), ground: new Color3(0.16, 0.15, 0.1), intensity: 0.45 },
    sun: { color: new Color3(0.98, 0.68, 0.46), intensity: 1.15 },
  },
  lights,
  build,
};
