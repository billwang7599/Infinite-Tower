/**
 * What's in the title's scene, as polygons: a floor of hexagonal tiles, each tipped a little so the light picks
 * them out; the tower, a stack of frosted glass storeys with pale floors and gold edges, going up forever (only
 * the storeys near the eye are built), standing still; its shadow, cast by the moon; a few crystals floating
 * round it; and, for the rush, streaks of light in the tower's shaft. The floor is dark stone; the tower and
 * crystals are white and gold, and glow.
 */
import { seededRandom } from "@infinite-tower/shared";
import { linear, SUN_DIR, type Material } from "./light.js";
import { centerOf, normalOf, normalize, type Vec3 } from "./space.js";

export interface Face {
  points: readonly Vec3[];
  material: Material;
  normal: Vec3;
  center: Vec3;
  /** Flat on the ground, drawn in this order before everything standing, whatever their depth. */
  layer?: "under" | "floor";
}

/** The tower: hexagon radius (centre to corner), storey height, the hole up its middle, all in units. */
export const TOWER = { radius: 1.15, storey: 1, hole: 0.62, slab: 0.07 };
/** How far the floors' ledges stick out past the glass, against the radius. */
const LEDGE = 1.06;

const GLASS: Material = {
  color: linear("#dce7f6"), alpha: 0.2, shine: 1.6, gloss: 40, glow: 0.25, edge: "#ffffffb3",
};
const SLAB: Material = { color: linear("#f4f1ea"), alpha: 1, shine: 0.25, gloss: 12, glow: 0.45 };
/** A floor's underside: the sun never reaches it, so it has light of its own, as if through the glass. */
const CEILING: Material = { color: linear("#e3e9f3"), alpha: 1, shine: 0.1, gloss: 8, glow: 0.6 };
const GOLD: Material = { color: linear("#c98f24"), alpha: 1, shine: 1.4, gloss: 18, glow: 0.35, bloom: true };
/** Dark stone tiles, a few shades of them so the floor isn't one sheet, with a wet glint. */
const TILES: readonly Material[] = ["#5a5c63", "#51535a", "#62646b", "#4a4c53"].map((hex) =>
  ({ color: linear(hex), alpha: 1, shine: 0.7, gloss: 40, glow: 0 }));
const GROUT: Material = { color: linear("#020203"), alpha: 1, shine: 0, gloss: 1, glow: 0 };
const CRYSTAL: Material = { color: linear("#e2b04a"), alpha: 0.92, shine: 2.2, gloss: 60, glow: 0.3 };

const face = (points: readonly Vec3[], material: Material, layer?: Face["layer"]): Face =>
  ({ points, material, normal: normalOf(points), center: centerOf(points), layer });

const hexagon = (cx: number, cz: number, radius: number, turn: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = turn + (i * Math.PI) / 3;
    return [cx + radius * Math.cos(a), cz + radius * Math.sin(a)] as const;
  });

/** The floor, built once: tiles over a patch in front of the title's camera, and the grout under them. */
export function buildFloor(): Face[] {
  const rand = seededRandom(11);
  const size = 0.95;
  const faces = [face([[-60, -0.03, -30], [60, -0.03, -30], [60, -0.03, 90], [-60, -0.03, 90]], GROUT, "under")];
  for (let col = -16; col <= 16; col++) {
    for (let row = -5; row <= 16; row++) {
      const x = col * size * 1.5;
      const z = (row + (col % 2 === 0 ? 0 : 0.5)) * size * Math.sqrt(3);
      const [tx, tz] = [(rand() - 0.5) * 0.22, (rand() - 0.5) * 0.22];
      const lift = 0.02 + rand() * 0.04;
      const points = hexagon(x, z, size * 0.92, 0).map(([px, pz]): Vec3 =>
        [px, lift + (px - x) * tx + (pz - z) * tz, pz]);
      faces.push(face(points, TILES[Math.floor(rand() * TILES.length)]!, "floor"));
    }
  }
  return faces;
}

/** The storeys from `fromY` to `toY`. A flat side faces the title's camera. */
export function buildTower(fromY: number, toY: number): Face[] {
  const { radius, storey, hole, slab } = TOWER;
  const faces: Face[] = [];
  const outer = hexagon(0, 0, radius, 0);
  const ledge = hexagon(0, 0, radius * LEDGE, 0);
  const inner = hexagon(0, 0, hole, 0);
  const first = Math.max(0, Math.floor(fromY / storey));
  for (let k = first; k * storey <= toY; k++) {
    const [y0, y1] = [k * storey, (k + 1) * storey];
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const [a, b, la, lb, ia, ib] = [outer[i]!, outer[j]!, ledge[i]!, ledge[j]!, inner[i]!, inner[j]!];
      faces.push(face([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1 - slab, b[1]], [a[0], y1 - slab, a[1]]], GLASS));
      // The floor above this storey: its underside, the gold edge round its hole, and its outer ledge.
      faces.push(face([[la[0], y1 - slab, la[1]], [lb[0], y1 - slab, lb[1]],
        [ib[0], y1 - slab, ib[1]], [ia[0], y1 - slab, ia[1]]], CEILING));
      faces.push(face([[la[0], y1, la[1]], [lb[0], y1, lb[1]], [ib[0], y1, ib[1]], [ia[0], y1, ia[1]]], SLAB));
      faces.push(face([[ia[0], y1 - slab, ia[1]], [ib[0], y1 - slab, ib[1]], [ib[0], y1, ib[1]], [ia[0], y1, ia[1]]],
        GOLD));
      faces.push(face([[la[0], y1 - slab, la[1]], [lb[0], y1 - slab, lb[1]], [lb[0], y1, lb[1]], [la[0], y1, la[1]]],
        GOLD));
    }
  }
  return faces;
}

/** Just over the tiles, which stand 0.02 to 0.06 proud of the ground. */
const SHADOW_Y = 0.05;

/** The tower's footprint (its ledges), which its shadow leaves out: its own light fills it. */
export const FOOTPRINT: readonly Vec3[] = hexagon(0, 0, TOWER.radius * LEDGE, 0)
  .map(([x, z]): Vec3 => [x, SHADOW_Y, z]);

/**
 * The ground the tower's shadow covers out to `length` units from its middle (FOOTPRINT included): the footprint
 * swept along the ground away from the moon. The tower never ends, so neither would its shadow; it's cut at `length`.
 */
export function towerShadow(length: number): Vec3[] {
  const away = normalize([-SUN_DIR[0], 0, -SUN_DIR[2]]);
  const swept = FOOTPRINT.flatMap(([x, , z]): Point[] => [[x, z], [x + away[0] * length, z + away[2] * length]]);
  return hull(swept).map(([x, z]): Vec3 => [x, SHADOW_Y, z]);
}

type Point = readonly [number, number];

/** The convex hull of points on the ground, in order round it (Andrew's monotone chain). */
function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turnsLeft = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]) > 0;
  const half = (list: readonly Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && !turnsLeft(out[out.length - 2]!, out[out.length - 1]!, p)) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

const CRYSTALS = [
  { at: [-2.6, 2.2, 1.2], size: 0.32, speed: 0.5 }, { at: [2.4, 3.4, -0.6], size: 0.24, speed: -0.7 },
  { at: [-1.7, 4.6, -1.4], size: 0.18, speed: 0.9 }, { at: [3.3, 1.5, 2.6], size: 0.28, speed: 0.4 },
  { at: [1.2, 5.6, 1.8], size: 0.2, speed: -0.6 },
] as const;

/** Octahedra floating round the tower, turning and bobbing, at `seconds`. */
export function buildCrystals(seconds: number): Face[] {
  return CRYSTALS.flatMap(({ at, size, speed }, n) => {
    const spin = seconds * speed + n;
    const y = at[1] + Math.sin(seconds * 0.8 + n * 2) * 0.12;
    const ring = Array.from({ length: 4 }, (_, i): Vec3 => {
      const a = spin + (i * Math.PI) / 2;
      return [at[0] + size * Math.cos(a), y, at[2] + size * Math.sin(a)];
    });
    const top: Vec3 = [at[0], y + size * 1.7, at[2]];
    const bottom: Vec3 = [at[0], y - size * 1.7, at[2]];
    return ring.flatMap((p, i) => {
      const q = ring[(i + 1) % 4]!;
      return [face([p, q, top], CRYSTAL), face([q, p, bottom], CRYSTAL)];
    });
  });
}

/** Streaks of light hanging in the tower's shaft: a point and a length each, repeating every STREAK_SPAN up. */
export const STREAK_SPAN = 14;
export const STREAKS: readonly { at: Vec3; length: number }[] = (() => {
  const rand = seededRandom(23);
  return Array.from({ length: 70 }, () => {
    const [a, r] = [rand() * Math.PI * 2, TOWER.hole * (0.25 + 0.7 * Math.sqrt(rand()))];
    return { at: [r * Math.cos(a), rand() * STREAK_SPAN, r * Math.sin(a)] as Vec3, length: 0.4 + rand() * 0.8 };
  });
})();
