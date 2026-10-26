/**
 * Item pictures for the bag screen, drawn in code with the same pixel kit as the characters (gfx/look/pixels.ts;
 * ART.md). Each is ITEM_PX square per bag cell it covers, lying flat (`ITEMS[id].cols` × `rows`); a turned item
 * is the same picture turned 90° on screen. Lit from the top left, like everything else.
 */
import { ITEMS, type ItemId } from "@infinite-tower/shared";
import { toPicture, type Picture } from "../look/art.js";
import type { Ramp } from "../look/palette.js";
import {
  BASE, DEEP, LIGHT, Pen, Pixels, SHADOW, SHINE, both, ellipse, minus, mirror, outline, rect, union,
  type Mask, type Point, type Tone,
} from "../look/pixels.js";

/** Pixels per bag cell. */
export const ITEM_PX = 16;

/** Item materials: greyed like the clothes (palette.ts), the meat the one rich color. */
const RAMPS = {
  meat: ["#2b0c10", "#4f151b", "#782129", "#a1343a", "#c25651", "#e48e80"],
  fat: ["#4a3a33", "#7d675a", "#b29b87", "#d6c3ad", "#ebdfcd", "#faf4ea"],
  bone: ["#3a3429", "#6c6352", "#9f947e", "#cbc2aa", "#e5dfca", "#faf7ec"],
  bristle: ["#0f0b09", "#211813", "#33261e", "#4a392c", "#65513e", "#8a765a"],
  ivory: ["#3a2f1c", "#6a5a39", "#9b875d", "#c9b789", "#e3d6b1", "#f8f1dc"],
  root: ["#24180f", "#3d2a1a", "#5a4029", "#73553a", "#8d6e4f", "#ad9171"],
} as const satisfies Record<string, Ramp>;

type Material = keyof typeof RAMPS;
const ink = (material: Material, tone: Tone) => [material, tone] as const;

/** A round-ended stroke from `a` to `b`, `r` from its middle line: a bone, a leg. */
function bar(a: Point, b: Point, r: number): Mask {
  const [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  return (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= r;
  };
}

/**
 * A horn-like shape along a curve from `root` to `tip`, bowed sideways by `bend` (as `taper`), `r` from its middle
 * line at the root and `tipR` at the tip: thick enough all the way up to keep some color inside its outline.
 */
function horn(root: Point, tip: Point, bend: number, r: number, tipR: number): Mask {
  const [rx, ry] = root, [tx, ty] = tip;
  const len = Math.hypot(tx - rx, ty - ry);
  const mx = (rx + tx) / 2 - ((ty - ry) / len) * bend, my = (ry + ty) / 2 + ((tx - rx) / len) * bend;
  const STEPS = 48;
  const discs = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS, u = 1 - t;
    return {
      x: u * u * rx + 2 * u * t * mx + t * t * tx, y: u * u * ry + 2 * u * t * my + t * t * ty,
      r: tipR + (r - tipR) * (1 - t) ** 0.7,
    };
  });
  return (x, y) => discs.some((d) => Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) <= d.r);
}

/** Within `depth` pixels of the shape's top-left edge, where the light catches it. */
const litEdge = (mask: Mask, depth: number): Mask => (x, y) => mask(x, y) && !mask(x - depth, y - depth);
/** Within `depth` pixels of its bottom-right edge, turned from the light. */
const darkEdge = (mask: Mask, depth: number): Mask => (x, y) => mask(x, y) && !mask(x + depth, y + depth);
/** A scatter of single pixels, the same every time: bristles, grain. */
const speckle = (a: number, b: number, mod: number): Mask => (x, y) => (x * a + y * b) % mod === 0;

/** A chunk of raw boar on the bone. */
function meat(px: Pixels): void {
  const bone = new Pen(px, 0);
  const knob = union(ellipse(2.6, 12.4, 1.7, 1.7), ellipse(4.4, 14.2, 1.7, 1.7));
  const shaft = bar([8, 9.5], [3.6, 13.4], 1.6);
  const bones = union(shaft, knob);
  bone.fill(bones, ink("bone", BASE));
  bone.shade(darkEdge(bones, 1), SHADOW);
  bone.shade(both(knob, ellipse(2.4, 12.1, 0.9, 0.9)), LIGHT);

  const flesh = new Pen(px, 1);
  const chunk = union(ellipse(9.9, 7.1, 5.8, 5.3), ellipse(7.4, 9.2, 3.4, 3.1));
  flesh.fill(chunk, ink("meat", BASE));
  // Marbling: two arcs of fat across the grain.
  const arc = (cx: number, cy: number, r: number): Mask =>
    (x, y) => Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r) < 0.6;
  flesh.fill(both(chunk, union(arc(16, 13.5, 7.2), both(arc(16.5, 14, 4.2), rect(0, 0, 15, 10)))), ink("fat", BASE));
  flesh.shade(litEdge(chunk, 2), LIGHT);
  flesh.shade(darkEdge(chunk, 2), SHADOW);
  flesh.shade(both(chunk, ellipse(8.4, 4.6, 1.5, 0.9)), SHINE, "meat");
}

/** A boar's pelt, stretched flat: bristly, with the legs splayed and a dark stripe down the spine. */
function hide(px: Pixels): void {
  const W = ITEM_PX * 2;
  const pen = new Pen(px, 0);
  const legs = mirror(union(
    bar([10, 11], [4.5, 5.5], 2.4), ellipse(4.2, 5, 2.6, 2.2),
    bar([10, 22], [4.5, 27], 2.4), ellipse(4.2, 27.6, 2.6, 2.2),
  ), W);
  const pelt0 = union(ellipse(16, 16.5, 9.6, 11.6), legs, ellipse(16, 4.6, 3.4, 3.2), bar([16, 26], [16, 30.5], 1.3));
  // A ragged edge: every few rim pixels nipped off.
  const rim: Mask = (x, y) =>
    pelt0(x, y) && !(pelt0(x - 1, y) && pelt0(x + 1, y) && pelt0(x, y - 1) && pelt0(x, y + 1));
  const pelt = minus(pelt0, both(rim, speckle(7, 3, 5)));

  pen.fill(pelt, ink("bristle", BASE));
  pen.shade(litEdge(pelt, 2), LIGHT);
  pen.shade(darkEdge(pelt, 2), SHADOW);
  pen.shade(both(pelt, speckle(5, 3, 7)), SHADOW);
  pen.shade(both(pelt, speckle(3, 11, 13)), LIGHT);
  const spine = both(pelt, union(rect(15, 6, 16, 26), both(ellipse(16, 16, 2.4, 9), speckle(1, 1, 2))));
  pen.shade(spine, DEEP);
  pen.shade(both(spine, speckle(2, 5, 9)), SHADOW);
}

/** A tusk, curved like a new moon, its root stained dark. */
function tusk(px: Pixels): void {
  const pen = new Pen(px, 0);
  const shape = horn([7, 29.5], [10.6, 2.4], -4.4, 3.9, 1.1);
  pen.fill(shape, ink("ivory", BASE));
  pen.shade((x, y) => shape(x, y) && !shape(x - 2, y), LIGHT);
  pen.shade(both(horn([5.4, 27], [9.6, 5], -4.4, 0.6, 0.4), shape), SHINE);
  pen.shade((x, y) => shape(x, y) && !shape(x + 2, y), SHADOW);
  // Growth lines toward the root, then the root itself.
  pen.shade(both(shape, union(rect(0, 21, 15, 21), rect(0, 24, 15, 24))), SHADOW);
  pen.fill(both(shape, rect(0, 27, 15, 31)), ink("root", BASE));
  pen.shade(both(shape, rect(0, 29, 15, 31)), SHADOW, "root");
}

const DRAW: Record<ItemId, (px: Pixels) => void> = { "boar-meat": meat, "boar-hide": hide, "boar-tusk": tusk };

const drawn = new Map<ItemId, Picture>();

/** The item's picture, lying flat. Drawn once, then kept. */
export function drawItem(id: ItemId): Picture {
  let pic = drawn.get(id);
  if (!pic) {
    const { cols, rows } = ITEMS[id];
    const px = new Pixels(cols * ITEM_PX, rows * ITEM_PX);
    DRAW[id](px);
    outline(px, new Set([0, 1]));
    pic = toPicture(px, RAMPS);
    drawn.set(id, pic);
  }
  return pic;
}
