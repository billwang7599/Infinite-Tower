import { DynamicTexture, Texture, type Scene } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";

interface DrawnTextureOptions {
  /** Pixels; height defaults to width. */
  width: number;
  height?: number;
  mipmaps?: boolean;
  /** Repeat across the surface (tiling). */
  wrap?: boolean;
  /** Use the canvas's alpha (transparent parts). */
  alpha?: boolean;
}

/** A texture drawn once with the 2D canvas API. */
function drawnTexture(
  scene: Scene, name: string, opts: DrawnTextureOptions, draw: (ctx: CanvasRenderingContext2D) => void,
): DynamicTexture {
  const { width, height = width, mipmaps = false } = opts;
  const tex = new DynamicTexture(name, { width, height }, scene, mipmaps);
  draw(tex.getContext() as CanvasRenderingContext2D);
  tex.update();
  if (opts.wrap) tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  if (opts.alpha) tex.hasAlpha = true;
  return tex;
}

export interface SpeckleOptions {
  base: string;
  specks: string[];
  count: number;
  /** A speck's radius is 1 to 1 + this, in pixels (of 256). */
  maxRadiusPx: number;
  seed: number;
}

/** Base color plus random blotches, tiling: grass, dirt, stone. */
export function speckleTexture(scene: Scene, name: string, opts: SpeckleOptions): DynamicTexture {
  const size = 256;
  return drawnTexture(scene, name, { width: size, mipmaps: true, wrap: true }, (ctx) => {
    ctx.fillStyle = opts.base;
    ctx.fillRect(0, 0, size, size);
    const rand = seededRandom(opts.seed);
    for (let i = 0; i < opts.count; i++) {
      ctx.fillStyle = opts.specks[Math.floor(rand() * opts.specks.length)]!;
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      const x = rand() * size, y = rand() * size, radius = 1 + rand() * opts.maxRadiusPx;
      // Draw wrapped copies so the texture tiles seamlessly.
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  });
}

/** Soft round shadow. */
export function blobTexture(scene: Scene): DynamicTexture {
  const size = 64;
  return drawnTexture(scene, "blob", { width: size, alpha: true }, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Attack telegraph: a red stripe that fades out along its length (v = 0 at the attacker). */
export function telegraphTexture(scene: Scene): DynamicTexture {
  const width = 32, height = 256;
  return drawnTexture(scene, "telegraph", { width, height, alpha: true }, (ctx) => {
    const g = ctx.createLinearGradient(0, height, 0, 0);
    g.addColorStop(0, "rgba(255,60,30,0.9)");
    g.addColorStop(1, "rgba(255,60,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "destination-in";
    const edge = ctx.createLinearGradient(0, 0, width, 0);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(0.3, "rgba(0,0,0,1)");
    edge.addColorStop(0.7, "rgba(0,0,0,1)");
    edge.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  });
}

export function glowTexture(scene: Scene): DynamicTexture {
  const size = 64;
  return drawnTexture(scene, "glow", { width: size, alpha: true }, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

export function puffTexture(scene: Scene): DynamicTexture {
  const size = 64;
  return drawnTexture(scene, "puff", { width: size, alpha: true }, (ctx) => {
    const rand = seededRandom(7);
    for (let i = 0; i < 9; i++) {
      const x = size / 2 + (rand() - 0.5) * 24, y = size / 2 + (rand() - 0.5) * 24, r = 10 + rand() * 12;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  });
}
