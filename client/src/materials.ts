/**
 * Procedural textures and shared materials, so the prototype needs no asset files.
 * Swap these for real art later; nothing else depends on how they're made.
 */
import { Color3, DynamicTexture, Material, StandardMaterial, Texture, type Scene } from "@babylonjs/core";

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
function rng(seed: number): () => number {
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

type Px = (x: number, y: number, w: number, h: number, color: string) => void;

/** A 24x24 "pixel" sprite frame (8 texels per pixel), drawn facing right. */
function spriteTexture(scene: Scene, name: string, draw: (px: Px) => void): DynamicTexture {
  const n = 192;
  const tex = new DynamicTexture(name, { width: n, height: n }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, n, n);
  draw((x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 8, y * 8, w * 8, h * 8);
  });
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

const C = {
  boot: "#2a1d16", leg: "#3b4a6b", cloak: "#c0453a", cloakHi: "#d9584a", cloakLo: "#8e2f27",
  buckle: "#f2c14e", skin: "#f1c9a5", eye: "#1b1b2a", hoodTip: "#a8392f",
  blade: "#dfe6f0", bladeHi: "#ffffff", guard: "#c9a03a", grip: "#5a3a1e",
};

/** Hooded adventurer body, shared by the standing frames. ox shifts it horizontally. */
function drawBody(px: Px, ox: number): void {
  px(ox + 4, 22, 3, 2, C.boot); px(ox + 9, 22, 3, 2, C.boot);
  px(ox + 5, 18, 2, 4, C.leg); px(ox + 9, 18, 2, 4, C.leg);
  px(ox + 3, 10, 10, 9, C.cloak);
  px(ox + 4, 11, 8, 7, C.cloakHi);
  px(ox + 3, 17, 10, 1, C.cloakLo);
  px(ox + 7, 17, 2, 1, C.buckle);
  px(ox + 4, 3, 8, 8, C.cloakLo);
  px(ox + 6, 5, 6, 5, C.skin);
  px(ox + 9, 6, 2, 2, C.eye);
  px(ox + 5, 2, 5, 2, C.hoodTip);
}

function spriteMaterial(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex; // mostly unlit: sprites keep their colors
  // Alpha *test* (not blend): crisp pixel edges, no sorting issues. Babylon 9 tests the final
  // alpha, so the texture's alpha must also be wired in via useAlphaFromDiffuseTexture.
  m.useAlphaFromDiffuseTexture = true;
  m.transparencyMode = Material.MATERIAL_ALPHATEST;
  m.specularColor = Color3.Black();
  m.backFaceCulling = false;
  return m;
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

  const idle = spriteTexture(scene, "player-idle", (px) => {
    drawBody(px, 4);
    px(16, 12, 2, 4, C.skin);           // hand
    px(18, 3, 1, 9, C.blade);           // blade, held upright
    px(19, 4, 1, 7, C.bladeHi);
    px(17, 12, 3, 1, C.guard);
    px(18, 13, 1, 2, C.grip);
  });
  const slash = spriteTexture(scene, "player-slash", (px) => {
    drawBody(px, 3);
    px(15, 11, 3, 2, C.skin);           // arm thrust forward
    px(18, 10, 1, 3, C.guard);
    px(19, 11, 5, 1, C.blade);          // blade, extended
    px(19, 12, 5, 1, C.bladeHi);
  });
  const down = spriteTexture(scene, "player-down", (px) => {
    px(19, 20, 2, 3, C.boot);
    px(14, 21, 5, 2, C.leg);
    px(6, 19, 9, 4, C.cloak);
    px(7, 20, 7, 2, C.cloakHi);
    px(2, 19, 5, 4, C.cloakLo);
    px(3, 20, 3, 2, C.skin);
    px(4, 23, 14, 1, C.blade);          // dropped sword
  });

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
      idle: spriteMaterial(scene, "player-idle", idle),
      slash: spriteMaterial(scene, "player-slash", slash),
      down: spriteMaterial(scene, "player-down", down),
    },
    slashFx, telegraph,
  };
}
