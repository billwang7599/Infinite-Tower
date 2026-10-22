/**
 * Procedural textures and shared materials, so the prototype needs no asset files.
 * Swap these for real art later; nothing else depends on how they're made.
 */
import { Color3, DynamicTexture, StandardMaterial, Texture, type Scene } from "@babylonjs/core";
import { drawPlayerDown, drawPlayerIdle, drawPlayerSlash, spriteMaterial, spriteTexture } from "./sprites.js";

export interface Materials {
  grass: StandardMaterial;
  dirt: StandardMaterial;
  stone: StandardMaterial;
  bark: StandardMaterial;
  leaves: StandardMaterial;
  shadow: StandardMaterial;
  player: { idle: StandardMaterial; slash: StandardMaterial; down: StandardMaterial };
  slashFx: StandardMaterial;
  telegraph: StandardMaterial;
}

/** Deterministic pseudo-random, so textures look the same every run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Base color plus random blotches: grass, dirt, stone. */
function speckleTexture(scene: Scene, name: string, base: string, specks: string[], count: number, maxR: number, seed: number): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = specks[Math.floor(r() * specks.length)]!;
    ctx.globalAlpha = 0.25 + r() * 0.5;
    const x = r() * size, y = r() * size, rad = 1 + r() * maxR;
    // Draw wrapped copies so the texture tiles seamlessly.
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function blobTexture(scene: Scene): DynamicTexture {
  const s = 64;
  const tex = new DynamicTexture("blob", { width: s, height: s }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/** Red stripe that fades out along its length (v = 0 near the boar). */
function telegraphTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("telegraph", { width: 32, height: 256 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, "rgba(255,60,30,0.9)");
  g.addColorStop(1, "rgba(255,60,30,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 256);
  ctx.globalCompositeOperation = "destination-in";
  const edge = ctx.createLinearGradient(0, 0, 32, 0);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(0.3, "rgba(0,0,0,1)");
  edge.addColorStop(0.7, "rgba(0,0,0,1)");
  edge.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 32, 256);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

function tiled(scene: Scene, name: string, tex: DynamicTexture, scale: number): StandardMaterial {
  tex.uScale = tex.vScale = scale;
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  return m;
}

export function createMaterials(scene: Scene): Materials {
  const grass = tiled(scene, "grass",
    speckleTexture(scene, "grass", "#3f6b35", ["#4d7f3e", "#355a2c", "#5b8a45", "#2d4d27"], 900, 5, 1), 18);
  const dirt = tiled(scene, "dirt",
    speckleTexture(scene, "dirt", "#7a6347", ["#8a7253", "#6a553c", "#93806a", "#5a4733"], 900, 4, 2), 6);
  dirt.zOffset = -1;
  const stone = tiled(scene, "stone",
    speckleTexture(scene, "stone", "#7c7f86", ["#8d9097", "#6a6d74", "#5d6067", "#9a9ca2"], 500, 6, 3), 1);
  const bark = new StandardMaterial("bark", scene);
  bark.diffuseColor = new Color3(0.32, 0.22, 0.14);
  bark.specularColor = Color3.Black();
  const leaves = new StandardMaterial("leaves", scene);
  leaves.diffuseColor = new Color3(0.16, 0.36, 0.2);
  leaves.specularColor = Color3.Black();

  const shadow = new StandardMaterial("shadow", scene);
  shadow.diffuseTexture = blobTexture(scene);
  shadow.useAlphaFromDiffuseTexture = true;
  shadow.disableLighting = true;
  shadow.emissiveColor = Color3.Black();
  shadow.zOffset = -2; // avoid z-fighting with the ground

  const slashFx = new StandardMaterial("slash-fx", scene);
  slashFx.disableLighting = true;
  slashFx.emissiveColor = new Color3(1.4, 1.6, 1.9); // > 1 so bloom catches it
  slashFx.alpha = 0.9;
  slashFx.backFaceCulling = false;

  const telegraph = new StandardMaterial("telegraph", scene);
  telegraph.diffuseTexture = telegraphTexture(scene);
  telegraph.useAlphaFromDiffuseTexture = true;
  telegraph.emissiveColor = new Color3(1, 0.3, 0.15);
  telegraph.disableLighting = true;
  telegraph.zOffset = -3;

  return {
    grass, dirt, stone, bark, leaves, shadow,
    player: {
      idle: spriteMaterial(scene, "player-idle", spriteTexture(scene, "player-idle", drawPlayerIdle)),
      slash: spriteMaterial(scene, "player-slash", spriteTexture(scene, "player-slash", drawPlayerSlash)),
      down: spriteMaterial(scene, "player-down", spriteTexture(scene, "player-down", drawPlayerDown)),
    },
    slashFx, telegraph,
  };
}
