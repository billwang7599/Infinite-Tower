/**
 * Procedural textures and shared materials, so the prototype needs no asset files.
 * Swap these for real art later; nothing else depends on how they're made.
 */
import { Color3, DynamicTexture, Material, StandardMaterial, Texture, type Scene } from "@babylonjs/core";

/** Every 10 floors the tower changes palette. */
export const ZONES = [
  { name: "Foundations", stone: "#5b5f73", mortar: "#34364a", platform: new Color3(0.55, 0.5, 0.45) },
  { name: "Mossy Halls", stone: "#4f6b5a", mortar: "#2c3d33", platform: new Color3(0.4, 0.6, 0.42) },
  { name: "Ember Stair", stone: "#734f48", mortar: "#3d2a27", platform: new Color3(0.75, 0.45, 0.32) },
  { name: "Frost Spire", stone: "#5d7386", mortar: "#33414d", platform: new Color3(0.6, 0.78, 0.9) },
  { name: "Violet Crown", stone: "#65507a", mortar: "#382c45", platform: new Color3(0.7, 0.5, 0.85) },
] as const;

export function zoneIndex(floor: number): number {
  return Math.floor(floor / 10) % ZONES.length;
}

export interface Materials {
  wall: StandardMaterial[];
  wallSide: StandardMaterial[];
  platform: StandardMaterial[];
  checkpoint: StandardMaterial;
  window: StandardMaterial;
  shadow: StandardMaterial;
  player: StandardMaterial;
}

function brickTexture(scene: Scene, stone: string, mortar: string): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture("bricks", { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const rows = 8, cols = 4, gap = 4;
  const bw = size / cols, bh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : bw / 2;
    for (let c = -1; c <= cols; c++) {
      // Deterministic per-brick shade variation.
      const shade = ((r * 31 + c * 17) % 7) / 7;
      ctx.globalAlpha = 1;
      ctx.fillStyle = stone;
      ctx.fillRect(c * bw + offset + gap / 2, r * bh + gap / 2, bw - gap, bh - gap);
      ctx.globalAlpha = 0.08 + shade * 0.12;
      ctx.fillStyle = shade > 0.5 ? "#ffffff" : "#000000";
      ctx.fillRect(c * bw + offset + gap / 2, r * bh + gap / 2, bw - gap, bh - gap);
    }
  }
  ctx.globalAlpha = 1;
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** A small hooded adventurer, drawn facing right. */
function playerTexture(scene: Scene): DynamicTexture {
  const w = 128, h = 192;
  const tex = new DynamicTexture("player", { width: w, height: h }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  const px = (x: number, y: number, pw: number, ph: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 8, y * 8, pw * 8, ph * 8);
  };
  // 16x24 "pixel" grid.
  px(4, 22, 3, 2, "#2a1d16"); px(9, 22, 3, 2, "#2a1d16");     // boots
  px(5, 18, 2, 4, "#3b4a6b"); px(9, 18, 2, 4, "#3b4a6b");     // legs
  px(3, 10, 10, 9, "#c0453a");                                // cloak
  px(4, 11, 8, 7, "#d9584a");
  px(3, 17, 10, 1, "#8e2f27");                                // belt
  px(7, 17, 2, 1, "#f2c14e");                                 // buckle
  px(4, 3, 8, 8, "#8e2f27");                                  // hood
  px(6, 5, 6, 5, "#f1c9a5");                                  // face
  px(9, 6, 2, 2, "#1b1b2a");                                  // eye
  px(5, 2, 5, 2, "#a8392f");                                  // hood tip
  px(12, 12, 2, 5, "#f1c9a5");                                // hand
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

function shadowTexture(scene: Scene): DynamicTexture {
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

export function createMaterials(scene: Scene): Materials {
  const wall = ZONES.map((z, i) => {
    const m = new StandardMaterial(`wall-${i}`, scene);
    const tex = brickTexture(scene, z.stone, z.mortar);
    // One texture tile per floor slice vertically, so slices line up seamlessly.
    tex.uScale = 7.5;
    tex.vScale = 1;
    m.diffuseTexture = tex;
    m.specularColor = Color3.Black();
    return m;
  });

  // Side walls are deeper than a floor is tall: same bricks, different tiling.
  const wallSide = ZONES.map((z, i) => {
    const m = new StandardMaterial(`wall-side-${i}`, scene);
    const tex = brickTexture(scene, z.stone, z.mortar);
    tex.uScale = 5;
    tex.vScale = 1;
    m.diffuseTexture = tex;
    m.specularColor = Color3.Black();
    return m;
  });

  const platform = ZONES.map((z, i) => {
    const m = new StandardMaterial(`platform-${i}`, scene);
    m.diffuseColor = z.platform;
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    return m;
  });

  const checkpoint = new StandardMaterial("checkpoint", scene);
  checkpoint.diffuseColor = new Color3(0.9, 0.8, 0.4);
  checkpoint.emissiveColor = new Color3(1, 0.75, 0.25);

  const window = new StandardMaterial("window", scene);
  window.disableLighting = true;
  window.emissiveColor = new Color3(0.45, 0.7, 1.0);

  const shadow = new StandardMaterial("shadow", scene);
  shadow.diffuseTexture = shadowTexture(scene);
  shadow.useAlphaFromDiffuseTexture = true;
  shadow.disableLighting = true;
  shadow.emissiveColor = Color3.Black();
  shadow.zOffset = -2; // avoid z-fighting with the platform top

  const player = new StandardMaterial("player", scene);
  const tex = playerTexture(scene);
  player.diffuseTexture = tex;
  player.emissiveTexture = tex; // mostly unlit: sprites keep their colors
  // Alpha *test* (not blend): crisp pixel edges, no sorting issues. Babylon 9 tests the final
  // alpha, so the texture's alpha must also be wired in via useAlphaFromDiffuseTexture.
  player.useAlphaFromDiffuseTexture = true;
  player.transparencyMode = Material.MATERIAL_ALPHATEST;
  player.specularColor = Color3.Black();
  player.backFaceCulling = false;

  return { wall, wallSide, platform, checkpoint, window, shadow, player };
}
