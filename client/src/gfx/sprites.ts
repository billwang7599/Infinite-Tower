/**
 * Pixel-art materials. Sprite frames are drawn in code (no asset files): a 24x24 "pixel" grid, 8 texels
 * per pixel, side views facing right (the drawings live in characters.ts). Used by the arena (billboards) and
 * the overworld (flat quads); pixelMaterial also dresses the overworld's ground textures.
 */
import { Color3, DynamicTexture, Material, StandardMaterial, Texture, type Scene } from "@babylonjs/core";

export type Px = (x: number, y: number, w: number, h: number, color: string) => void;
export type SpriteDraw = (px: Px) => void;

export interface PixelMaterialOptions {
  /** Cut out transparent pixels (alpha test, not blend): crisp edges, no sorting issues. Default true. */
  cutout?: boolean;
  /** Ignore lights completely (the 2D overworld has none). Default false: lit, but mostly self-colored. */
  unlit?: boolean;
}

/** A material that shows a texture's own colors. */
export function pixelMaterial(
  scene: Scene, name: string, tex: DynamicTexture, opts: PixelMaterialOptions = {},
): StandardMaterial {
  const { cutout = true, unlit = false } = opts;
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex; // keeps the colors even in shade
  m.disableLighting = unlit;
  m.specularColor = Color3.Black();
  m.backFaceCulling = false;
  if (cutout) {
    // Babylon 9 tests the final alpha, so the texture's alpha must be wired in too.
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
  }
  return m;
}

/** One sprite frame, ready for a quad: draw it, then wrap it in a cut-out pixelMaterial. */
export function spriteMaterial(scene: Scene, name: string, draw: SpriteDraw): StandardMaterial {
  return pixelMaterial(scene, name, spriteTexture(scene, name, draw));
}

/** Draw a sprite material's frame again, in place (a new look for the player, say). */
export function redrawSprite(material: StandardMaterial, draw: SpriteDraw): void {
  paint(material.diffuseTexture as DynamicTexture, draw);
}

/** A sprite is SPRITE_PX "pixels" square, each drawn as TEXELS_PER_PX texels. */
export const SPRITE_PX = 24;
const TEXELS_PER_PX = 8;
const TEXTURE_SIZE = SPRITE_PX * TEXELS_PER_PX;

function spriteTexture(scene: Scene, name: string, draw: SpriteDraw): DynamicTexture {
  const size = { width: TEXTURE_SIZE, height: TEXTURE_SIZE };
  const tex = new DynamicTexture(name, size, scene, false, Texture.NEAREST_SAMPLINGMODE);
  paint(tex, draw);
  tex.hasAlpha = true;
  return tex;
}

function paint(tex: DynamicTexture, draw: SpriteDraw): void {
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  draw((x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * TEXELS_PER_PX, y * TEXELS_PER_PX, w * TEXELS_PER_PX, h * TEXELS_PER_PX);
  });
  tex.update();
}
