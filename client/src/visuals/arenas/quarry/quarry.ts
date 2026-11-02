import {
  Color3, Color4, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, Texture, Vector3,
  type Scene, type TransformNode,
} from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { colorMaterial } from "../../materials.js";
import type { MapLight } from "../../sky/sky.js";
import { puffTexture } from "../../textures.js";
import type { ArenaLookDef } from "../index.js";
import { floor, lookRoot, ringSpots, scatter, settle, speckled } from "../parts.js";

const SLAB_TILES = 6;
const EDGE_STACKS = 30;
const TERRACE = { fromM: 4, stepM: 2.6, riseM: 1.9, steps: 6 };
const CRANE_RAD = 0.6;
const CART_RAD = 3.4;
const DUST = { perSec: 7, lifeS: [6, 11], sizeM: [0.5, 1.6], driftMps: 0.35 } as const;

function slabs(scene: Scene): StandardMaterial {
  const size = 256, rows = 3, rand = seededRandom(17);
  const tex = new DynamicTexture("quarry-slabs", { width: size, height: size }, scene, true);
  const g = tex.getContext() as CanvasRenderingContext2D;
  g.fillStyle = "#6f675a";
  g.fillRect(0, 0, size, size);
  const shades = ["#a39985", "#9a907c", "#aca28d", "#958b77", "#a69c86"], cell = size / rows;
  for (let y = 0; y < rows; y++) {
    let x = -rand() * cell;
    while (x < size) {
      const w = cell * (0.8 + rand() * 0.9);
      g.fillStyle = shades[Math.floor(rand() * shades.length)]!;
      g.fillRect(x + 2, y * cell + 2, w - 4, cell - 4);
      g.fillStyle = "rgba(90, 82, 68, 0.35)";
      if (rand() < 0.5) for (let k = 6; k < w - 6; k += 7) g.fillRect(x + k, y * cell + 5, 1, cell * 0.3);
      g.fillStyle = "rgba(205, 196, 176, 0.5)";
      for (let k = 0; k < 6; k++) g.fillRect(x + rand() * w, y * cell + rand() * cell, 2, 1);
      x += w;
    }
  }
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = tex.vScale = SLAB_TILES;
  const m = new StandardMaterial("quarry-slabs", scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  return m;
}

function terraces(scene: Scene, radius: number, material: StandardMaterial): Mesh {
  const { fromM, stepM, riseM, steps } = TERRACE;
  const shape: Vector3[] = [];
  for (let i = 0; i < steps; i++) {
    const r = radius + fromM + i * stepM;
    shape.push(new Vector3(r, i * riseM, 0), new Vector3(r, (i + 1) * riseM, 0));
  }
  const lathe = MeshBuilder.CreateLathe("quarry-terraces", {
    shape, tessellation: 56, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  lathe.material = material;
  return lathe;
}

function dust(scene: Scene, root: TransformNode, radius: number): void {
  const system = new ParticleSystem("quarry-dust", 90, scene);
  system.particleTexture = puffTexture(scene);
  system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  system.emitter = Vector3.Zero();
  system.createBoxEmitter(
    new Vector3(-DUST.driftMps, 0.02, -DUST.driftMps), new Vector3(DUST.driftMps, 0.12, DUST.driftMps),
    new Vector3(-radius, 0.1, -radius), new Vector3(radius, 2.5, radius),
  );
  system.color1 = new Color4(0.78, 0.72, 0.62, 0.14);
  system.color2 = new Color4(0.7, 0.65, 0.56, 0.08);
  system.colorDead = new Color4(0.7, 0.65, 0.56, 0);
  [system.minSize, system.maxSize] = DUST.sizeM;
  [system.minLifeTime, system.maxLifeTime] = DUST.lifeS;
  system.emitRate = DUST.perSec;
  system.updateSpeed = 1 / 60;
  system.preWarmCycles = 600;
  system.start();
  root.onDisposeObservable.addOnce(() => system.dispose());
}

function build(ctx: ArenaScene, radius: number) {
  const { scene } = ctx;
  const { root, own } = lookRoot(scene, "quarry");
  const rand = seededRandom(41);

  const grit = own(speckled(scene, "quarry-grit", {
    base: "#857c69", specks: ["#958c78", "#776e5c", "#a39a85", "#6b6352"], count: 1100, maxRadiusPx: 4, seed: 8,
  }, 16));
  floor(ctx, root, grit, own(slabs(scene)), radius);

  const stone = own(speckled(scene, "quarry-stone", {
    base: "#a49a85", specks: ["#b4aa94", "#8f8571", "#bdb39d", "#837a67"], count: 600, maxRadiusPx: 5, seed: 9,
  }, 1));
  const face = own(speckled(scene, "quarry-face", {
    base: "#968c77", specks: ["#a69c86", "#857b67", "#b0a690", "#7a705d"], count: 700, maxRadiusPx: 7, seed: 10,
  }, 1));
  (face.diffuseTexture as Texture).uScale = 48;
  (face.diffuseTexture as Texture).vScale = 5;
  const wood = own(colorMaterial(scene, "quarry-wood", new Color3(0.36, 0.26, 0.17)));
  const iron = own(colorMaterial(scene, "quarry-iron", new Color3(0.27, 0.28, 0.3)));

  const casters: Mesh[] = [];
  const part = (m: Mesh, material: StandardMaterial, x: number, y: number, z: number, yaw = 0, cast = true) => {
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    m.material = material;
    m.parent = root;
    if (cast) casters.push(m);
    return m;
  };
  const at = (a: number, r: number) => ({ x: Math.sin(a) * r, z: Math.cos(a) * r });

  for (let i = 0; i < EDGE_STACKS; i++) {
    const a = ((i + rand() * 0.4) / EDGE_STACKS) * Math.PI * 2;
    if (Math.abs(a - CRANE_RAD) < 0.3 || Math.abs(a - CART_RAD) < 0.35) continue;
    const { x, z } = at(a, radius + 0.9 + rand() * 0.5);
    let y = 0;
    for (let k = 0, high = 1 + Math.floor(rand() * 3); k < high; k++) {
      const h = 0.5 + rand() * 0.35, shape = { width: 1.3 + rand() * 0.9, height: h, depth: 0.9 + rand() * 0.3 };
      part(MeshBuilder.CreateBox(`quarry-block-${i}-${k}`, shape, scene), stone, x, y + h / 2, z, a + (rand() - 0.5) * 0.3);
      y += h;
    }
  }
  part(terraces(scene, radius, face), face, 0, 0, 0, 0, false).receiveShadows = true;

  const crane = at(CRANE_RAD, radius + 3), mastH = 7.5, inward = CRANE_RAD + Math.PI;
  part(MeshBuilder.CreateBox("quarry-crane-mast", { width: 0.4, height: mastH, depth: 0.4 }, scene), wood,
    crane.x, mastH / 2, crane.z);
  const jibLen = 3.4, jibTilt = 0.25, jibIn = 1, jibY = mastH - 0.6;
  const jib = part(MeshBuilder.CreateBox("quarry-crane-jib", { width: 0.25, height: 0.3, depth: jibLen }, scene),
    wood, crane.x + Math.sin(inward) * jibIn, jibY, crane.z + Math.cos(inward) * jibIn, inward);
  jib.rotation.x = -jibTilt;
  const tip = at(CRANE_RAD, radius + 3 - jibIn - (jibLen / 2) * Math.cos(jibTilt));
  const ropeTop = jibY + (jibLen / 2) * Math.sin(jibTilt), ropeBottom = 3.6;
  part(MeshBuilder.CreateCylinder("quarry-crane-rope", { height: ropeTop - ropeBottom, diameter: 0.05 }, scene),
    iron, tip.x, (ropeTop + ropeBottom) / 2, tip.z, 0, false);
  part(MeshBuilder.CreateBox("quarry-crane-load", { width: 1, height: 0.7, depth: 0.8 }, scene), stone,
    tip.x, ropeBottom - 0.35, tip.z, CRANE_RAD + 0.4);
  const brace = part(MeshBuilder.CreateBox("quarry-crane-brace", { width: 0.22, height: 3.2, depth: 0.22 }, scene),
    wood, crane.x - Math.sin(inward) * 0.8, 1.4, crane.z - Math.cos(inward) * 0.8, inward);
  brace.rotation.x = 0.5;

  const cart = at(CART_RAD, radius + 2.6), along = CART_RAD + Math.PI / 2;
  for (const side of [-0.45, 0.45]) {
    const off = at(CART_RAD, side);
    part(MeshBuilder.CreateBox("quarry-rail", { width: 0.08, height: 0.08, depth: 9 }, scene), iron,
      cart.x + off.x, 0.04, cart.z + off.z, along, false);
  }
  part(MeshBuilder.CreateBox("quarry-cart", { width: 1.3, height: 0.8, depth: 1.8 }, scene), wood,
    cart.x, 0.75, cart.z, along);
  part(MeshBuilder.CreateBox("quarry-cart-load", { width: 1.1, height: 0.3, depth: 1.6 }, scene), stone,
    cart.x, 1.2, cart.z, along, false);

  const sleeper = MeshBuilder.CreateBox("quarry-sleeper", { width: 1.3, height: 0.08, depth: 0.22 }, scene);
  sleeper.material = wood;
  scatter(ctx, root, [[sleeper, 0.03]], Array.from({ length: 9 }, (_, i) => {
    const p = { x: cart.x + Math.sin(along) * (i - 4), z: cart.z + Math.cos(along) * (i - 4) };
    return { ...p, scale: 1, yaw: along };
  }), false);

  const rubble = MeshBuilder.CreatePolyhedron("quarry-rubble", { type: 2, size: 0.3 }, scene);
  rubble.material = stone;
  scatter(ctx, root, [[rubble, 0.15]], ringSpots(rand, 70, radius + 0.6, radius + 4, 0.4, 1.6), false);
  const block = MeshBuilder.CreateBox("quarry-far-block", { width: 1.6, height: 1, depth: 1.1 }, scene);
  block.material = stone;
  scatter(ctx, root, [[block, 0.5]], ringSpots(rand, 18, radius + 2, radius + 3.6, 0.7, 1.3));
  const scrubShape = { height: 0.7, diameterTop: 0, diameterBottom: 0.9, tessellation: 6 };
  const scrub = MeshBuilder.CreateCylinder("quarry-scrub", scrubShape, scene);
  scrub.material = own(colorMaterial(scene, "quarry-scrub", new Color3(0.36, 0.34, 0.2)));
  scatter(ctx, root, [[scrub, 0.3]], ringSpots(rand, 40, radius + 1.2, radius + 3.8, 0.6, 1.3), false);

  const post = MeshBuilder.CreateBox("quarry-lantern-post", { width: 0.15, height: 2, depth: 0.15 }, scene);
  post.material = wood;
  const glow = own(new StandardMaterial("quarry-lantern", scene));
  glow.disableLighting = true;
  glow.emissiveColor = new Color3(1.4, 0.9, 0.45);
  const flame = MeshBuilder.CreateBox("quarry-lantern-glow", { size: 0.22 }, scene);
  flame.material = glow;
  const posts = lights(radius).map((l) => ({ x: l.at.x, z: l.at.z, scale: 1, yaw: 0 }));
  scatter(ctx, root, [[post, 1], [flame, 2.1]], posts);

  dust(scene, root, radius);
  return settle(ctx, root, casters);
}

function lights(radius: number): MapLight[] {
  return [CRANE_RAD - 0.35, CART_RAD + 0.4].map((a) => ({
    at: { x: Math.sin(a) * (radius + 1.2), y: 2.1, z: Math.cos(a) * (radius + 1.2) },
    color: new Color3(1, 0.66, 0.34), intensity: 3, rangeM: 10, flicker: 0.1,
  }));
}

export const QUARRY: ArenaLookDef = {
  env: {
    sky: new Color3(0.37, 0.34, 0.3),
    fogDensity: 0.03,
    ambient: new Color3(0.27, 0.25, 0.23),
    skyLight: { color: new Color3(0.66, 0.63, 0.62), ground: new Color3(0.42, 0.37, 0.3), intensity: 0.5 },
    sun: { color: new Color3(1, 0.79, 0.58), intensity: 1.3 },
  },
  lights,
  build,
};
