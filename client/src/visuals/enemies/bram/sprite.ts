import type { EnemySprite } from "../index.js";

export const bramSprite: EnemySprite = {
  sizeTiles: 2,
  draw(px) {
    const skin = "#c99a6e", hair = "#c8c8c8", coat = "#7a7670", dark = "#3a3633";
    const blade = "#a07a4e", hilt = "#5a3e26";
    px(10, 3, 5, 2, hair);
    px(10, 5, 5, 4, skin);
    px(9, 9, 7, 8, coat);
    px(10, 17, 2, 5, dark); px(13, 17, 2, 5, dark);
    px(16, 10, 2, 5, skin);
    px(17, 3, 1, 8, blade);
    px(16, 11, 3, 1, hilt);
    px(17, 12, 1, 3, hilt);
  },
};
