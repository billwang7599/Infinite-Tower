import type { EnemySprite } from "../index.js";

export const trainingDummySprite: EnemySprite = {
  sizeTiles: 2,
  draw(px) {
    const wood = "#6a4b30", straw = "#b89a52", rope = "#4a3a26";
    px(11, 4, 2, 18, wood);
    px(5, 9, 14, 2, wood);
    px(8, 11, 8, 7, straw);
    px(9, 4, 6, 5, straw);
    px(8, 13, 8, 1, rope);
  },
};
