import type { EnemySprite } from "../index.js";

export const chickenSprite: EnemySprite = {
  sizeTiles: 1,
  draw(px) {
    const white = "#e9e2d0", shade = "#c9c0aa", red = "#c0392b", beak = "#e0a030";
    px(5, 9, 3, 4, white);
    px(7, 12, 10, 7, white);
    px(9, 13, 5, 3, shade);
    px(15, 7, 4, 6, white);
    px(16, 5, 2, 2, red);
    px(19, 9, 2, 1, beak);
    px(18, 11, 1, 2, red);
    px(17, 8, 1, 1, "#141414");
    px(10, 19, 1, 3, beak);
    px(14, 19, 1, 3, beak);
  },
};
