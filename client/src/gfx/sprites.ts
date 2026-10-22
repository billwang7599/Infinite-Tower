/**
 * Pixel-art sprite frames drawn in code (no asset files). Each frame is a 24x24 "pixel" grid, 8 texels
 * per pixel, drawn facing right. Used by both the arena (billboards) and the 2D map (flat sprites).
 * The actual drawings live in characters.ts.
 */
import { Color3, DynamicTexture, Material, StandardMaterial, Texture, type Scene } from "@babylonjs/core";

export type Px = (x: number, y: number, w: number, h: number, color: string) => void;
export type SpriteDraw = (px: Px) => void;

export function spriteTexture(scene: Scene, name: string, draw: SpriteDraw): DynamicTexture {
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

export function spriteMaterial(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
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
