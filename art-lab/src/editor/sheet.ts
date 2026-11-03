import { blank, type Bitmap } from "./bitmap.js";
import { composite, type Project } from "./layers.js";
import { copyRect, stamp } from "./selection.js";

export interface Cell { x: number; y: number }

const SHEET_COLUMNS = 8;

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

export function splitSheet(sheet: Bitmap, width: number, height: number, dropTrailingEmpty = true): Bitmap[] {
  if (width < 1 || height < 1 || width > sheet.width || height > sheet.height) {
    throw new Error(`A ${width}x${height} cell doesn't fit a ${sheet.width}x${sheet.height} sheet`);
  }
  const cells: Bitmap[] = [];
  for (let y = 0; y + height <= sheet.height; y += height) {
    for (let x = 0; x + width <= sheet.width; x += width) cells.push(copyRect(sheet, { x, y, w: width, h: height }));
  }
  while (dropTrailingEmpty && cells.length > 1 && cells.at(-1)!.rgba.every((v, i) => i % 4 !== 3 || v === 0)) cells.pop();
  return cells;
}

export const projectSheet = (p: Project) => packSheet(p.pages.map((d) => composite(d)), SHEET_COLUMNS);
