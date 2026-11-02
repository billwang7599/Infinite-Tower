import type { EnemySprite } from "../index.js";

export const wolfSprite: EnemySprite = {
  sizeTiles: 1.7,
  draw(px) {
    const fur = "#7a7d84", furHi = "#9a9da4", dark = "#45474e", pale = "#b8b3a8";
    px(1, 9, 2, 2, dark); px(2, 10, 3, 2, dark);     // tail, raised
    px(4, 11, 12, 6, fur);                           // body
    px(5, 11, 10, 2, furHi);
    px(6, 10, 8, 1, dark);                           // ruff along the back
    px(12, 14, 5, 3, pale);                          // chest
    px(15, 8, 5, 6, fur);                            // head
    px(15, 6, 2, 2, dark); px(18, 6, 2, 2, dark);    // ears
    px(19, 11, 4, 3, fur);                           // snout
    px(22, 11, 1, 1, "#17171b");                     // nose
    px(19, 14, 3, 1, pale);                          // jaw
    px(18, 9, 1, 1, "#d9a83a");                      // eye
    px(5, 17, 2, 5, dark); px(8, 17, 2, 5, fur);     // legs
    px(13, 17, 2, 5, dark); px(15, 17, 2, 5, fur);
  },
};
