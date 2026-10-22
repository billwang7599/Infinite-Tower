/** Character art: draw functions for 24x24 pixel sprite frames (see sprites.ts). Swap for real art later. */
import type { Px, SpriteDraw } from "./sprites.js";

const C = {
  boot: "#2a1d16", leg: "#3b4a6b", cloak: "#c0453a", cloakHi: "#d9584a", cloakLo: "#8e2f27",
  buckle: "#f2c14e", skin: "#f1c9a5", eye: "#1b1b2a", hoodTip: "#a8392f",
  blade: "#dfe6f0", bladeHi: "#ffffff", guard: "#c9a03a", grip: "#5a3a1e",
};

/** Hooded adventurer body, shared by the standing frames. ox shifts it horizontally. */
function drawBody(px: Px, ox: number): void {
  px(ox + 4, 22, 3, 2, C.boot); px(ox + 9, 22, 3, 2, C.boot);
  px(ox + 5, 18, 2, 4, C.leg); px(ox + 9, 18, 2, 4, C.leg);
  px(ox + 3, 10, 10, 9, C.cloak);
  px(ox + 4, 11, 8, 7, C.cloakHi);
  px(ox + 3, 17, 10, 1, C.cloakLo);
  px(ox + 7, 17, 2, 1, C.buckle);
  px(ox + 4, 3, 8, 8, C.cloakLo);
  px(ox + 6, 5, 6, 5, C.skin);
  px(ox + 9, 6, 2, 2, C.eye);
  px(ox + 5, 2, 5, 2, C.hoodTip);
}

export const drawPlayerIdle: SpriteDraw = (px) => {
  drawBody(px, 4);
  px(16, 12, 2, 4, C.skin);           // hand
  px(18, 3, 1, 9, C.blade);           // blade, held upright
  px(19, 4, 1, 7, C.bladeHi);
  px(17, 12, 3, 1, C.guard);
  px(18, 13, 1, 2, C.grip);
};

export const drawPlayerSlash: SpriteDraw = (px) => {
  drawBody(px, 3);
  px(15, 11, 3, 2, C.skin);           // arm thrust forward
  px(18, 10, 1, 3, C.guard);
  px(19, 11, 5, 1, C.blade);          // blade, extended
  px(19, 12, 5, 1, C.bladeHi);
};

export const drawPlayerDown: SpriteDraw = (px) => {
  px(19, 20, 2, 3, C.boot);
  px(14, 21, 5, 2, C.leg);
  px(6, 19, 9, 4, C.cloak);
  px(7, 20, 7, 2, C.cloakHi);
  px(2, 19, 5, 4, C.cloakLo);
  px(3, 20, 3, 2, C.skin);
  px(4, 23, 14, 1, C.blade);          // dropped sword
};

/** Wild boar, side view (overworld). */
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
