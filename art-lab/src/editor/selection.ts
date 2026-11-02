import { blank, CLEAR, getPixel, setPixel, type Bitmap } from "./bitmap.js";

export interface Rect { x: number; y: number; w: number; h: number }

export const rectBetween = (x0: number, y0: number, x1: number, y1: number): Rect =>
  ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 });

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export function copyRect(b: Bitmap, r: Rect): Bitmap {
  const piece = blank(r.w, r.h);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) setPixel(piece, x, y, getPixel(b, r.x + x, r.y + y));
  }
  return piece;
}

export function lift(b: Bitmap, r: Rect): Bitmap {
  const piece = copyRect(b, r);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) setPixel(b, r.x + x, r.y + y, CLEAR);
  }
  return piece;
}

export function stamp(b: Bitmap, piece: Bitmap, atX: number, atY: number): void {
  for (let y = 0; y < piece.height; y++) {
    for (let x = 0; x < piece.width; x++) {
      const p = getPixel(piece, x, y);
      if (p[3] > 0) setPixel(b, atX + x, atY + y, p);
    }
  }
}
