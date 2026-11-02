import { blank, type Bitmap } from "./bitmap.js";
import { stamp } from "./selection.js";

export interface Cell { x: number; y: number }

export function packSheet(pictures: readonly Bitmap[], maxColumns: number): { sheet: Bitmap; cells: Cell[] } {
  const { width, height } = pictures[0]!;
  const columns = Math.min(maxColumns, pictures.length);
  const sheet = blank(width * columns, height * Math.ceil(pictures.length / columns));
  const cells = pictures.map((pic, i) => {
    const cell = { x: (i % columns) * width, y: Math.floor(i / columns) * height };
    stamp(sheet, pic, cell.x, cell.y);
    return cell;
  });
  return { sheet, cells };
}

export const tiled = (b: Bitmap, across: number, down: number): Bitmap =>
  packSheet(Array.from({ length: across * down }, () => b), across).sheet;

export const frameAt = (elapsedSec: number, fps: number, count: number) => Math.floor(elapsedSec * fps + 1e-9) % count;

export const sheetJson = (
  image: string, width: number, height: number, names: readonly string[], cells: readonly Cell[], what: string,
  extra: Record<string, unknown> = {},
) => ({
  image, width, height, ...extra,
  [`${what}s`]: cells.map((cell, i) => ({ name: names[i] || `${what} ${i + 1}`, ...cell })),
});
