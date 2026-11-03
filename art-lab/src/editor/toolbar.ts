import {
  Crop, Eraser, Hand, Layers2, Maximize, PaintBucket, Pencil, Pipette, Slash, Square, SquareDashed, Trash2, X,
  ZoomIn, ZoomOut, type IconNode,
} from "lucide";
import { MOD_KEY, button, checkbox, el, iconButton, tip, withIcon } from "../dom.js";
import { blank, rgbaToHex } from "./bitmap.js";
import { wrapShift } from "./draw.js";
import { addLayer } from "./layers.js";
import { lift, stamp } from "./selection.js";
import { TOOL_NAMES, type Editor, type ToolName } from "./state.js";
import { TOOL_KEYS } from "./keys.js";
import { TOOLS } from "./tools.js";
import type { CanvasView } from "./view.js";

const TOOL_ICONS: Record<ToolName, IconNode> = {
  pencil: Pencil, eraser: Eraser, fill: PaintBucket, picker: Pipette, line: Slash, rect: Square, select: SquareDashed,
  hand: Hand,
};
const GROUP_ENDS = new Set<ToolName>(["picker", "rect"]);
const divider = () => el("span", "h-5 w-px flex-none bg-line");

export function toolRail(ed: Editor): HTMLElement[] {
  const items: HTMLElement[] = [];
  for (const name of TOOL_NAMES) {
    const key = Object.keys(TOOL_KEYS).find((k) => TOOL_KEYS[k] === name);
    const b = iconButton(TOOL_ICONS[name], TOOLS[name].label, () => {
      ed.tool = name;
      ed.changed();
    }, key ? key.toUpperCase() : "Hold Space", "btn btn-ghost btn-icon size-9 rounded-md");
    b.setAttribute("aria-pressed", String(ed.tool === name));
    items.push(b);
    if (GROUP_ENDS.has(name)) items.push(el("span", "my-1 h-px w-6 bg-line"));
  }
  const color = el("span", "mt-auto size-7 rounded-md border border-ink-600 shadow-[inset_0_0_0_2px_var(--color-ink-850)]");
  color.style.background = rgbaToHex(ed.color);
  tip(color, `Color ${rgbaToHex(ed.color)}`);
  items.push(color);
  return items;
}

export function toolOptions(ed: Editor, view: CanvasView): HTMLElement[] {
  const items: HTMLElement[] = [
    el("span", "w-24 flex-none text-title font-medium", TOOLS[ed.tool].label),
    divider(),
    checkbox("Grid", view.grid, (on) => { view.grid = on; ed.changed(false); }),
    checkbox("Filled rectangle", ed.filledRect, (on) => { ed.filledRect = on; }, "Or hold Shift while drawing one"),
  ];
  if (ed.mode === "tiles") {
    items.push(button("Shift by half", () => ed.edit(() => {
      for (const l of ed.doc.layers) wrapShift(l.pixels, Math.floor(ed.doc.width / 2), Math.floor(ed.doc.height / 2));
    }), "Wrap the tile round by half its size, to bring its edges into the middle and paint the seams",
    "btn btn-sm"));
  }
  items.push(divider(), el("span", "section-label flex-none", "Selection"), ...selectionButtons(ed));

  const zoom = el("div", "ml-auto flex flex-none items-center gap-0.5");
  zoom.append(
    iconButton(ZoomOut, "Zoom out", () => view.zoomBy(-1), "−", "btn btn-ghost btn-icon btn-sm"),
    el("span", "w-10 text-center text-body tabular-nums", `${view.zoom}x`),
    iconButton(ZoomIn, "Zoom in", () => view.zoomBy(1), "+", "btn btn-ghost btn-icon btn-sm"),
    withIcon(button("Fit", () => view.fit(), "Fit the drawing to the view", "btn btn-ghost btn-sm"), Maximize),
  );
  items.push(zoom);
  return items;
}

function selectionButtons(ed: Editor): HTMLButtonElement[] {
  const sel = ed.selection ?? { x: 0, y: 0, w: 0, h: 0 };
  const small = "btn btn-ghost btn-sm";
  const buttons = [
    withIcon(button("Deselect", () => { ed.selection = null; ed.changed(); }, "Deselect", small), X),
    withIcon(button("Clear selected", () => ed.edit(() => { lift(ed.layer.pixels, sel); }), "Clear selected", small),
      Trash2),
    withIcon(button("Selected to new layer", () => ed.edit(() => {
      const piece = lift(ed.layer.pixels, sel);
      ed.active = addLayer(ed.project, `${ed.layer.name} piece`, ed.active);
      stamp(ed.layer.pixels, piece, sel.x, sel.y);
    }), "", small), Layers2),
    withIcon(button("Crop to selection", () => ed.edit(() => {
      ed.project.pages = ed.project.pages.map((d) => ({
        ...d, width: sel.w, height: sel.h,
        layers: d.layers.map((l) => {
          const pixels = blank(sel.w, sel.h);
          stamp(pixels, lift(l.pixels, sel), 0, 0);
          return { ...l, pixels };
        }),
      }));
      ed.selection = null;
    }), "Every page of the drawing", small), Crop),
  ];
  tip(buttons[0]!, "", `Esc or ${MOD_KEY}D`);
  tip(buttons[1]!, "", "Delete");
  for (const b of buttons) b.disabled = !ed.selection;
  return buttons;
}
