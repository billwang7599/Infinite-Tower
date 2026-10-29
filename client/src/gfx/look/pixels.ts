/**
 * A small pixel-art canvas for character art. Each pixel remembers which material painted it (skin, hair,
 * cloth...), which tone of that material (outline ... shine) and which layer it came from. Colors are only looked
 * up at the end, so a new hair color is a palette swap, and outlines can be found wherever two layers meet.
 */

/** Tones, darkest to lightest. Every material has one color per tone (palette.ts). */
export const OUTLINE = 0, DEEP = 1, SHADOW = 2, BASE = 3, LIGHT = 4, SHINE = 5;
export type Tone = 0 | 1 | 2 | 3 | 4 | 5;

/** What a pixel is painted with: a material and a tone of it. */
export type Ink = readonly [material: string, tone: Tone];

/** Which pixels a shape covers, tested at each pixel's center. Drawing tests only the pixels in its `box`, if any. */
export type Mask = ((x: number, y: number) => boolean) & { box?: Box };
type Box = readonly [x0: number, y0: number, x1: number, y1: number];
export type Point = readonly [number, number];

export class Pixels {
  readonly materials: (string | null)[];
  readonly tones: Uint8Array;
  /** The layer that painted each pixel, -1 where nothing has. */
  readonly layers: Int8Array;
  /** 1 where a pixel merges into the same material under it: no inner outline between them (Pen.blend). */
  readonly blended: Uint8Array;

  constructor(readonly width: number, readonly height: number) {
    this.materials = new Array<string | null>(width * height).fill(null);
    this.tones = new Uint8Array(width * height);
    this.layers = new Int8Array(width * height).fill(-1);
    this.blended = new Uint8Array(width * height);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  layerAt(x: number, y: number): number {
    return this.inside(x, y) ? this.layers[y * this.width + x]! : -1;
  }

  materialAt(x: number, y: number): string | null {
    return this.inside(x, y) ? this.materials[y * this.width + x]! : null;
  }

  set(x: number, y: number, ink: Ink, layer: number): void {
    if (!this.inside(x, y)) return;
    const i = y * this.width + x;
    this.materials[i] = ink[0];
    this.tones[i] = ink[1];
    this.layers[i] = layer;
    this.blended[i] = 0;
  }

  retone(x: number, y: number, tone: Tone): void {
    if (this.inside(x, y)) this.tones[y * this.width + x] = tone;
  }
}

/** Draws one layer of a picture. Pieces of art get one of these per layer they draw on. */
export class Pen {
  constructor(private readonly px: Pixels, private readonly layer: number) {}

  get width(): number { return this.px.width; }

  /** Paint every pixel inside `mask`. */
  fill(mask: Mask, ink: Ink): void {
    this.each(mask, (x, y) => { if (mask(x, y)) this.px.set(x, y, ink, this.layer); });
  }

  /** Change the tone of pixels this layer already painted inside `mask` (shading a shape after filling it). */
  shade(mask: Mask, tone: Tone, material?: string): void {
    this.each(mask, (x, y) => {
      if (this.px.layerAt(x, y) !== this.layer || !mask(x, y)) return;
      if (material === undefined || this.px.materialAt(x, y) === material) this.px.retone(x, y, tone);
    });
  }

  /**
   * Let pixels this layer painted inside `mask` merge into the same material under them, with no inner outline:
   * a sleeve flowing into the shoulder of the coat it's sewn to, say. Edges against anything else still get one.
   */
  blend(mask: Mask): void {
    this.each(mask, (x, y) => {
      if (this.px.layerAt(x, y) === this.layer && mask(x, y)) this.px.blended[y * this.width + x] = 1;
    });
  }

  /** Darken pixels of a lower layer inside `mask`: a shadow this layer casts (bangs on the forehead, say). */
  castShadow(mask: Mask, onMaterial: string, tone: Tone = SHADOW): void {
    this.each(mask, (x, y) => {
      const layer = this.px.layerAt(x, y);
      if (layer < 0 || layer >= this.layer || this.px.materialAt(x, y) !== onMaterial || !mask(x, y)) return;
      this.px.retone(x, y, Math.min(tone, this.px.tones[y * this.width + x]!) as Tone);
    });
  }

  /**
   * Paint a hand-drawn grid, top-left at (x, y). Each character is looked up in `legend`; anything not in it
   * (like ".") is left alone. `mirrored` draws it flipped left-to-right.
   */
  grid(x: number, y: number, rows: readonly string[], legend: Readonly<Record<string, Ink>>, mirrored = false): void {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ink = legend[row[mirrored ? row.length - 1 - dx : dx]!];
        if (ink) this.px.set(x + dx, y + dy, ink, this.layer);
      }
    });
  }

  /** A one-pixel line (Bresenham). */
  line(from: Point, to: Point, ink: Ink): void {
    let [x0, y0] = from.map(Math.round) as [number, number];
    const [x1, y1] = to.map(Math.round) as [number, number];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px.set(x0, y0, ink, this.layer);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  dot(x: number, y: number, ink: Ink): void {
    this.px.set(x, y, ink, this.layer);
  }

  private each({ box }: Mask, visit: (x: number, y: number) => void): void {
    const { width, height } = this.px;
    const [x0, y0, x1, y1] = box ?? [0, 0, width - 1, height - 1];
    const left = Math.max(0, Math.ceil(x0)), right = Math.min(width - 1, Math.floor(x1));
    const bottom = Math.min(height - 1, Math.floor(y1));
    for (let y = Math.max(0, Math.ceil(y0)); y <= bottom; y++) for (let x = left; x <= right; x++) visit(x, y);
  }
}

/**
 * Outline each layer listed in `outlined`: its pixels next to nothing, or next to a lower layer, take the
 * OUTLINE tone of their own material. Higher layers draw their edge over lower ones, never the other way. The
 * picture's own edges aren't outlined: a bust cut off at the bottom just stops.
 * Where a shape only meets a lower layer of its own material (an arm over the chest, bangs over the back hair),
 * the line is DEEP instead: an inner line, softer than the silhouette.
 */
export function outline(px: Pixels, outlined: ReadonlySet<number>): void {
  const edge: number[] = [];
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      const layer = px.layerAt(x, y);
      if (layer < 0 || !outlined.has(layer)) continue;
      const lower = ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const)
        .filter(([nx, ny]) => px.inside(nx, ny) && px.layerAt(nx, ny) < layer);
      if (!lower.length) continue;
      const own = px.materialAt(x, y);
      const inner = lower.every(([nx, ny]) => px.layerAt(nx, ny) >= 0 && px.materialAt(nx, ny) === own);
      if (inner && px.blended[y * px.width + x]) continue;
      edge.push(x, y, inner ? DEEP : OUTLINE);
    }
  }
  for (let i = 0; i < edge.length; i += 3) px.retone(edge[i]!, edge[i + 1]!, edge[i + 2] as Tone);
}

// ---- Shapes ----

const bounded = (box: Box | undefined, test: (x: number, y: number) => boolean): Mask => Object.assign(test, { box });

const moved = (box: Box | undefined, dx0: number, dy0: number, dx1: number, dy1: number): Box | undefined =>
  box && [box[0] + dx0, box[1] + dy0, box[2] + dx1, box[3] + dy1];

const merged = (boxes: readonly (Box | undefined)[]): Box | undefined =>
  boxes.every((b) => b) ? [Math.min(...boxes.map((b) => b![0])), Math.min(...boxes.map((b) => b![1])),
    Math.max(...boxes.map((b) => b![2])), Math.max(...boxes.map((b) => b![3]))] : undefined;

export const ellipse = (cx: number, cy: number, rx: number, ry: number): Mask => {
  const ax = Math.abs(rx), ay = Math.abs(ry);
  return bounded([cx - ax - 1, cy - ay - 1, cx + ax, cy + ay],
    (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
};

/** Pixels x0..x1, y0..y1, inclusive. */
export const rect = (x0: number, y0: number, x1: number, y1: number): Mask =>
  bounded([x0, y0, x1, y1], (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

/** A polygon in pixel-edge coordinates (pixel (x, y) spans x..x+1); even-odd rule. */
export function polygon(points: readonly Point[]): Mask {
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  return bounded([Math.min(...xs) - 1, top - 1, Math.max(...xs), bottom], (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (py < top || py > bottom) return false;
    let inside = false;
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
      const xi = xs[i]!, yi = ys[i]!, xj = xs[j]!, yj = ys[j]!;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}

/** A polygon drawn as its left half: `half` runs down the left side; the right side is its mirror image. */
export function symmetric(half: readonly Point[], width: number): Mask {
  const right = [...half].reverse().map(([x, y]) => [width - x, y] as const);
  return polygon([...half, ...right]);
}

/** The pixels a hand-drawn grid covers, top-left at (x0, y0): every character but ".". */
export const gridMask = (x0: number, y0: number, rows: readonly string[]): Mask =>
  bounded([x0, y0, x0 + Math.max(...rows.map((row) => row.length)) - 1, y0 + rows.length - 1],
    (x, y) => (rows[y - y0]?.[x - x0] ?? ".") !== ".");

/** A shape given row by row from `top`: each row's leftmost and rightmost pixel. */
export const spans = (top: number, rows: readonly (readonly [number, number])[]): Mask =>
  bounded([Math.min(...rows.map(([l]) => l)), top, Math.max(...rows.map(([, r]) => r)), top + rows.length - 1],
    (x, y) => { const row = rows[y - top]; return !!row && x >= row[0] && x <= row[1]; });

export const union = (...masks: Mask[]): Mask =>
  bounded(merged(masks.map((m) => m.box)), (x, y) => masks.some((m) => m(x, y)));
export const minus = (mask: Mask, cut: Mask): Mask => bounded(mask.box, (x, y) => mask(x, y) && !cut(x, y));
export const both = (a: Mask, b: Mask): Mask => {
  const box = a.box && b.box
    ? [Math.max(a.box[0], b.box[0]), Math.max(a.box[1], b.box[1]), Math.min(a.box[2], b.box[2]),
      Math.min(a.box[3], b.box[3])] as const
    : a.box ?? b.box;
  return bounded(box, (x, y) => a(x, y) && b(x, y));
};
export const shift = (mask: Mask, dx: number, dy: number): Mask =>
  bounded(moved(mask.box, dx, dy, dx, dy), (x, y) => mask(x - dx, y - dy));
/** The mask `factor` times bigger, its point `from` moved to `to` (pixel-edge coordinates). */
export const scale = (mask: Mask, factor: number, [fx, fy]: Point, [tx, ty]: Point): Mask => {
  const b = mask.box, x = (sx: number) => tx + (sx - fx) * factor, y = (sy: number) => ty + (sy - fy) * factor;
  return bounded(b && [x(b[0]) - 1, y(b[1]) - 1, x(b[2] + 1), y(b[3] + 1)],
    (px, py) => mask(fx + (px + 0.5 - tx) / factor - 0.5, fy + (py + 0.5 - ty) / factor - 0.5));
};
export const flip = (mask: Mask, width: number): Mask => {
  const b = mask.box;
  return bounded(b && [width - 1 - b[2], b[1], width - 1 - b[0], b[3]], (x, y) => mask(width - 1 - x, y));
};
/** The mask plus its mirror image across the middle of a `width`-wide picture. */
export const mirror = (mask: Mask, width: number): Mask => {
  const b = mask.box;
  return bounded(b && merged([b, [width - 1 - b[2], b[1], width - 1 - b[0], b[3]]]),
    (x, y) => mask(x, y) || mask(width - 1 - x, y));
};

/** The mask and every pixel next to it: a shape one pixel bigger all round (cloth over skin, say). */
export const grow = (mask: Mask): Mask => bounded(moved(mask.box, -1, -1, 1, 1),
  (x, y) => mask(x, y) || mask(x - 1, y) || mask(x + 1, y) || mask(x, y - 1) || mask(x, y + 1));

/** A straight limb from `a` to `b`, `thickA` thick at `a` and `thickB` at `b`. */
export function limb(a: Point, b: Point, thickA: number, thickB: number): Mask {
  const [ax, ay] = a, [bx, by] = b;
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  const side = (x: number, y: number, half: number, s: number): Point => [x + nx * half * s, y + ny * half * s];
  return polygon([side(ax, ay, thickA / 2, 1), side(bx, by, thickB / 2, 1), side(bx, by, thickB / 2, -1),
    side(ax, ay, thickA / 2, -1)]);
}

/** A pointed stroke from `root` to `tip`, `width` wide at the root, bowed sideways by `bend`: a lock, a brow. */
export function taper(root: Point, tip: Point, width: number, bend = 0): Mask {
  const [rx, ry] = root, [tx, ty] = tip;
  const len = Math.hypot(tx - rx, ty - ry);
  const nx = -(ty - ry) / len, ny = (tx - rx) / len;
  const mx = (rx + tx) / 2 + nx * bend, my = (ry + ty) / 2 + ny * bend;
  const STEPS = 12;
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS, u = 1 - t;
    const cx = u * u * rx + 2 * u * t * mx + t * t * tx;
    const cy = u * u * ry + 2 * u * t * my + t * t * ty;
    const half = (width / 2) * (1 - t) ** 0.8;
    left.push([cx + nx * half, cy + ny * half]);
    right.push([cx - nx * half, cy - ny * half]);
  }
  return polygon([...left, ...right.reverse()]);
}

/** Pixels of `mask` within `depth` pixels of its right edge: the far side, with the light at the top left. */
export const farSide = (mask: Mask, depth: number): Mask =>
  bounded(mask.box, (x, y) => mask(x, y) && !mask(x + depth, y));

/** Pixels of `mask` within `depth` pixels of its bottom edge: the shaded underside of a shape. */
export const underside = (mask: Mask, depth: number): Mask =>
  bounded(mask.box, (x, y) => mask(x, y) && !mask(x, y + depth));
