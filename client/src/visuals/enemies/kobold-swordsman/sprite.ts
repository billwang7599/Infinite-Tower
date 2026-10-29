import type { EnemySprite } from "../index.js";

export const drawnKobold = (cloth: string, blade: { width: number; top: number; steel: string }): EnemySprite => ({
  sizeTiles: 1.6,
  draw(px) {
    const scales = "#56704a", scalesHi = "#6f8a5c", dark = "#2e3b29", bone = "#d8cba4";
    px(19, blade.top, blade.width, 14 - blade.top, blade.steel); // blade, held up
    px(17, 13, 5, 1, "#b8913a");         // guard
    px(18, 14, 2, 2, dark);              // grip + fist
    px(7, 5, 3, 1, bone); px(6, 4, 1, 1, bone); // horn
    px(8, 6, 7, 6, scales);              // head
    px(9, 7, 4, 2, scalesHi);
    px(14, 8, 4, 3, scales);             // snout
    px(7, 12, 1, 1, dark); px(7, 14, 1, 1, dark); // ridge
    px(17, 8, 1, 1, "#140c08");          // nose
    px(12, 7, 1, 1, "#f2c84a");          // eye
    px(8, 12, 8, 7, cloth);              // tunic
    px(8, 17, 8, 1, dark);               // belt
    px(14, 13, 4, 2, scales);            // sword arm
    px(5, 17, 3, 1, scales); px(3, 18, 2, 1, scales); // tail
    px(9, 19, 2, 4, dark); px(13, 19, 2, 4, dark); // legs
  },
});

export const koboldSprite = drawnKobold("#6e2f2a", { width: 1, top: 2, steel: "#d6dde3" });
