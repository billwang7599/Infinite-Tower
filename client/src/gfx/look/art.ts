/**
 * How a character is put together. Everything you can see on a character (the body, a hair style, an eye
 * type, a tunic) is an `Art`: for each view, a draw function per layer it shows up on. A picture is every
 * Art's draws, layer by layer, bottom to top, then outlined and colored. Every draw is handed the body's
 * `Frame` (its shapes and landmarks) and draws against it, so a piece of gear is drawn once per view and fits
 * every body type.
 */
import { Pen, Pixels, outline, type Ink, type Mask, type Point, type Tone } from "./pixels.js";
import type { Ramp } from "./palette.js";

/** The ways a character is drawn, and their size in pixels. */
export const VIEWS = {
  /** Head and shoulders, turned three-quarters to our left: dialogue and the creation screen. No background. */
  portrait: { width: 64, height: 64 },
  /** The small chibi in the world. */
  chibi: { width: 32, height: 32 },
} as const;
export type View = keyof typeof VIEWS;

/** Bottom to top. Wear goes between the body parts it covers. */
export const LAYERS = [
  "hairBack", "body", "legwear", "footwear", "torsowear", "arms", "armwear",
  "head", "face", "hair", "headwear",
] as const;
export type Layer = (typeof LAYERS)[number];

/** Hand-drawn details (eyes, brows, mouth) carry their own lines; everything else is outlined. */
const UNOUTLINED: ReadonlySet<Layer> = new Set(["face"]);

/**
 * A body type in one view (body.ts): the shapes gear covers, and where things are on it. Every body type has
 * the same names, so gear drawn against them fits all of them.
 */
export interface Frame {
  neck: Mask;
  torso: Mask;
  arms: Mask;
  /** Empty in the portrait, which stops at the chest. */
  legs: Mask;
  /** The breastbone's column: where a V-neck, a row of buttons or a clasp goes. */
  middle: number;
  /** The row the shoulders start at, in the middle. */
  collarY: number;
  /** The row under the chest muscles. */
  chestY: number;
  /** The armpit's row: above it the arm is one shape with the shoulder, below it the arm hangs apart. */
  armpitY: number;
  /** The belt's top row (below the picture, in the portrait). */
  waistY: number;
  /** The middle of each shoulder's top, left then right as we look at it. */
  shoulders: readonly [Point, Point];
}

export type Draw = (pen: Pen, frame: Frame) => void;
/** One Art in one view: what it draws on each layer. */
export type Piece = Partial<Record<Layer, Draw>>;
export type Art = Partial<Record<View, Piece>>;

/** The ramps the picked colors fill in; everything else comes from palette.ts's FIXED. */
export interface Colors {
  skin: Ramp;
  hair: Ramp;
  iris: Ramp;
  cloth: Ramp;
  accent: Ramp;
}

export interface Picture {
  width: number;
  height: number;
  /** RGBA, row by row. */
  rgba: Uint8ClampedArray;
}

/** Draw `arts` in `view` on the body `frame`, colored with `colors` (plus `fixed`, the shared materials). */
export function render(
  view: View, frame: Frame, arts: readonly Art[], colors: Colors, fixed: Readonly<Record<string, Ramp>>,
): Picture {
  const { width, height } = VIEWS[view];
  const px = new Pixels(width, height);
  LAYERS.forEach((layer, i) => {
    const pen = new Pen(px, i);
    for (const art of arts) art[view]?.[layer]?.(pen, frame);
  });
  outline(px, new Set(LAYERS.flatMap((layer, i) => (UNOUTLINED.has(layer) ? [] : [i]))));

  const ramps: Record<string, Ramp> = { ...fixed, ...colors };
  const rgba = new Uint8ClampedArray(width * height * 4);
  px.materials.forEach((material, i) => {
    if (material === null) return;
    const ramp = ramps[material];
    if (!ramp) throw new Error(`no colors for material "${material}"`);
    const hex = ramp[px.tones[i] as Tone];
    rgba.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], i * 4);
  });
  return { width, height, rgba };
}

/** Shorthand for inks: ink("hair", BASE). */
export const ink = (material: string, tone: Tone): Ink => [material, tone];
