/** Overworld pixel-art textures (16 texels per tile), drawn in code. */
import type { DynamicTexture, Scene } from "@babylonjs/core";
import { pixelTexture } from "../gfx/textures.js";

/** Grass blades drawn over the player's feet while in tall grass (transparent background). */
export function tuftTexture(scene: Scene): DynamicTexture {
  const tex = pixelTexture(scene, "map-tuft", 16, (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = "#2c6128"; ctx.fillRect(1, 12, 14, 4);
    ctx.fillStyle = "#62b24f";
    for (const x of [1, 4, 7, 10, 13]) ctx.fillRect(x, 7 + (x % 3), 1, 6);
    ctx.fillStyle = "#86d06a";
    for (const x of [2, 5, 8, 11, 14]) ctx.fillRect(x, 9 + (x % 2), 1, 4);
  });
  tex.hasAlpha = true;
  return tex;
}
