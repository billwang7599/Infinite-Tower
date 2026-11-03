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
