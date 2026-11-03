import type { Picture } from "@infinite-tower/client/src/gfx/look/art.js";

export type Bitmap = Picture;
export type Rgba = readonly [number, number, number, number];

export const CLEAR: Rgba = [0, 0, 0, 0];

export const blank = (width: number, height: number): Bitmap =>
  ({ width, height, rgba: new Uint8ClampedArray(width * height * 4) });

export const copyBitmap = (b: Bitmap): Bitmap => ({ width: b.width, height: b.height, rgba: b.rgba.slice() });

export const inside = (b: Bitmap, x: number, y: number) => x >= 0 && y >= 0 && x < b.width && y < b.height;

export function getPixel(b: Bitmap, x: number, y: number): Rgba {
  if (!inside(b, x, y)) return CLEAR;
  const i = (y * b.width + x) * 4;
  return [b.rgba[i]!, b.rgba[i + 1]!, b.rgba[i + 2]!, b.rgba[i + 3]!];
}

export function setPixel(b: Bitmap, x: number, y: number, c: Rgba): void {
  if (inside(b, x, y)) b.rgba.set(c, (y * b.width + x) * 4);
}

export const sameColor = (a: Rgba, b: Rgba) =>
  (a[3] === 0 && b[3] === 0) || (a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);

export const hexToRgba = (hex: string): Rgba =>
  [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];

export const rgbaToHex = (c: Rgba) => `#${[c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
