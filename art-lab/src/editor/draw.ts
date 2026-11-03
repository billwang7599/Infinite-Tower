import { getPixel, inside, sameColor, setPixel, type Bitmap, type Rgba } from "./bitmap.js";
import { inRect, type Rect } from "./selection.js";

export type Point = readonly [number, number];

export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) return points;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

export function rectPoints(x0: number, y0: number, x1: number, y1: number, filled: boolean): Point[] {
  const [left, right] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [top, bottom] = [Math.min(y0, y1), Math.max(y0, y1)];
  const points: Point[] = [];
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (filled || x === left || x === right || y === top || y === bottom) points.push([x, y]);
    }
  }
  return points;
}

export function paint(b: Bitmap, points: readonly Point[], c: Rgba, clip: Rect | null = null): void {
  for (const [x, y] of points) if (!clip || inRect(clip, x, y)) setPixel(b, x, y, c);
}

export function floodFill(b: Bitmap, x: number, y: number, c: Rgba, clip: Rect | null = null): void {
  const within = (px: number, py: number) => inside(b, px, py) && (!clip || inRect(clip, px, py));
  if (!within(x, y)) return;
  const target = getPixel(b, x, y);
  if (sameColor(target, c)) return;
  const stack: Point[] = [[x, y]];
  while (stack.length > 0) {
    const [px, py] = stack.pop()!;
    if (!within(px, py) || !sameColor(getPixel(b, px, py), target)) continue;
    setPixel(b, px, py, c);
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
}

export function wrapShift(b: Bitmap, dx: number, dy: number): void {
  const from = b.rgba.slice();
  const { width: w, height: h } = b;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const to = ((((y + dy) % h) + h) % h * w + ((((x + dx) % w) + w) % w)) * 4;
      b.rgba.set(from.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), to);
    }
  }
}
