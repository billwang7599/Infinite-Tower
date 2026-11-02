import type { EnemySprite } from "../index.js";

export const lurkerSprite: EnemySprite = {
  sizeTiles: 2.2,
  draw(px) {
    const hide = "#3d4a2c", hideHi = "#4f5f38", moss = "#5a7a2c", dark = "#20261a", belly = "#7a7550";
    px(0, 15, 3, 2, dark); px(2, 14, 4, 3, hide);
    px(4, 11, 13, 7, hide);
    px(5, 12, 11, 2, hideHi);
    px(6, 10, 3, 2, moss); px(10, 9, 3, 3, moss); px(14, 10, 2, 2, moss);
    px(6, 16, 10, 2, belly);
    px(16, 12, 7, 4, hide);
    px(16, 11, 4, 1, dark);
    px(18, 10, 2, 2, "#c8e05a");
    px(17, 16, 6, 1, belly);
    px(19, 15, 1, 1, "#d6cfa8"); px(21, 15, 1, 1, "#d6cfa8");
    px(13, 17, 3, 3, hide); px(13, 20, 4, 1, dark);
    px(5, 17, 3, 2, hide);
  },
};
