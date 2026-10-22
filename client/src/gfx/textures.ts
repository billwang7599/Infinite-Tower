/** Procedural texture generators (canvas-drawn), shared by both scenes. */
import { DynamicTexture, Texture, type Scene } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";

/** Base color plus random blotches: grass, dirt, stone. */
export function speckleTexture(scene: Scene, name: string, base: string, specks: string[], count: number, maxR: number, seed: number): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const r = seededRandom(seed);
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

/** Soft round shadow. */
export function blobTexture(scene: Scene): DynamicTexture {
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
export function telegraphTexture(scene: Scene): DynamicTexture {
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

/** A small nearest-filtered, tiling texture drawn with the 2D canvas API (pixel art). */
export function pixelTexture(scene: Scene, name: string, size: number, draw: (ctx: CanvasRenderingContext2D) => void): DynamicTexture {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  draw(ctx);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

