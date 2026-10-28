import type { EnemySprite } from "../index.js";

export const goblinSprite: EnemySprite = {
  sizeTiles: 1.4,
  draw(px) {
    const skin = "#5f8a3a", skinHi = "#7aa64a", robe = "#3b2a52", robeHi = "#4d3a68", wood = "#5a3c22";
    px(18, 3, 3, 3, "#ff8a3a");          // orb
    px(19, 4, 1, 1, "#ffd08a");
    px(19, 6, 1, 15, wood);              // staff
    px(9, 4, 7, 4, robe);                // hood
    px(8, 7, 2, 1, robe);
    px(10, 8, 6, 5, skin);               // face
    px(11, 9, 3, 1, skinHi);
    px(16, 10, 2, 1, skin);              // nose
    px(6, 9, 4, 1, skin); px(5, 8, 1, 1, skin);  // ear
    px(14, 9, 1, 1, "#ffb03a");          // eye
    px(9, 13, 8, 8, robe);               // robe
    px(10, 14, 3, 6, robeHi);
    px(8, 20, 10, 1, "#8a6a2a");         // hem
    px(16, 14, 3, 2, robe);              // staff arm
    px(18, 14, 2, 2, skin);              // fist
    px(10, 21, 2, 2, skin); px(14, 21, 2, 2, skin); // feet
  },
};
