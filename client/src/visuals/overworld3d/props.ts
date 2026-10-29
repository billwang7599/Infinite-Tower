import { DynamicTexture, Texture, type Scene } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { PropKind } from "./scenery.js";

/** Texels per tile, for every pixel-art picture in the 3D overworld. */
export const PX_PER_TILE = 16;

type Draw = (pen: Pen, rand: () => number) => void;

export interface PropArt { widthPx: number; heightPx: number; draw: Draw }

export class Pen {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  disc(cx: number, cy: number, r: number, color: string): void {
    this.ctx.fillStyle = color;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  outline(color: string): void {
    const { width, height } = this.ctx.canvas, img = this.ctx.getImageData(0, 0, width, height).data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && img[(y * width + x) * 4 + 3]! > 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          this.rect(x, y, 1, 1, color);
        }
      }
    }
  }
}

const LEAF = { deep: "#1d3a2a", dark: "#2b5a35", mid: "#3f7f3e", light: "#6aa64a", shine: "#b5cf68" };
const PINE = { deep: "#16302a", dark: "#22483a", mid: "#2f6448", light: "#4c8a57" };
const BARK = { dark: "#3e2718", mid: "#6a4429", light: "#8a5d36" };
const STONE = { deep: "#3d3a44", dark: "#5c5866", mid: "#837e8a", light: "#aaa4ad" };
const OUTLINE = "#14201a";

function crown(pen: Pen, rand: () => number, cx: number, cy: number, r: number): void {
  pen.disc(cx, cy, r, LEAF.deep);
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2, d = r * 0.55;
    pen.disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * 0.48, LEAF.dark);
  }
  pen.disc(cx - r * 0.12, cy - r * 0.15, r * 0.72, LEAF.mid);
  for (let i = 0; i < 5; i++) pen.disc(cx - r * 0.3 + rand() * r * 0.5, cy - r * 0.45 + rand() * r * 0.4, r * 0.25, LEAF.light);
  for (let i = 0; i < 6; i++) pen.rect(cx - r * 0.5 + rand() * r * 0.8, cy - r * 0.6 + rand() * r * 0.5, 1, 1, LEAF.shine);
}

const tree: Draw = (pen, rand) => {
  pen.rect(21, 40, 6, 24, BARK.mid);
  pen.rect(21, 40, 2, 24, BARK.dark);
  pen.rect(25, 44, 1, 14, BARK.light);
  pen.rect(17, 61, 14, 3, BARK.dark);
  crown(pen, rand, 24, 24, 17);
  crown(pen, rand, 14, 32, 9);
  crown(pen, rand, 34, 31, 10);
  pen.outline(OUTLINE);
};

const pine: Draw = (pen) => {
  pen.rect(14, 50, 4, 14, BARK.mid);
  pen.rect(14, 50, 1, 14, BARK.dark);
  for (const [top, half, rows] of [[3, 7, 14], [12, 11, 17], [24, 14, 22]] as const) {
    for (let r = 0; r < rows; r++) {
      const w = Math.round((half * (r + 1)) / rows);
      pen.rect(16 - w, top + r, w * 2, 1, PINE.dark);
      pen.rect(16 - w, top + r, Math.max(1, w - 2), 1, PINE.mid);
      if (r % 3 === 1) pen.rect(16 - w + 1, top + r, Math.max(1, w / 2), 1, PINE.light);
    }
    pen.rect(16 - half, top + rows - 1, half * 2, 1, PINE.deep);
  }
  pen.outline(OUTLINE);
};

const bush: Draw = (pen, rand) => {
  for (const [x, y, r] of [[8, 13, 6], [16, 10, 8], [24, 13, 6]] as const) pen.disc(x, y, r, LEAF.dark);
  for (const [x, y, r] of [[8, 12, 4], [15, 8, 6], [23, 12, 4]] as const) pen.disc(x, y, r, LEAF.mid);
  for (let i = 0; i < 8; i++) pen.rect(6 + rand() * 18, 4 + rand() * 7, 1, 1, LEAF.light);
  pen.rect(13, 6, 1, 1, "#e9d6f0");
  pen.rect(20, 9, 1, 1, "#f2e18a");
  pen.outline(OUTLINE);
};

const rock: Draw = (pen) => {
  pen.disc(12, 11, 9, STONE.dark);
  pen.rect(3, 12, 18, 4, STONE.dark);
  pen.disc(10, 9, 7, STONE.mid);
  pen.disc(8, 7, 4, STONE.light);
  pen.rect(13, 12, 6, 1, STONE.deep);
  pen.rect(4, 14, 4, 1, "#4f7a3a");
  pen.outline(OUTLINE);
};

const BLADE = { dark: "#3f6a2e", mid: "#5d8f3c", light: "#88b552", shine: "#c4dc7a" };
const TALL_BLADE = { dark: "#335c2b", mid: "#467a35", light: "#6c9d45", shine: "#a8c860" };

const blades = (pen: Pen, rand: () => number, w: number, h: number, count: number, colours = BLADE) => {
  for (let i = 0; i < count; i++) {
    const x = 1 + Math.floor(rand() * (w - 2)), tall = Math.floor(h * (0.45 + rand() * 0.55));
    const lean = rand() < 0.5 ? -1 : 1, colour = [colours.dark, colours.mid, colours.light][i % 3]!;
    pen.rect(x, h - tall + 1, 1, tall, colour);
    pen.rect(x + lean, h - tall, 1, 2, colour);
    if (rand() < 0.3) pen.rect(x, h - tall + 1, 1, 1, colours.shine);
  }
};

const tuft: Draw = (pen, rand) => blades(pen, rand, 16, 10, 7);

const tallGrass: Draw = (pen, rand) => {
  pen.rect(1, 12, 14, 2, TALL_BLADE.dark);
  blades(pen, rand, 16, 13, 12, TALL_BLADE);
};

const flowers: Draw = (pen, rand) => {
  blades(pen, rand, 16, 10, 5);
  const petals = ["#f4efe0", "#f2c94c", "#e58aa8", "#9ab8f2"];
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(rand() * 11), y = 1 + Math.floor(rand() * 4), c = petals[Math.floor(rand() * petals.length)]!;
    pen.rect(x, y + 1, 3, 1, c);
    pen.rect(x + 1, y, 1, 3, c);
    pen.rect(x + 1, y + 1, 1, 1, "#d9822b");
  }
};

const banner: Draw = (pen) => {
  pen.rect(3, 2, 2, 46, BARK.dark);
  pen.rect(4, 2, 1, 46, BARK.mid);
  pen.rect(2, 1, 12, 2, "#c9a24a");
  pen.rect(5, 3, 8, 22, "#7e1f24");
  pen.rect(5, 3, 2, 22, "#5a1419");
  pen.rect(11, 3, 2, 22, "#a32b2c");
  for (let i = 0; i < 4; i++) pen.rect(5 + i * 2, 25 + (i % 2), 2, 2, "#7e1f24");
  pen.rect(7, 9, 4, 6, "#d9b44a");
  pen.rect(8, 8, 2, 8, "#d9b44a");
  pen.rect(8, 11, 2, 2, "#7e1f24");
  pen.outline(OUTLINE);
};

const fence: Draw = (pen) => {
  for (const x of [1, 17]) {
    pen.rect(x, 2, 3, 14, BARK.mid);
    pen.rect(x, 2, 1, 14, BARK.dark);
  }
  for (const y of [5, 10]) {
    pen.rect(0, y, 32, 2, BARK.light);
    pen.rect(0, y + 1, 32, 1, BARK.dark);
  }
};

export const PROP_ART: Record<PropKind, PropArt> = {
  tree: { widthPx: 48, heightPx: 64, draw: tree },
  pine: { widthPx: 32, heightPx: 64, draw: pine },
  bush: { widthPx: 32, heightPx: 20, draw: bush },
  rock: { widthPx: 24, heightPx: 18, draw: rock },
  tuft: { widthPx: 16, heightPx: 10, draw: tuft },
  tallGrass: { widthPx: 16, heightPx: 14, draw: tallGrass },
  flowers: { widthPx: 16, heightPx: 10, draw: flowers },
  banner: { widthPx: 16, heightPx: 48, draw: banner },
  fence: { widthPx: 32, heightPx: 16, draw: fence },
};

export function pixelCanvas(
  scene: Scene, name: string, widthPx: number, heightPx: number, draw: (pen: Pen) => void, alpha = true,
): DynamicTexture {
  const tex = new DynamicTexture(name, { width: widthPx, height: heightPx }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, widthPx, heightPx);
  draw(new Pen(ctx));
  tex.update();
  tex.hasAlpha = alpha;
  return tex;
}

export function propTexture(scene: Scene, kind: PropKind, seed: number): DynamicTexture {
  const art = PROP_ART[kind], rand = seededRandom(seed);
  return pixelCanvas(scene, `prop-${kind}`, art.widthPx, art.heightPx, (pen) => art.draw(pen, rand));
}
