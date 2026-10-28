import type { EnemySprite } from "../index.js";

export const koboldSprite: EnemySprite = {
  sizeTiles: 1.6,
  draw(px) {
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
  },
};
