/**
 * How a character is put together. Everything you can see on a character (the body, a hair style, an eye
 * type, a tunic) is an `Art`: for each view (and each way the chibi faces), a draw function per layer it shows up
 * on. A picture is every Art's draws, layer by layer, bottom to top, then outlined and colored. Every draw is
 * handed the body's `Frame` (its shapes and landmarks) and draws against it, so a piece of gear is drawn once per
 * view and fits every body type.
 */
import { Pen, Pixels, outline, type Ink, type Mask, type Point, type Tone } from "./pixels.js";
import type { Ramp } from "./palette.js";

/** The ways a character is drawn, and their size in pixels. */
export const VIEWS = {
  /** Head and shoulders, turned three-quarters to our left: dialogue and the creation screen. No background. */
  portrait: { width: 64, height: 64 },
  /** The small chibi in the world, drawn facing each way it walks (CHIBI_FACINGS). */
  chibi: { width: 32, height: 32 },
  /**
   * The arena, full body and sword in hand, seen from each of BATTLE_FACINGS. The figure is 48 wide in the middle,
   * leaving room each side for the sword.
   */
  battle: { width: 64, height: 64 },
} as const;
export type View = keyof typeof VIEWS;

/**
 * The ways the chibi faces: front (walking down the screen), back (walking up it) and side (to the left; walking
 * right is its mirror image).
 */
export const CHIBI_FACINGS = ["front", "back", "side"] as const;
export type ChibiFacing = (typeof CHIBI_FACINGS)[number];

export const BATTLE_FACINGS = ["back", "front"] as const;
export type BattleFacing = (typeof BATTLE_FACINGS)[number];

/** Bottom to top. Wear goes between the body parts it covers. */
const LAYERS = [
  "hairBack", "body", "legwear", "footwear", "torsowear", "weapon", "arms", "armwear",
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

/** The battle sprite's frame, in one of its poses (battle.ts): the whole body, and what the pose moves. */
export interface BattleFrame extends Frame {
  hands: Mask;
  feet: Mask;
  /** What boots cover: the shins and feet. */
  shins: Mask;
  /** How far the head has moved from where it sits standing (it hangs, when down). */
  head: Point;
  /** The sword: the middle of its grip (in the fist, unless it's been dropped), and its tip. */
  sword: readonly [grip: Point, tip: Point];
  /**
   * The layer the sword is on, if not "weapon": "hairBack" (the bottom) when it's beyond the body, in front of the
   * player, so the body hides it; "headwear" (the top) when it's nearer us than their head.
   */
  swordLayer?: Layer;
}

/** The frame each view's drawings are handed. */
export interface Frames {
  portrait: Frame;
  /**
   * Facing back it's the front's frame: from behind the body has the same outline. Facing side (left), `middle`
   * is the torso's middle column, and both `shoulders` are the near one.
   */
  chibi: Record<ChibiFacing, Frame>;
  battle: Record<BattleFacing, BattleFrame>;
}

export type Draw<F extends Frame = Frame> = (pen: Pen, frame: F) => void;
/** One Art in one view: what it draws on each layer. */
export type Piece<F extends Frame = Frame> = Partial<Record<Layer, Draw<F>>>;
export interface Art {
  portrait?: Piece;
  chibi?: Partial<Record<ChibiFacing, Piece>>;
  battle?: Partial<Record<BattleFacing, Piece<BattleFrame>>>;
}

export interface Picture {
  width: number;
  height: number;
  /** RGBA, row by row. */
  rgba: Uint8ClampedArray;
}

export interface Sketch<F extends Frame = Frame> {
  view: View;
  frame: F;
  parts: readonly (readonly [part: string, piece: Piece<F> | undefined])[];
  colors: Readonly<Record<string, Ramp>>;
}

export type AnySketch = Sketch | Sketch<BattleFrame>;

const OUTLINED = new Set(LAYERS.flatMap((layer, i) => (UNOUTLINED.has(layer) ? [] : [i])));

// A draw is numbered by its layer, then its part.
function paint({ view, frame, parts }: AnySketch, lastDraw = Infinity, only?: readonly string[]): Pixels {
  const { width, height } = VIEWS[view];
  const px = new Pixels(width, height);
  LAYERS.forEach((layer, i) => {
    const pen = new Pen(px, i);
    parts.forEach(([part, piece], j) => {
      const draw = only && !only.includes(part) ? undefined : piece?.[layer];
      px.painter = i * parts.length + j;
      if (draw && px.painter <= lastDraw) draw(pen, frame as BattleFrame); // a sketch's pieces take its own frame
    });
  });
  outline(px, OUTLINED);
  return px;
}

export const render = (sketch: AnySketch, only?: readonly string[]): Picture =>
  toPicture(paint(sketch, Infinity, only), sketch.colors);

// Stacked bottom to top, the cuts are the picture; each keeps what later cuts cover, as it was before them.
export function renderParts(
  sketch: AnySketch, only?: readonly string[],
): { part: string; layer: Layer; picture: Picture }[] {
  const { parts, colors } = sketch;
  const whole = paint(sketch, Infinity, only), wholePicture = toPicture(whole, colors);
  const cuts: { part: string; layer: Layer; draws: number[] }[] = [];
  LAYERS.forEach((layer, i) => parts.forEach(([part, piece], j) => {
    if (!piece?.[layer] || (only && !only.includes(part))) return;
    const last = cuts.at(-1);
    if (last?.part === part && last.layer === layer) last.draws.push(i * parts.length + j);
    else cuts.push({ part, layer, draws: [i * parts.length + j] });
  }));
  return cuts.map(({ part, layer, draws }) => {
    const before = paint(sketch, draws.at(-1), only), beforePicture = toPicture(before, colors);
    const rgba = new Uint8ClampedArray(wholePicture.rgba.length);
    for (let i = 0; i < whole.painters.length; i++) {
      const from = draws.includes(whole.painters[i]!) ? wholePicture
        : draws.includes(before.painters[i]!) ? beforePicture : null;
      if (from) rgba.set(from.rgba.subarray(i * 4, i * 4 + 4), i * 4);
    }
    return { part, layer, picture: { width: whole.width, height: whole.height, rgba } };
  });
}

/** Painted pixels in color: each one's material ramp at its tone. Unpainted ones stay see-through. */
export function toPicture(px: Pixels, ramps: Readonly<Record<string, Ramp>>): Picture {
  const rgba = new Uint8ClampedArray(px.width * px.height * 4);
  px.materials.forEach((material, i) => {
    if (material === null) return;
    const ramp = ramps[material];
    if (!ramp) throw new Error(`no colors for material "${material}"`);
    const hex = ramp[px.tones[i] as Tone];
    rgba.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], i * 4);
  });
  return { width: px.width, height: px.height, rgba };
}

/** Shorthand for inks: ink("hair", BASE). */
export const ink = (material: string, tone: Tone): Ink => [material, tone];
