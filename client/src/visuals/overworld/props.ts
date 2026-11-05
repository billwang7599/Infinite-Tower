import type { PropKind } from "./scenery.js";

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

const produce: Draw = (pen, rand) => {
  for (let x = 1; x < 15; x += 7) {
    pen.rect(x, 5, 6, 4, "#b7843e");
    pen.rect(x, 5, 6, 1, "#d6a75c");
    pen.rect(x, 7, 6, 1, "#8a5d2c");
  }
  for (let i = 0; i < 5; i++) pen.disc(2.5 + rand() * 11, 4, 1.5, ["#c0392b", "#d9a02b", "#c8a060"][i % 3]!);
  pen.outline(OUTLINE);
};

const potions: Draw = (pen, rand) => {
  for (let x = 1; x < 15; x += 3) {
    const glass = ["#7fd3c4", "#c46fb8", "#e0c25a", "#7f9ad8"][Math.floor(rand() * 4)]!, h = 4 + Math.floor(rand() * 3);
    pen.rect(x, 10 - h, 2, h, glass);
    pen.rect(x, 9 - h, 2, 1, "#d9d2bd");
    pen.rect(x, 11 - h, 1, 1, "#ffffff80");
  }
  pen.outline(OUTLINE);
};

const scales: Draw = (pen, rand) => {
  pen.rect(7, 2, 2, 8, WOOD.dark);
  pen.rect(3, 2, 10, 1, "#7a7e8a");
  pen.rect(2, 4, 3, 1, "#d6a75c");
  pen.rect(11, 4, 3, 1, "#d6a75c");
  pen.rect(3, 3, 1, 1, "#7a7e8a");
  pen.rect(12, 3, 1, 1, "#7a7e8a");
  for (let i = 0; i < 4; i++) {
    pen.rect(1 + rand() * 4, 8 + rand() * 1.5, 2, 1, ["#c99e2a", "#a5acb5", "#b4602e"][i % 3]!);
    pen.rect(10 + rand() * 4, 8 + rand() * 1.5, 2, 1, ["#c99e2a", "#a5acb5", "#b4602e"][(i + 1) % 3]!);
  }
  pen.outline(OUTLINE);
};

const meat: Draw = (pen) => {
  pen.rect(1, 1, 14, 1, WOOD.dark);
  for (const [x, h] of [[2, 6], [7, 8], [12, 5]] as const) {
    pen.rect(x + 1, 2, 1, 1, "#d9d2bd");
    pen.rect(x, 3, 3, h, "#9c3b30");
    pen.rect(x, 3, 1, h, "#c0584a");
    pen.rect(x + 1, 3 + h - 2, 1, 2, "#e8dcc0");
  }
  pen.outline(OUTLINE);
};

const fence: Draw = (pen) => {
  for (const x of [1, 13]) pen.rect(x, 1, 2, 11, WOOD.mid);
  for (const y of [3, 7]) {
    pen.rect(0, y, 16, 2, WOOD.mid);
    pen.rect(0, y, 16, 1, WOOD.light);
  }
  pen.outline(OUTLINE);
};

const embers: Draw = (pen) => {
  for (const [x, h] of [[2, 4], [6, 6], [10, 5]] as const) {
    pen.rect(x, 8 - h, 4, h, "#e0482a");
    pen.rect(x + 1, 9 - h, 2, h - 2, "#f7b23b");
    pen.rect(x + 1, 8 - Math.ceil(h / 2), 2, 1, "#ffe08a");
  }
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

const CUT = { deep: "#6f6656", dark: "#958b76", mid: "#b8ae97", light: "#d3cab4", dust: "#e2dac6" };
const IRON = { dark: "#3b3733", mid: "#5c5650", light: "#7d766d", rust: "#8a5a3a" };
const ROPE = "#c9b27e";

const block = (pen: Pen, x: number, y: number, w: number, h: number) => {
  pen.rect(x, y, w, h, CUT.mid);
  pen.rect(x, y, w, 1, CUT.light);
  pen.rect(x, y + h - 1, w, 1, CUT.dark);
  pen.rect(x + w - 1, y + 1, 1, h - 1, CUT.dark);
};

const rubble: Draw = (pen, rand) => {
  const stones = [[2, 10, 8, 7], [9, 11, 9, 6], [16, 12, 6, 5], [5, 5, 7, 6], [11, 6, 6, 5], [8, 2, 6, 4]] as const;
  for (const [x, y, w, h] of stones) block(pen, x + Math.floor(rand() * 2), y + Math.floor(rand() * 2), w, h);
  for (let i = 0; i < 5; i++) pen.rect(1 + rand() * 21, 16, 2, 1, CUT.deep);
  pen.rect(6, 4, 1, 1, CUT.dust);
  pen.outline(OUTLINE);
};

const chips: Draw = (pen, rand) => {
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(rand() * 12), y = 3 + Math.floor(rand() * 4), w = 2 + Math.floor(rand() * 2);
    pen.rect(x, y, w, 2, rand() < 0.5 ? CUT.mid : CUT.light);
    pen.rect(x, y + 1, w, 1, CUT.dark);
  }
};

const SCRUB = { dark: "#6c634d", mid: "#8f835f", light: "#b1a27a", shine: "#d4c596" };

const scrub: Draw = (pen, rand) => blades(pen, rand, 16, 12, 9, SCRUB);

const cart: Draw = (pen, rand) => {
  for (let i = 0; i < 6; i++) pen.disc(6 + rand() * 12, 6 + rand() * 2, 2.5, rand() < 0.5 ? CUT.mid : CUT.light);
  pen.rect(2, 8, 20, 2, IRON.light);
  pen.rect(3, 10, 18, 5, IRON.mid);
  pen.rect(4, 15, 16, 1, IRON.dark);
  for (const x of [6, 12, 17]) pen.rect(x, 10, 1, 5, IRON.dark);
  pen.rect(14, 12, 3, 2, IRON.rust);
  pen.rect(4, 11, 2, 1, IRON.rust);
  for (const x of [6, 17]) { pen.disc(x, 17, 2.5, IRON.dark); pen.rect(x, 16, 1, 1, IRON.light); }
  pen.outline(OUTLINE);
};

const crane: Draw = (pen) => {
  pen.rect(4, 74, 26, 4, WOOD.dark);
  pen.rect(4, 74, 26, 1, WOOD.light);
  for (let i = 0; i < 64; i++) {
    pen.rect(10 + Math.floor(i / 8), 74 - i, 2, 1, WOOD.mid);
    pen.rect(24 - Math.floor(i / 8), 74 - i, 2, 1, WOOD.mid);
  }
  for (const y of [58, 40, 24]) pen.rect(12, y, 12, 2, WOOD.dark);
  pen.rect(16, 6, 4, 6, WOOD.dark);
  for (let i = 0; i < 30; i++) pen.rect(18 + i, 8 + Math.floor(i * 0.35), 2, 2, i % 6 ? WOOD.mid : WOOD.light);
  for (let i = 0; i < 18; i++) pen.rect(18 - Math.floor(i * 0.7), 9 + i * 2, 1, 2, ROPE);
  pen.rect(46, 19, 1, 34, ROPE);
  block(pen, 41, 53, 11, 8);
  pen.rect(13, 62, 9, 9, WOOD.dark);
  pen.disc(17, 66, 4, WOOD.light);
  pen.disc(17, 66, 2, WOOD.dark);
  pen.outline(OUTLINE);
};

const WEATHERED = ["#7d6e5c", "#6c5e4d", "#8d7e69", "#76675a"];

const shack: Draw = (pen, rand) => {
  for (let x = 0; x < 16; x += 2) {
    const top = 2 + Math.floor(rand() * (rand() < 0.3 ? 12 : 4));
    pen.rect(x, top, 2, 19 - top, WEATHERED[Math.floor(rand() * WEATHERED.length)]!);
    pen.rect(x, top, 1, 19 - top, "#5a4d3f");
  }
  pen.rect(0, 9, 16, 2, WOOD.dark);
  pen.rect(0, 9, 16, 1, WOOD.mid);
  for (let x = 0; x < 16; x += 5) block(pen, x, 19, 5, 5);
  pen.outline(OUTLINE);
};

const BRONZE = { deep: "#24302c", dark: "#35493f", mid: "#4d6a58", light: "#6f9078", shine: "#a9c4a0" };

const statue: Draw = (pen) => {
  pen.rect(22, 2, 2, 20, BRONZE.light);
  pen.rect(23, 2, 1, 20, BRONZE.mid);
  pen.rect(19, 21, 8, 2, BRONZE.mid);
  pen.rect(21, 23, 4, 4, BRONZE.dark);
  pen.disc(15.5, 18, 4, BRONZE.mid);
  pen.rect(12, 15, 8, 2, BRONZE.light);
  pen.rect(13, 13, 6, 2, BRONZE.mid);
  pen.rect(13, 13, 1, 1, BRONZE.shine);
  pen.rect(17, 13, 1, 1, BRONZE.shine);
  pen.rect(16, 18, 2, 2, BRONZE.dark);
  for (let y = 23; y < 60; y++) {
    const half = 5 + Math.floor((y - 23) * 0.24);
    pen.rect(16 - half, y, half * 2, 1, BRONZE.mid);
    pen.rect(16 - half, y, Math.max(1, Math.floor(half * 0.6)), 1, BRONZE.light);
    pen.rect(16 + half - 3, y, 3, 1, BRONZE.dark);
  }
  pen.rect(19, 23, 4, 4, BRONZE.mid);
  pen.rect(20, 25, 3, 8, BRONZE.mid);
  pen.rect(13, 30, 6, 2, BRONZE.dark);
  pen.rect(12, 34, 8, 1, BRONZE.light);
  for (let y = 40; y < 60; y += 5) pen.rect(9 + (y % 3), y, 1, 4, BRONZE.deep);
  pen.rect(6, 59, 20, 2, BRONZE.dark);
  for (const [x, y] of [[10, 44], [21, 50], [14, 38]] as const) pen.rect(x, y, 2, 1, "#7fa89a");
  pen.outline("#151c19");
};

export const PROP_ART: Record<PropKind, PropArt> = {
  statue: { widthPx: 32, heightPx: 62, draw: statue },
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
  produce: { widthPx: 16, heightPx: 10, draw: produce },
  potions: { widthPx: 16, heightPx: 10, draw: potions },
  scales: { widthPx: 16, heightPx: 10, draw: scales },
  embers: { widthPx: 16, heightPx: 8, draw: embers },
  meat: { widthPx: 16, heightPx: 12, draw: meat },
  fence: { widthPx: 16, heightPx: 12, draw: fence },
  dummy: { widthPx: 16, heightPx: 24, draw: dummy },
  rubble: { widthPx: 24, heightPx: 18, draw: rubble },
  chips: { widthPx: 16, heightPx: 8, draw: chips },
  scrub: { widthPx: 16, heightPx: 12, draw: scrub },
  cart: { widthPx: 24, heightPx: 20, draw: cart },
  crane: { widthPx: 56, heightPx: 80, draw: crane },
  shack: { widthPx: 16, heightPx: 24, draw: shack },
};
