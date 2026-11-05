import type { EnemySprite } from "../index.js";
import { drawnKobold } from "../kobold-swordsman/sprite.js";

const kobold = drawnKobold("#2f4466", { width: 1, top: 2, steel: "#d6dde3" });

export const koboldShieldbearerSprite: EnemySprite = {
  sizeTiles: kobold.sizeTiles,
  draw(px) {
    kobold.draw(px);
    const wood = "#7a5636", grain = "#5e4129", rim = "#6f7378", boss = "#a3a7ab";
    px(9, 12, 5, 1, rim); px(8, 13, 7, 5, wood); px(9, 18, 5, 1, rim);
    px(8, 13, 1, 5, rim); px(14, 13, 1, 5, rim);
    px(10, 14, 1, 3, grain); px(12, 14, 1, 3, grain);
    px(11, 15, 1, 1, boss);
  },
};
