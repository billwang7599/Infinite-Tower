import { DynamicTexture, Texture, type Scene } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import type { PropKind } from "./scenery.js";

/** Texels per tile, for every pixel-art picture in the overworld. */
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

const DEAD_WOOD = { dark: "#2e2620", mid: "#4a3f36", light: "#655849" };

const deadTree: Draw = (pen, rand) => {
  const branch = (x: number, y: number, way: number, length: number) => {
    for (let i = 0; i < length; i++) {
      pen.rect(x + way * i, y - Math.floor(i * 0.7), 2, 2, i % 3 ? DEAD_WOOD.mid : DEAD_WOOD.dark);
    }
  };
  pen.rect(14, 18, 5, 38, DEAD_WOOD.mid);
  pen.rect(14, 18, 2, 38, DEAD_WOOD.dark);
  pen.rect(17, 24, 1, 26, DEAD_WOOD.light);
  pen.rect(10, 53, 13, 3, DEAD_WOOD.dark);
  branch(15, 32, -1, 11);
  branch(18, 27, 1, 11);
  branch(15, 20, -1, 7);
  branch(17, 17, 1, 6);
  for (let i = 0; i < 6; i++) pen.rect(4 + rand() * 24, 4 + rand() * 16, 1, 2, DEAD_WOOD.dark);
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

const REED = { dark: "#2c3b26", mid: "#3e5233", light: "#58704a", shine: "#7f9160" };

const reeds: Draw = (pen, rand) => {
  blades(pen, rand, 16, 18, 10, REED);
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(rand() * 12), y = 1 + Math.floor(rand() * 5);
    pen.rect(x, y + 3, 1, 15 - y, REED.mid);
    pen.rect(x, y, 2, 4, "#5a3d26");
    pen.rect(x, y, 1, 3, "#7a5536");
  }
};

const mushrooms: Draw = (pen, rand) => {
  blades(pen, rand, 16, 10, 3, REED);
  const caps = ["#9fd8c8", "#c8b6e2", "#d8e6b0"];
  for (let i = 0; i < 3; i++) {
    const x = 1 + Math.floor(rand() * 11), h = 2 + Math.floor(rand() * 3), cap = caps[Math.floor(rand() * caps.length)]!;
    pen.rect(x + 1, 10 - h, 1, h, "#d9d2bd");
    pen.rect(x, 8 - h, 4, 2, cap);
    pen.rect(x + 1, 7 - h, 2, 1, cap);
  }
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

const ruin: Draw = (pen, rand) => {
  for (let row = 0; row < 5; row++) {
    const y = 23 - (row + 1) * 4, top = row === 4, shift = row % 2 ? 3 : 0;
    for (let x = -shift; x < 16; x += 6) {
      if (top && rand() < 0.45) continue;
      const tone = [STONE.dark, STONE.mid, STONE.mid, STONE.light][Math.floor(rand() * 4)]!;
      pen.rect(x + 1, y + 1, 5, 3, tone);
      pen.rect(x + 1, y + 1, 5, 1, STONE.light);
      pen.rect(x + 1, y + 3, 5, 1, STONE.deep);
    }
  }
  pen.rect(0, 22, 16, 2, STONE.deep);
  for (let i = 0; i < 5; i++) pen.rect(rand() * 14, 6 + rand() * 14, 2, 1, "#56693f");
  pen.outline(OUTLINE);
};

const WOOD = { dark: "#3e2a1c", mid: "#6a4a30", light: "#8c6842" };

function stall(awning: readonly [string, string], goods: Draw): Draw {
  return (pen, rand) => {
    pen.rect(1, 6, 2, 18, WOOD.dark);
    pen.rect(13, 6, 2, 18, WOOD.dark);
    pen.rect(0, 15, 16, 9, WOOD.mid);
    pen.rect(0, 15, 16, 1, WOOD.light);
    pen.rect(0, 19, 16, 1, WOOD.dark);
    for (let x = 0; x < 16; x += 4) pen.rect(x, 0, 2, 6, awning[0]);
    for (let x = 2; x < 16; x += 4) pen.rect(x, 0, 2, 6, awning[1]);
    for (let x = 0; x < 16; x += 2) pen.rect(x, 6, 1, 1, awning[x % 4 ? 1 : 0]);
    pen.rect(0, 0, 16, 1, "#00000040");
    goods(pen, rand);
    pen.outline(OUTLINE);
  };
}

const food = stall(["#e8dcc0", "#4f7a3a"], (pen, rand) => {
  for (let x = 1; x < 15; x += 4) {
    pen.rect(x, 12, 4, 3, "#b7843e");
    pen.rect(x, 12, 4, 1, "#d6a75c");
  }
  for (let i = 0; i < 3; i++) pen.disc(3 + rand() * 10, 10.5, 1.4, rand() < 0.5 ? "#c0392b" : "#d9a02b");
});

const potions = stall(["#e8dcc0", "#5b3f8a"], (pen, rand) => {
  for (let x = 2; x < 15; x += 3) {
    const glass = ["#7fd3c4", "#c46fb8", "#e0c25a", "#7f9ad8"][Math.floor(rand() * 4)]!;
    pen.rect(x, 10, 2, 5, glass);
    pen.rect(x, 9, 2, 1, "#d9d2bd");
    pen.rect(x, 11, 1, 1, "#ffffff80");
  }
});

const coins = stall(["#e8dcc0", "#a8862e"], (pen, rand) => {
  pen.rect(7, 8, 2, 7, WOOD.dark);
  pen.rect(3, 8, 10, 1, "#7a7e8a");
  pen.rect(2, 9, 3, 1, "#d6a75c");
  pen.rect(11, 9, 3, 1, "#d6a75c");
  for (let i = 0; i < 4; i++) {
    pen.rect(1 + rand() * 4, 13 + rand() * 1.5, 2, 1, ["#c99e2a", "#a5acb5", "#b4602e"][i % 3]!);
    pen.rect(10 + rand() * 4, 13 + rand() * 1.5, 2, 1, ["#c99e2a", "#a5acb5", "#b4602e"][(i + 1) % 3]!);
  }
});

const forge: Draw = (pen) => {
  pen.rect(0, 4, 16, 20, STONE.dark);
  for (let y = 4; y < 24; y += 4) for (let x = (y / 4) % 2 ? 0 : 3; x < 16; x += 6) pen.rect(x, y, 5, 3, STONE.mid);
  pen.rect(3, 9, 10, 6, "#2a1a14");
  pen.rect(4, 12, 8, 3, "#e0482a");
  pen.rect(5, 11, 6, 2, "#f7b23b");
  pen.rect(6, 12, 2, 1, "#ffe08a");
  pen.rect(2, 18, 12, 2, "#4a4c55");
  pen.rect(5, 20, 6, 4, "#3a3c44");
  pen.rect(2, 18, 12, 1, "#7a7e8a");
  pen.outline(OUTLINE);
};

const dummy: Draw = (pen) => {
  pen.rect(7, 2, 2, 22, WOOD.mid);
  pen.rect(1, 8, 14, 2, WOOD.mid);
  pen.rect(1, 8, 14, 1, WOOD.light);
  pen.rect(4, 10, 8, 8, "#b89a52");
  pen.rect(4, 13, 8, 1, "#4a3a26");
  pen.rect(5, 2, 6, 5, "#b89a52");
  pen.rect(5, 2, 6, 1, "#d2b46a");
  pen.outline(OUTLINE);
};

export const PROP_ART: Record<PropKind, PropArt> = {
  tree: { widthPx: 48, heightPx: 64, draw: tree },
  pine: { widthPx: 32, heightPx: 64, draw: pine },
  deadTree: { widthPx: 32, heightPx: 56, draw: deadTree },
  bush: { widthPx: 32, heightPx: 20, draw: bush },
  rock: { widthPx: 24, heightPx: 18, draw: rock },
  tuft: { widthPx: 16, heightPx: 10, draw: tuft },
  tallGrass: { widthPx: 16, heightPx: 14, draw: tallGrass },
  flowers: { widthPx: 16, heightPx: 10, draw: flowers },
  reeds: { widthPx: 16, heightPx: 18, draw: reeds },
  mushrooms: { widthPx: 16, heightPx: 10, draw: mushrooms },
  ruin: { widthPx: 16, heightPx: 24, draw: ruin },
  foodStall: { widthPx: 16, heightPx: 24, draw: food },
  potionStall: { widthPx: 16, heightPx: 24, draw: potions },
  forge: { widthPx: 16, heightPx: 24, draw: forge },
  changerStall: { widthPx: 16, heightPx: 24, draw: coins },
  dummy: { widthPx: 16, heightPx: 24, draw: dummy },
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
