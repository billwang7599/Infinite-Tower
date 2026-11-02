import { BUTTON, button, checkbox, el } from "../dom.js";
import { blank } from "./bitmap.js";
import { addLayer } from "./layers.js";
import { lift, stamp } from "./selection.js";
import { TOOL_NAMES, type Editor } from "./state.js";
import { TOOLS } from "./tools.js";
import type { CanvasView } from "./view.js";

const ROW = "display:flex;flex-wrap:wrap;gap:6px;align-items:center";

export function toolbar(ed: Editor, view: CanvasView): HTMLElement {
  const box = el("div", "display:flex;flex-direction:column;gap:8px");
  const tools = el("div", ROW);
  for (const name of TOOL_NAMES) {
    const b = el("button", BUTTON, TOOLS[name].label);
    if (ed.tool === name) b.style.background = "#8a6d2a";
    b.onclick = () => {
      ed.tool = name;
      view.canvas.style.cursor = name === "hand" ? "grab" : "crosshair";
      ed.changed();
    };
    tools.append(b);
  }

  const options = el("div", ROW);
  options.append(
    button("Undo", () => ed.undo()),
    button("Redo", () => ed.redo()),
    button("−", () => view.zoomBy(-1), "Zoom out (or the mouse wheel)"),
    el("span", "font-size:12px;min-width:36px;text-align:center", `${view.zoom}x`),
    button("+", () => view.zoomBy(1), "Zoom in (or the mouse wheel)"),
    button("Fit", () => view.fit()),
    checkbox("Grid", view.grid, (on) => { view.grid = on; ed.changed(false); }),
    checkbox("Filled rectangle (or hold Shift)", ed.filledRect, (on) => { ed.filledRect = on; }),
  );
  const selected = el("div", ROW);
  selected.append(...selectionButtons(ed));
  box.append(tools, options, selected);
  return box;
}

function selectionButtons(ed: Editor): HTMLButtonElement[] {
  const sel = ed.selection ?? { x: 0, y: 0, w: 0, h: 0 };
  const buttons = [
    button("Deselect", () => { ed.selection = null; ed.changed(); }),
    button("Clear selected", () => ed.edit(() => { lift(ed.layer.pixels, sel); })),
    button("Selected to new layer", () => ed.edit(() => {
      const piece = lift(ed.layer.pixels, sel);
      ed.active = addLayer(ed.doc, `${ed.layer.name} piece`, ed.active);
      stamp(ed.layer.pixels, piece, sel.x, sel.y);
    })),
    button("Crop to selection", () => ed.edit(() => {
      ed.doc = {
        width: sel.w, height: sel.h,
        layers: ed.doc.layers.map((l) => {
          const pixels = blank(sel.w, sel.h);
          stamp(pixels, lift(l.pixels, sel), 0, 0);
          return { ...l, pixels };
        }),
      };
      ed.selection = null;
    })),
  ];
  for (const b of buttons) {
    b.disabled = !ed.selection;
    if (b.disabled) b.style.opacity = "0.4";
  }
  return buttons;
}
