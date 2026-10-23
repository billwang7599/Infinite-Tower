/** Grass Field pixel-art textures (16 texels per tile), drawn in code. */
import type { DynamicTexture, Scene } from "@babylonjs/core";
import { pixelTexture } from "../../gfx/textures.js";

/** Short grass: an 8x8-tile texture, big enough that the repeat isn't obvious. */
export function grassTexture(scene: Scene, r: () => number): DynamicTexture {
  return pixelTexture(scene, "map-grass", 128, (ctx) => {
    ctx.fillStyle = "#5fa84e";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 560; i++) {
      ctx.fillStyle = ["#6fbb5a", "#529646", "#79c463", "#4b8c40"][Math.floor(r() * 4)]!;
      ctx.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1 + Math.floor(r() * 2), 1);
    }
    for (let i = 0; i < 9; i++) { // little flowers
      const x = 1 + Math.floor(r() * 124), y = 1 + Math.floor(r() * 124);
      ctx.fillStyle = r() < 0.5 ? "#f4f0d8" : "#f2c94c";
      ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x + 2, y, 1, 1);
    }
  });
}

/** Tall grass: one tile, four dense tufts. */
export function tallGrassTexture(scene: Scene): DynamicTexture {
  return pixelTexture(scene, "map-tall-grass", 16, (ctx) => {
    ctx.fillStyle = "#3d7f36";
    ctx.fillRect(0, 0, 16, 16);
    const tuft = (x: number, y: number) => {
      ctx.fillStyle = "#2c6128"; ctx.fillRect(x, y + 5, 7, 2);
      ctx.fillStyle = "#62b24f";
      ctx.fillRect(x, y + 1, 1, 4); ctx.fillRect(x + 3, y, 1, 5); ctx.fillRect(x + 6, y + 1, 1, 4);
      ctx.fillStyle = "#86d06a";
      ctx.fillRect(x + 1, y + 2, 1, 3); ctx.fillRect(x + 4, y + 1, 1, 3); ctx.fillRect(x + 5, y + 3, 1, 2);
    };
    tuft(0, 1); tuft(8, 9); tuft(9, 0); tuft(1, 9);
  });
}

/** A round tree seen from above (transparent background). */
export function treeTexture(scene: Scene): DynamicTexture {
  const tex = pixelTexture(scene, "map-tree", 32, (ctx) => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "#5b3b22"; ctx.fillRect(13, 22, 6, 9); // trunk
    const blob = (cx: number, cy: number, rad: number, color: string) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    };
    blob(16, 14, 12, "#1f4a24"); blob(15, 12, 10, "#2f6b2f"); blob(13, 10, 6, "#3f8a3a"); blob(11, 8, 2.5, "#5aa64c");
  });
  tex.hasAlpha = true;
  return tex;
}
