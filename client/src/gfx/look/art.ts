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
   * The arena, full body and sword in hand, from behind: the arena camera always sits behind the player, who
   * faces where they attack. The figure is 48 wide in the middle, leaving room each side for the sword.
   */
  battle: { width: 64, height: 64 },
} as const;
export type View = keyof typeof VIEWS;

/**
 * The ways the chibi faces: front (toward us, walking down the screen), back (walking up it) and side (to the
 * left; walking right is its mirror image).
 */
export const CHIBI_FACINGS = ["front", "back", "side"] as const;
export type ChibiFacing = (typeof CHIBI_FACINGS)[number];

/** Bottom to top. Wear goes between the body parts it covers. */
export const LAYERS = [
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
  battle: BattleFrame;
}

export type Draw<F extends Frame = Frame> = (pen: Pen, frame: F) => void;
/** One Art in one view: what it draws on each layer. */
export type Piece<F extends Frame = Frame> = Partial<Record<Layer, Draw<F>>>;
export interface Art {
  portrait?: Piece;
  chibi?: Partial<Record<ChibiFacing, Piece>>;
  battle?: Piece<BattleFrame>;
}

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

/**
 * Draw `pieces` (each Art's piece for this picture, in the Arts' order) at `view`'s size on the body `frame`,
 * colored with `colors` (plus `fixed`, the shared materials).
 */
export function render<F extends Frame>(
  view: View, frame: F, pieces: readonly (Piece<F> | undefined)[], colors: Colors,
  fixed: Readonly<Record<string, Ramp>>,
): Picture {
  const { width, height } = VIEWS[view];
  const px = new Pixels(width, height);
  LAYERS.forEach((layer, i) => {
    const pen = new Pen(px, i);
    for (const piece of pieces) piece?.[layer]?.(pen, frame);
  });
  outline(px, new Set(LAYERS.flatMap((layer, i) => (UNOUTLINED.has(layer) ? [] : [i]))));
  return toPicture(px, { ...fixed, ...colors });
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
