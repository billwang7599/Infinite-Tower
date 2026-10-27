/**
 * Frames for the 24x24 pixel sprites (sprites.ts). The player is drawn from their look (gfx/look/): the chibi in
 * the overworld (facing front, back and side), the battle sprite (from behind, sword in hand) in the arena. The boar
 * and the "!" bubble are drawn here.
 */
import type { Look } from "@infinite-tower/shared";
import { VIEWS, type Picture } from "./look/art.js";
import type { Pose } from "./look/battle.js";
import { drawBattle, drawChibi, type ChibiFacing } from "./look/look.js";
import { SPRITE_PX, type Px, type SpriteDraw } from "./sprites.js";

export interface PlayerFrames {
  /** The overworld: the chibi facing each way. The side faces right, like every side view here (sprites.ts). */
  chibi: Record<ChibiFacing, SpriteDraw>;
  /** The arena, in each pose: standing (and running), mid-swing, and down. */
  battle: Record<Pose, SpriteDraw>;
}

/** The player's frames in `look`. Each picture fills the sprite: 32 chibi or 64 battle pixels across its 24. */
export function playerFrames(look: Look): PlayerFrames {
  const chibi = (facing: ChibiFacing): SpriteDraw => {
    const pic = drawChibi(look, facing);
    return (px) => paint(px, pic, SPRITE_PX / VIEWS.chibi.width, facing === "side");
  };
  const battle = (pose: Pose): SpriteDraw => {
    const pic = drawBattle(look, pose);
    return (px) => paint(px, pic, SPRITE_PX / VIEWS.battle.width);
  };
  return {
    chibi: { front: chibi("front"), back: chibi("back"), side: chibi("side") },
    battle: { stand: battle("stand"), slash: battle("slash"), down: battle("down") },
  };
}

/** `pic`, each of its pixels `scale` sprite pixels square; `mirrored` flips it left to right. */
function paint(px: Px, pic: Picture, scale: number, mirrored = false): void {
  for (let y = 0; y < pic.height; y++) {
    for (let x = 0; x < pic.width; x++) {
      const i = (y * pic.width + x) * 4;
      if (!pic.rgba[i + 3]) continue;
      const color = `#${[0, 1, 2].map((c) => pic.rgba[i + c]!.toString(16).padStart(2, "0")).join("")}`;
      px((mirrored ? pic.width - 1 - x : x) * scale, y * scale, scale, scale, color);
    }
  }
}

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

/** Kobold swordsman, side view (overworld): a dog-headed little fighter, its sword held up in front. */
export const drawKobold: SpriteDraw = (px) => {
  const fur = "#8a6a4a", furHi = "#a5825e", dark = "#4a3626", cloth = "#6e2f2a", steel = "#d6dde3";
  px(19, 2, 1, 12, steel);             // blade, held up
  px(17, 13, 5, 1, "#b8913a");         // guard
  px(18, 14, 2, 2, dark);              // grip + fist
  px(9, 4, 2, 3, dark);                // ear
  px(8, 6, 7, 6, fur);                 // head
  px(9, 7, 4, 2, furHi);
  px(14, 8, 4, 3, fur);                // snout
  px(17, 8, 1, 1, "#140c08");          // nose
  px(12, 7, 1, 1, "#f2c84a");          // eye
  px(8, 12, 8, 7, cloth);              // tunic
  px(8, 17, 8, 1, dark);               // belt
  px(14, 13, 4, 2, fur);               // sword arm
  px(5, 15, 3, 1, fur); px(4, 14, 1, 1, fur);  // tail
  px(9, 19, 2, 4, dark); px(13, 19, 2, 4, dark); // legs
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
