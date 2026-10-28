import type { EnemySprite } from "../index.js";

export const boarSprite: EnemySprite = {
  sizeTiles: 2,
  draw(px) {
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
  },
};
