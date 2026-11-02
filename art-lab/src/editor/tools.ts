import { copyBitmap, getPixel, type Bitmap, type Rgba } from "./bitmap.js";
import { floodFill, linePoints, paint, rectPoints, type Point } from "./draw.js";
import { composite } from "./layers.js";
import { inRect, rectBetween, stamp } from "./selection.js";
import type { Editor, ToolName } from "./state.js";

export interface Tool {
  label: string;
  down(ed: Editor, x: number, y: number, e: PointerEvent): void;
  move?(ed: Editor, x: number, y: number, e: PointerEvent): void;
}

let fromX = 0, fromY = 0;
let base: Bitmap | null = null;
let piece: Bitmap | null = null;

const ERASE: Rgba = [0, 0, 0, 0];

const freehand = (label: string, ink: (ed: Editor) => Rgba): Tool => ({
  label,
  down(ed, x, y) {
    ed.record();
    paint(ed.layer.pixels, [[x, y]], ink(ed), ed.selection);
    [fromX, fromY] = [x, y];
    ed.changed();
  },
  move(ed, x, y) {
    paint(ed.layer.pixels, linePoints(fromX, fromY, x, y), ink(ed), ed.selection);
    [fromX, fromY] = [x, y];
    ed.changed(false);
  },
});

type Shape = (ed: Editor, x: number, y: number, e: PointerEvent) => readonly Point[];

const shape = (label: string, points: Shape): Tool => ({
  label,
  down(ed, x, y, e) {
    ed.record();
    base = copyBitmap(ed.layer.pixels);
    [fromX, fromY] = [x, y];
    paint(ed.layer.pixels, points(ed, x, y, e), ed.color, ed.selection);
    ed.changed();
  },
  move(ed, x, y, e) {
    ed.layer.pixels.rgba.set(base!.rgba);
    paint(ed.layer.pixels, points(ed, x, y, e), ed.color, ed.selection);
    ed.changed(false);
  },
});

function pick(ed: Editor, x: number, y: number): void {
  const c = getPixel(composite(ed.doc), x, y);
  if (c[3] === 0) return;
  ed.color = [c[0], c[1], c[2], 255];
  ed.changed();
}

export const TOOLS: Record<ToolName, Tool> = {
  pencil: freehand("Pencil", (ed) => ed.color),
  eraser: freehand("Eraser", () => ERASE),
  fill: { label: "Fill", down: (ed, x, y) => ed.edit(() => floodFill(ed.layer.pixels, x, y, ed.color, ed.selection)) },
  picker: { label: "Eyedropper", down: pick, move: pick },
  line: shape("Line", (_ed, x, y) => linePoints(fromX, fromY, x, y)),
  rect: shape("Rectangle", (ed, x, y, e) => rectPoints(fromX, fromY, x, y, ed.filledRect || e.shiftKey)),
  select: {
    label: "Select / move",
    down(ed, x, y) {
      [fromX, fromY] = [x, y];
      piece = null;
      if (ed.selection && inRect(ed.selection, x, y)) {
        ({ piece, under: base } = ed.takeSelection());
      } else {
        ed.selection = rectBetween(x, y, x, y);
      }
      ed.changed();
    },
    move(ed, x, y) {
      if (!piece) {
        ed.selection = rectBetween(fromX, fromY, x, y);
      } else {
        const sel = ed.selection!;
        ed.selection = { ...sel, x: sel.x + x - fromX, y: sel.y + y - fromY };
        [fromX, fromY] = [x, y];
        ed.layer.pixels.rgba.set(base!.rgba);
        stamp(ed.layer.pixels, piece, ed.selection.x, ed.selection.y);
      }
      ed.changed(false);
    },
  },
  hand: { label: "Pan", down: () => {} },
};
