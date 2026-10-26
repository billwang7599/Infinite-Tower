/**
 * Frames for the 24x24 pixel sprites (sprites.ts). The player is its look's chibi (gfx/look/), with a sword in the
 * arena; the boar and the "!" bubble are drawn here.
 */
import type { Look } from "@infinite-tower/shared";
import { VIEWS, type Picture } from "./look/art.js";
import { drawLook } from "./look/look.js";
import { SPRITE_PX, type Px, type SpriteDraw } from "./sprites.js";

export interface PlayerFrames {
  /** The field: the chibi alone, centred. */
  field: SpriteDraw;
  /** The arena: sword held upright, swung out, dropped. */
  idle: SpriteDraw;
  slash: SpriteDraw;
  down: SpriteDraw;
}

/** The chibi's 32 pixels across fill the sprite's 24, so each of its pixels is 3/4 of a sprite pixel. */
const CHIBI = VIEWS.chibi.width;
const SCALE = SPRITE_PX / CHIBI;

const SWORD = { blade: "#dfe6f0", shine: "#ffffff", guard: "#c9a03a", grip: "#5a3a1e" };

/** The player's frames in `look`. Sword coordinates are chibi pixels, after the chibi's shift. */
export function playerFrames(look: Look): PlayerFrames {
  const chibi = drawLook(look, "chibi");
  // Picked off the chibi: the middle of its face, and its sleeve.
  const skin = colorAt(chibi, 16, 15), sleeve = colorAt(chibi, 11, 22);
  return {
    field: (px) => paintChibi(px, chibi, 0),
    idle: (px) => {
      paintChibi(px, chibi, -4);
      rects(px, [[21, 9, 1, 13, SWORD.blade], [22, 10, 1, 12, SWORD.shine], [19, 22, 6, 1, SWORD.guard]]);
      rects(px, [[21, 23, 2, 3, SWORD.grip], [18, 24, 4, 2, skin]]);
    },
    slash: (px) => {
      paintChibi(px, chibi, -5);
      rects(px, [[16, 21, 4, 2, sleeve], [20, 21, 2, 2, skin], [22, 19, 1, 6, SWORD.guard]]);
      rects(px, [[23, 21, 9, 1, SWORD.blade], [23, 22, 9, 1, SWORD.shine]]);
    },
    down: (px) => {
      paintLying(px, chibi);
      rects(px, [[4, 30, 22, 1, SWORD.blade], [26, 29, 1, 3, SWORD.guard], [27, 30, 3, 1, SWORD.grip]]);
    },
  };
}

type Rect = [x: number, y: number, w: number, h: number, color: string];

function rects(px: Px, list: readonly Rect[]): void {
  for (const [x, y, w, h, color] of list) px(x * SCALE, y * SCALE, w * SCALE, h * SCALE, color);
}

/** The chibi standing, moved `dx` of its pixels sideways. */
function paintChibi(px: Px, pic: Picture, dx: number): void {
  eachPixel(pic, (x, y, color) => px((x + dx) * SCALE, y * SCALE, SCALE, SCALE, color));
}

/** The chibi on its back: turned a quarter, head to the left, lying along the bottom. */
function paintLying(px: Px, pic: Picture): void {
  eachPixel(pic, (x, y, color) => px(y * SCALE, (x + 6) * SCALE, SCALE, SCALE, color));
}

function eachPixel(pic: Picture, visit: (x: number, y: number, color: string) => void): void {
  for (let y = 0; y < pic.height; y++) {
    for (let x = 0; x < pic.width; x++) {
      const i = (y * pic.width + x) * 4;
      if (pic.rgba[i + 3]) visit(x, y, colorAt(pic, x, y));
    }
  }
}

function colorAt(pic: Picture, x: number, y: number): string {
  const i = (y * pic.width + x) * 4;
  return `#${[0, 1, 2].map((c) => pic.rgba[i + c]!.toString(16).padStart(2, "0")).join("")}`;
}

/** Wild boar, side view (field). */
export const drawBoar: SpriteDraw = (px) => {
  const hide = "#6b4632", hideHi = "#835a40", dark = "#3a281d", snout = "#b77a6a", tusk = "#efe6cf";
  px(3, 10, 1, 3, dark);               // tail
  px(4, 9, 13, 9, hide);               // body
  px(5, 10, 11, 3, hideHi);
  px(5, 8, 11, 2, dark);               // bristly mane
  px(7, 7, 2, 1, dark); px(11, 7, 2, 1, dark);
  px(16, 10, 5, 7, hide);              // head
  px(16, 8, 2, 3, dark);               // ear
  px(19, 11, 1, 1, "#140c08");         // eye
  px(21, 13, 2, 3, snout);             // snout
  px(22, 14, 1, 1, "#5a2e26");         // nostril
  px(20, 16, 1, 1, tusk); px(21, 15, 1, 1, tusk);
  px(5, 18, 2, 3, dark); px(8, 18, 2, 3, dark);     // legs
  px(13, 18, 2, 3, dark); px(16, 17, 2, 4, dark);
};

/** "!" speech bubble shown when a boar notices you. */
export const drawAlert: SpriteDraw = (px) => {
  px(6, 2, 12, 16, "#1b1b2a");
  px(7, 3, 10, 14, "#ffffff");
  px(10, 5, 4, 7, "#d23a2c");
  px(10, 13, 4, 2, "#d23a2c");
  px(10, 18, 4, 2, "#1b1b2a");         // bubble tail
  px(11, 17, 2, 2, "#ffffff");
};
