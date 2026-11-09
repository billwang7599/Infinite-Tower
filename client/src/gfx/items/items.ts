/**
 * Item pictures for the bag screen, drawn in code with the same pixel kit as the characters (gfx/look/pixels.ts;
 * ART.md). Each is ITEM_PX square per bag cell it covers, lying flat (`ITEMS[id].cols` × `rows`); a turned item
 * is the same picture turned 90° on screen. Lit from the top left, like everything else.
 */
import { ITEMS, type ItemId } from "@infinite-tower/shared";
import { toPicture, type Picture } from "../look/art.js";
import type { Ramp } from "../look/palette.js";
import {
  BASE, DEEP, LIGHT, Pen, Pixels, SHADOW, SHINE, both, ellipse, minus, mirror, outline, polygon, rect, union,
  type Mask, type Point, type Tone,
} from "../look/pixels.js";

/** Pixels per bag cell. */
export const ITEM_PX = 16;

/** Item materials: greyed like the clothes (palette.ts), the meat the one rich color. */
export const ITEM_RAMPS = {
  meat: ["#2b0c10", "#4f151b", "#782129", "#a1343a", "#c25651", "#e48e80"],
  fat: ["#4a3a33", "#7d675a", "#b29b87", "#d6c3ad", "#ebdfcd", "#faf4ea"],
  bone: ["#3a3429", "#6c6352", "#9f947e", "#cbc2aa", "#e5dfca", "#faf7ec"],
  bristle: ["#0f0b09", "#211813", "#33261e", "#4a392c", "#65513e", "#8a765a"],
  ivory: ["#3a2f1c", "#6a5a39", "#9b875d", "#c9b789", "#e3d6b1", "#f8f1dc"],
  root: ["#24180f", "#3d2a1a", "#5a4029", "#73553a", "#8d6e4f", "#ad9171"],
  steel: ["#1c2026", "#363d47", "#5c6672", "#8a949f", "#b9c1c9", "#eef2f5"],
  brass: ["#2e2210", "#5a4320", "#86672f", "#ad8a45", "#d0b066", "#f2e2a4"],
  leather: ["#1d120c", "#331f15", "#4b2e1f", "#63402b", "#7d563a", "#9c7351"],
  oxblood: ["#1c0a0c", "#341215", "#4f1c1f", "#6a2a2b", "#86403c", "#a8625a"],
  parchment: ["#3d3427", "#6b5d46", "#9a8a6b", "#c4b591", "#ddd2b2", "#f3ecd6"],
  ember: ["#2a0d05", "#5c1f0a", "#9a3a12", "#d4651f", "#f29a45", "#ffd79a"],
  spark: ["#201a08", "#4a3c12", "#8a7020", "#c9a93a", "#ecd36f", "#fff4c2"],
  smoulder: ["#1f0606", "#470f0b", "#7a1d12", "#b0371c", "#da6a35", "#f7b27a"],
  wisp: ["#140a24", "#2e1a52", "#4f3283", "#7a58b5", "#a989dc", "#e2d4fb"],
  crust: ["#2e1a0c", "#5a3416", "#8a5523", "#b57a34", "#d69f57", "#f0cf92"],
  copper: ["#2a1208", "#542611", "#86401d", "#b4602e", "#d58a52", "#f2bb8a"],
  silver: ["#24272c", "#4a4f57", "#777e88", "#a5acb5", "#ccd2d9", "#f4f7fa"],
  gold: ["#2e2006", "#5e430c", "#967018", "#c99e2a", "#e8c654", "#fff1a8"],
  glass: ["#1d2428", "#3a464d", "#62737c", "#8fa2ab", "#bfd0d6", "#eef6f8"],
  cork: ["#24170d", "#3f2a18", "#5d4027", "#7a5837", "#987452", "#b99a78"],
  blood: ["#22060a", "#4a0d14", "#7a1520", "#a8222c", "#d04a4a", "#f08c80"],
  moss: ["#0d1f0c", "#1d3d18", "#2f6126", "#4a8a37", "#74b356", "#b4e08a"],
  greyfur: ["#18191c", "#2c2e33", "#45474e", "#62656c", "#858890", "#b0b3ba"],
  frost: ["#0f1a24", "#20364a", "#3a5a78", "#5f86a8", "#93b7d2", "#d8ecf8"],
  bog: ["#0b1009", "#182214", "#29391f", "#3c522d", "#587042", "#8a9f66"],
  murk: ["#10140a", "#262f16", "#434f24", "#677836", "#94a555", "#cfdc92"],
  stone: ["#18181b", "#2c2d31", "#46474c", "#64656b", "#8a8b91", "#b8b9bd"],
  pearl: ["#1d2820", "#3a4d40", "#617768", "#93a897", "#c6d6c8", "#f2f9f2"],
  canvas: ["#24211b", "#433d33", "#675e4f", "#8c8270", "#afa692", "#d3ccb8"],
} as const satisfies Record<string, Ramp>;

export type ItemMaterial = keyof typeof ITEM_RAMPS;
const ink = (material: ItemMaterial, tone: Tone) => [material, tone] as const;

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

function pelt(px: Pixels): void {
  const W = ITEM_PX * 2;
  const pen = new Pen(px, 0);
  const legs = mirror(union(
    bar([11, 11], [5, 6], 2), ellipse(4.6, 5.4, 2.2, 2),
    bar([11, 21], [5, 26], 2), ellipse(4.6, 26.4, 2.2, 2),
  ), W);
  const head = union(ellipse(16, 4.4, 3.6, 3.4), polygon([[12.5, 3], [13.5, 0], [15, 2.5]]),
    polygon([[19.5, 3], [18.5, 0], [17, 2.5]]));
  const fur = union(ellipse(16, 16, 8.6, 10.8), legs, head, bar([16, 26], [17.5, 31], 2.2));
  pen.fill(fur, ink("greyfur", BASE));
  pen.shade(litEdge(fur, 2), LIGHT);
  pen.shade(darkEdge(fur, 2), SHADOW);
  pen.shade(both(fur, speckle(3, 7, 9)), LIGHT);
  pen.shade(both(fur, speckle(5, 2, 11)), SHADOW);
  const back = both(fur, union(rect(14, 7, 17, 25), both(ellipse(16, 16, 3.4, 9), speckle(1, 1, 2))));
  pen.shade(back, DEEP);
  pen.fill(both(fur, minus(ellipse(16, 16, 8.6, 10.8), ellipse(16, 16, 7, 9.4))), ink("fat", LIGHT));
}

function fang(px: Pixels): void {
  const pen = new Pen(px, 0);
  const shape = horn([5.5, 14], [10.5, 2], -2.4, 3, 0.8);
  pen.fill(shape, ink("ivory", LIGHT));
  pen.shade((x, y) => shape(x, y) && !shape(x - 1, y), SHINE);
  pen.shade((x, y) => shape(x, y) && !shape(x + 1, y), SHADOW);
  pen.fill(both(shape, rect(0, 11, 15, 15)), ink("ivory", BASE));
  pen.shade(both(shape, rect(0, 13, 15, 15)), SHADOW);
}

function scale(px: Pixels): void {
  const pen = new Pen(px, 0);
  const plate = union(ellipse(8, 6.5, 5.6, 5), polygon([[2.6, 7], [13.4, 7], [8, 15]]));
  pen.fill(plate, ink("bog", BASE));
  pen.shade(litEdge(plate, 1), LIGHT);
  pen.shade(darkEdge(plate, 1), SHADOW);
  pen.shade(both(plate, bar([8, 2.5], [8, 12.5], 0.7)), DEEP);
  pen.shade(both(plate, union(bar([4.5, 4.5], [6.5, 9.5], 0.5), bar([11.5, 4.5], [9.5, 9.5], 0.5))), LIGHT);
  pen.shade(both(plate, ellipse(5.5, 4.5, 1.2, 0.9)), SHINE);
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

const blade = (half: number, gripRows: number, metalInk: ItemMaterial = "steel", hiltInk: ItemMaterial = "brass") =>
(px: Pixels): void => {
  const pommelY = px.height - 2.5, gripTo = px.height - 5, gripFrom = gripTo - gripRows + 1, edge = gripFrom - 4;
  const metal = new Pen(px, 0);
  const steel: Mask = (x, y) => y >= 1 && y <= edge && Math.abs(x + 0.5 - 8) <= Math.min(half, y / 2);
  metal.fill(steel, ink(metalInk, BASE));
  metal.shade(rect(9 - half, 1, 7, edge), LIGHT);
  metal.shade(both(steel, rect(9, 1, 7 + half, edge)), SHADOW);
  metal.shade(both(steel, rect(8, 8, 8, edge - 2)), DEEP);
  metal.shade(both(steel, rect(7, 4, 7, 12)), SHINE);

  const hilt = new Pen(px, 1);
  const guard = union(rect(1, edge, 14, edge + 3), rect(0, edge + 1, 15, edge + 2));
  hilt.fill(guard, ink(hiltInk, BASE));
  hilt.shade(rect(1, edge + 1, 14, edge + 1), LIGHT);
  hilt.shade(rect(1, edge + 2, 14, edge + 2), SHADOW);
  hilt.fill(rect(6, gripFrom, 9, gripTo), ink("leather", BASE));
  hilt.shade(both(rect(7, gripFrom + 1, 8, gripTo - 1), (_x, y) => y % 2 === 0), LIGHT);
  const pommel = ellipse(8, pommelY, 3, 2.6);
  hilt.fill(pommel, ink(hiltInk, BASE));
  hilt.shade(litEdge(pommel, 2), LIGHT);
  hilt.shade(darkEdge(pommel, 2), SHADOW);
};

const sword = blade(3, 7), woodenSword = blade(3, 7, "crust", "root"), longsword = blade(3, 10), greatsword = blade(4, 12);

// The string is on layer 2, left out of the outline.
function trainingBow(px: Pixels): void {
  const mid = px.height / 2, reach = mid - 2, tipX = 3.5, bellyX = 11;
  const centre = (y: number) => tipX + (bellyX - tipX) * (1 - ((y - mid) / reach) ** 2);
  const stave: Mask = (x, y) => Math.abs(y + 0.5 - mid) <= reach
    && Math.abs(x + 0.5 - centre(y + 0.5)) <= 1.2 + 0.8 * (1 - Math.abs(y + 0.5 - mid) / reach);
  const wood = new Pen(px, 0);
  wood.fill(stave, ink("crust", BASE));
  wood.shade((x, y) => stave(x, y) && !stave(x - 1, y), LIGHT);
  wood.shade((x, y) => stave(x, y) && !stave(x + 1, y), SHADOW);
  const grip = both(stave, rect(0, mid - 4, 15, mid + 3));
  wood.fill(grip, ink("leather", BASE));
  wood.shade(both(grip, (_x, y) => y % 2 === 0), SHADOW, "leather");
  new Pen(px, 2).fill(rect(Math.floor(tipX), 3, Math.floor(tipX), px.height - 4), ink("fat", LIGHT));
}

function arrow(px: Pixels): void {
  const tips: Point[] = [[4, 3.5], [8, 2.5], [12, 3.5]], nock: Point = [8, 14.5];
  const shafts = union(...tips.map((tip) => bar(nock, tip, 0.7)));
  const wood = new Pen(px, 0);
  wood.fill(shafts, ink("root", LIGHT));
  wood.shade((x, y) => shafts(x, y) && !shafts(x + 1, y), SHADOW);
  const head = new Pen(px, 1);
  const points = union(...tips.map(([x, y]) => polygon([[x - 1.5, y + 1.5], [x, y - 2.5], [x + 1.5, y + 1.5]])));
  head.fill(points, ink("steel", BASE));
  head.shade(litEdge(points, 1), LIGHT);
  const fletch = polygon([[5, 11], [11, 11], [10, 15], [6, 15]]);
  head.fill(fletch, ink("fat", BASE));
  head.shade(darkEdge(fletch, 1), SHADOW);
  head.fill(both(shafts, rect(0, 8, 15, 9)), ink("leather", BASE));
}

function quiver(px: Pixels): void {
  const tubeY = 9, tube = union(rect(4, tubeY + 1, 11, 29), ellipse(7.5, 29.5, 3.5, 1.5));
  const arrows = [5, 8, 10].map((x, i) => ({ x, top: 2 + (i % 2) }));
  const shafts = union(...arrows.map(({ x, top }) => rect(x, top + 2, x, tubeY)));
  const wood = new Pen(px, 0);
  wood.fill(shafts, ink("root", LIGHT));
  const fletch = union(...arrows.map(({ x, top }) => polygon([[x - 1, top], [x + 2, top], [x + 1.5, 7], [x - 0.5, 7]])));
  wood.fill(fletch, ink("fat", BASE));
  wood.shade(darkEdge(fletch, 1), SHADOW);
  const leather = new Pen(px, 1);
  leather.fill(tube, ink("leather", BASE));
  leather.shade(litEdge(tube, 2), LIGHT);
  leather.shade(darkEdge(tube, 2), SHADOW);
  leather.fill(rect(3, tubeY, 12, tubeY + 1), ink("leather", LIGHT));
  leather.shade(rect(3, tubeY + 1, 12, tubeY + 1), SHADOW);
  const band = rect(4, 20, 11, 21);
  leather.fill(band, ink("brass", BASE));
  leather.shade(rect(4, 20, 11, 20), LIGHT, "brass");
  leather.fill(bar([12.5, 12], [14, 27], 0.7), ink("leather", DEEP));
}

function skillbook(px: Pixels): void {
  const pages = new Pen(px, 0);
  const block = rect(6, 5, 28, 28);
  pages.fill(block, ink("parchment", BASE));
  pages.shade(both(block, (_x, y) => y % 2 === 1), SHADOW);

  const cover = new Pen(px, 1);
  const board = rect(3, 3, 26, 27);
  cover.fill(board, ink("oxblood", BASE));
  cover.shade(litEdge(board, 1), LIGHT);
  cover.shade(darkEdge(board, 1), SHADOW);
  cover.shade(rect(3, 3, 6, 27), DEEP);
  cover.shade(rect(4, 4, 4, 26), SHADOW);
  const corners = union(
    polygon([[19, 3], [27, 3], [27, 11]]), polygon([[19, 28], [27, 28], [27, 20]]),
  );
  cover.fill(both(board, corners), ink("brass", BASE));
  cover.shade(both(board, both(corners, rect(19, 3, 27, 4))), LIGHT, "brass");
  const ring = (x: number, y: number) => {
    const d = Math.hypot(x + 0.5 - 15.5, y + 0.5 - 15.5);
    return d >= 3.6 && d <= 5.1;
  };
  cover.fill(ring, ink("brass", BASE));
  cover.shade((x, y) => ring(x, y) && x + y < 30, LIGHT, "brass");
  cover.fill(ellipse(15.5, 15.5, 1.6, 1.6), ink("brass", SHINE));
  const clasp = rect(24, 13, 29, 17);
  cover.fill(clasp, ink("leather", BASE));
  cover.shade(rect(24, 13, 29, 13), LIGHT, "leather");
  cover.fill(rect(27, 14, 28, 16), ink("brass", BASE));
}

const essence = (material: ItemMaterial) => (px: Pixels): void => {
  const pen = new Pen(px, 0), bead = ellipse(8, 8.5, 5.2, 5.2);
  pen.fill(bead, ink(material, BASE));
  pen.shade(darkEdge(bead, 1), SHADOW);
  pen.fill(ellipse(7.3, 7.7, 3, 3), ink(material, LIGHT));
  pen.fill(ellipse(6.6, 7, 1.3, 1.3), ink(material, SHINE));
};

function bread(px: Pixels): void {
  const pen = new Pen(px, 0), loaf = ellipse(8, 9, 6.6, 5);
  pen.fill(loaf, ink("crust", BASE));
  pen.shade(litEdge(loaf, 2), LIGHT);
  pen.shade(darkEdge(loaf, 2), SHADOW);
  for (const x of [4.5, 8, 11.5]) pen.shade(both(loaf, bar([x - 1, 6.5], [x + 1, 10.5], 0.6)), DEEP);
  pen.shade(both(loaf, ellipse(6, 7, 1.6, 1)), SHINE);
}

const bottle = (liquid: ItemMaterial) => (px: Pixels): void => {
  const glass = new Pen(px, 0), body = union(ellipse(8, 10.5, 4.6, 4.4), rect(6, 3, 9, 7));
  glass.fill(body, ink("glass", LIGHT));
  const fill = both(ellipse(8, 10.5, 3.6, 3.4), (_x, y) => y >= 8);
  glass.fill(fill, ink(liquid, BASE));
  glass.shade(darkEdge(fill, 1), SHADOW, liquid);
  glass.fill(rect(9, 9, 9, 10), ink("glass", SHINE));
  const cork = new Pen(px, 1);
  cork.fill(rect(6, 1, 9, 3), ink("cork", BASE));
  cork.shade(rect(6, 1, 9, 1), LIGHT);
};

const coin = (metal: ItemMaterial) => (px: Pixels): void => {
  const pen = new Pen(px, 0), face = ellipse(8, 8.5, 5, 5);
  pen.fill(face, ink(metal, BASE));
  pen.shade(litEdge(face, 1), LIGHT);
  pen.shade(darkEdge(face, 1), SHADOW);
  const stamp = ellipse(8, 8.5, 2.6, 2.6);
  pen.shade(minus(stamp, ellipse(8, 8.5, 1.6, 1.6)), DEEP);
  pen.shade(ellipse(6, 6.4, 1, 1), SHINE);
};

function pearl(px: Pixels): void {
  const pen = new Pen(px, 0), bead = ellipse(8, 8.5, 4.4, 4.4);
  pen.fill(bead, ink("pearl", LIGHT));
  pen.shade(darkEdge(bead, 1), SHADOW);
  pen.shade(both(bead, ellipse(9.5, 10, 2.4, 2.4)), BASE);
  pen.fill(ellipse(6.6, 7, 1.4, 1.4), ink("pearl", SHINE));
}

const sigil = (glow: ItemMaterial) => (px: Pixels): void => {
  const stone = new Pen(px, 0), disc = ellipse(8, 8.5, 6.5, 6.5);
  stone.fill(disc, ink("stone", BASE));
  stone.shade(litEdge(disc, 1), LIGHT);
  stone.shade(darkEdge(disc, 1), SHADOW);
  const rune = new Pen(px, 1);
  const ring = (x: number, y: number) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8.5);
    return d >= 3.2 && d <= 4.3;
  };
  rune.fill(union(ring, rect(7, 3, 8, 13)), ink(glow, LIGHT));
  rune.fill(ellipse(8, 8.5, 1.2, 1.2), ink(glow, SHINE));
};

function backpack(px: Pixels): void {
  const sack = new Pen(px, 0);
  const body = union(rect(6, 10, 25, 28), ellipse(15.5, 10.5, 10, 5), ellipse(15.5, 27, 10, 2.5));
  sack.fill(body, ink("canvas", BASE));
  sack.shade(litEdge(body, 2), LIGHT);
  sack.shade(darkEdge(body, 2), SHADOW);
  sack.shade(both(body, speckle(3, 5, 11)), SHADOW);
  const pocket = rect(10, 20, 21, 26);
  sack.shade(pocket, LIGHT);
  sack.shade(rect(10, 26, 21, 26), SHADOW);
  sack.shade(rect(10, 20, 21, 20), DEEP);

  const flap = new Pen(px, 1);
  const cover = both(union(ellipse(15.5, 11, 10.5, 7), rect(5, 4, 26, 11)), ellipse(15.5, 10.5, 11, 7.5));
  flap.fill(cover, ink("canvas", BASE));
  flap.shade(litEdge(cover, 1), LIGHT);
  flap.shade(darkEdge(cover, 2), SHADOW);
  const loop = (x: number, y: number) => Math.abs(Math.hypot(x + 0.5 - 15.5, y + 0.5 - 4) - 2.2) < 0.8 && y < 4;
  flap.fill(loop, ink("leather", BASE));
  for (const x of [10, 20]) {
    const strap = rect(x, 9, x + 1, 25);
    flap.fill(strap, ink("leather", BASE));
    flap.shade(rect(x, 9, x, 25), LIGHT, "leather");
    flap.fill(minus(rect(x - 1, 15, x + 2, 18), rect(x, 16, x + 1, 17)), ink("brass", BASE));
    flap.shade(rect(x - 1, 15, x + 2, 15), LIGHT, "brass");
  }
}

function cap(px: Pixels): void {
  const pen = new Pen(px, 0);
  const dome = both(ellipse(16, 12, 10.5, 9.5), rect(0, 0, 31, 11));
  const rim = union(rect(5, 10, 26, 13), ellipse(5.5, 11.5, 1.5, 2), ellipse(26.5, 11.5, 1.5, 2));
  pen.fill(union(dome, rim), ink("greyfur", BASE));
  pen.shade(litEdge(dome, 2), LIGHT);
  pen.shade(darkEdge(dome, 1), SHADOW);
  pen.shade(both(dome, (x, y) => (x + y) % 4 === 0), SHADOW);
  pen.shade(both(rim, (x, _y) => x % 2 === 0), SHADOW);
  pen.shade(rect(5, 10, 26, 10), LIGHT);
  const bobble = new Pen(px, 1), ball = ellipse(16, 3, 2.6, 2.4);
  bobble.fill(ball, ink("fat", BASE));
  bobble.shade(darkEdge(ball, 1), SHADOW);
  bobble.shade(ellipse(15.2, 2.3, 0.9, 0.9), SHINE);
}

function belt(px: Pixels): void {
  const strap = new Pen(px, 0);
  const band = union(rect(5, 6, 28, 10), ellipse(28.5, 8, 2, 2.5));
  strap.fill(band, ink("leather", BASE));
  strap.shade(rect(5, 6, 30, 6), LIGHT);
  strap.shade(rect(5, 10, 30, 10), SHADOW);
  for (const x of [18, 21, 24]) strap.dot(x, 8, ink("leather", DEEP));
  const buckle = new Pen(px, 1), frame = minus(rect(2, 3, 9, 13), rect(4, 5, 7, 11));
  buckle.fill(frame, ink("steel", BASE));
  buckle.shade(litEdge(frame, 1), LIGHT);
  buckle.shade(darkEdge(frame, 1), SHADOW);
  buckle.fill(rect(5, 7, 9, 9), ink("steel", LIGHT));
}

const band = (inner: number, outer: number) => (x: number, y: number) => {
  const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8.5);
  return d >= inner && d <= outer;
};

function ring(px: Pixels): void {
  const pen = new Pen(px, 0), hoop = band(2.8, 5.8);
  pen.fill(hoop, ink("copper", BASE));
  pen.shade((x, y) => hoop(x, y) && x + y < 14, LIGHT);
  pen.shade((x, y) => hoop(x, y) && x + y > 19, SHADOW);
  pen.fill(ellipse(5.5, 5, 0.9, 0.9), ink("copper", SHINE));
}

function bracelet(px: Pixels): void {
  const pen = new Pen(px, 0), hoop = band(3, 6.8);
  pen.fill(hoop, ink("leather", BASE));
  pen.shade(both(hoop, (x, y) => (x + 2 * y) % 5 === 0), DEEP);
  pen.shade(both(hoop, (x, y) => (x + 2 * y) % 5 === 2), LIGHT);
  pen.shade((x, y) => hoop(x, y) && x + y > 21, SHADOW);
}

function featheredHat(px: Pixels): void {
  const felt = new Pen(px, 0);
  const crown = union(both(ellipse(14, 9, 7, 6.5), rect(0, 0, 31, 10)), rect(7, 9, 21, 11));
  const brim = ellipse(15, 12.5, 13.5, 2.2);
  felt.fill(union(crown, brim), ink("oxblood", BASE));
  felt.shade(litEdge(crown, 2), LIGHT);
  felt.shade(both(brim, rect(0, 13, 31, 15)), SHADOW);
  felt.shade(rect(7, 9, 21, 10), DEEP);
  const plume = new Pen(px, 1), feather = horn([19, 9], [30, 2.5], 2.6, 2.2, 0.7);
  plume.fill(feather, ink("fat", LIGHT));
  plume.shade((x, y) => feather(x, y) && !feather(x, y + 1), SHADOW);
  plume.shade(both(feather, speckle(2, 3, 4)), BASE);
}

function shield(px: Pixels): void {
  const wood = new Pen(px, 0), face = ellipse(16, 16, 14, 14);
  wood.fill(face, ink("root", BASE));
  wood.shade(both(face, (x, _y) => x % 6 === 0), DEEP);
  wood.shade(litEdge(face, 2), LIGHT);
  wood.shade(darkEdge(face, 2), SHADOW);
  const rim = new Pen(px, 1), hoop = minus(face, ellipse(16, 16, 12.5, 12.5));
  rim.fill(hoop, ink("steel", BASE));
  rim.shade(litEdge(hoop, 1), LIGHT);
  rim.shade(darkEdge(hoop, 1), SHADOW);
  const boss = ellipse(16, 16, 4, 4);
  rim.fill(boss, ink("steel", BASE));
  rim.shade(darkEdge(boss, 1), SHADOW);
  rim.fill(ellipse(14.8, 14.8, 1, 1), ink("steel", SHINE));
}

const DRAW: Record<ItemId, (px: Pixels) => void> = {
  "boar-meat": meat, "boar-hide": hide, "boar-tusk": tusk, "wooden-sword": woodenSword, sword, "kobold-blade": sword,
  longsword, greatsword, "kobold-greatsword": greatsword, skillbook, "boar-essence": essence("ember"),
  "kobold-swordsman-essence": essence("spark"), "kobold-greatsword-essence": essence("smoulder"),
  "kobold-shieldbearer-essence": essence("brass"),
  "goblin-warlock-essence": essence("wisp"), "grey-wolf-essence": essence("frost"),
  "bog-lurker-essence": essence("murk"), "lurker-scale": scale, "wolf-pelt": pelt,
  "wolf-fang": fang, bread, "health-potion": bottle("blood"),
  "stamina-tonic": bottle("moss"), "copper-coin": coin("copper"), "silver-coin": coin("silver"),
  "gold-coin": coin("gold"), "bog-pearl": pearl, "sigil-of-grit": sigil("moss"), "sigil-of-embers": sigil("frost"),
  "sigil-of-the-last-breath": sigil("wisp"), "sigil-of-the-red-blade": sigil("gold"),
  "sigil-of-the-first-door": sigil("blood"), "canvas-backpack": backpack, "wool-cap": cap, "leather-belt": belt,
  "copper-ring": ring, "braided-bracelet": bracelet, "feathered-hat": featheredHat, "training-bow": trainingBow,
  arrow, "training-quiver": quiver, "wooden-shield": shield,
};

const drawn = new Map<ItemId, Picture>();

/** The item's picture, lying flat. Drawn once, then kept. */
export function drawItem(id: ItemId): Picture {
  let pic = drawn.get(id);
  if (!pic) {
    const { cols, rows } = ITEMS[id];
    const px = new Pixels(cols * ITEM_PX, rows * ITEM_PX);
    DRAW[id](px);
    outline(px, new Set([0, 1]));
    pic = toPicture(px, ITEM_RAMPS);
    drawn.set(id, pic);
  }
  return pic;
}
