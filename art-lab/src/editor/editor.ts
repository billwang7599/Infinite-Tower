import type { Look } from "@infinite-tower/client/src/gfx/look/look.js";
import { caption, el } from "../dom.js";
import { colors } from "./colors.js";
import { exportLayer, files, openFile } from "./filePanel.js";
import { layerList } from "./layerList.js";
import { composite } from "./layers.js";
import { Editor } from "./state.js";
import { toolbar } from "./toolbar.js";
import { CanvasView, toCanvas } from "./view.js";

const VIEW_PX = 640;
const PREVIEW_SCALES = [1, 2, 4];
const PANEL = "display:flex;flex-direction:column;gap:10px;padding:10px;background:#101118;border:1px solid #26283a;" +
  "border-radius:4px";

export function mountEditor(root: HTMLElement, look: () => Look): void {
  const ed = new Editor();
  const view = new CanvasView(ed, VIEW_PX, VIEW_PX);
  const tools = el("div");
  const status = el("div", "font-size:12px;color:#9a9cb0;min-height:16px");
  const error = el("div", "font-size:12px;color:#e07070");
  const preview = el("div", "display:flex;gap:16px;align-items:end;flex-wrap:wrap");
  const side = el("div", "display:flex;flex-direction:column;gap:12px;min-width:420px;flex:1");
  const report = (e: unknown) => { error.textContent = e instanceof Error ? e.message : String(e); };

  const left = el("div", "display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-width:" + VIEW_PX + "px");
  left.append(tools, view.canvas, status, error);
  const layout = el("div", "display:flex;gap:20px;align-items:start;flex-wrap:wrap");
  layout.append(left, side);
  root.append(layout);

  view.canvas.ondragover = (e) => e.preventDefault();
  view.canvas.ondrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) openFile(ed, file).then(() => view.fit(), report);
  };

  const drawPixels = () => {
    view.draw();
    const image = composite(ed.doc);
    preview.replaceChildren(...PREVIEW_SCALES.map((scale) => {
      const c = toCanvas(image);
      c.style.cssText = `width:${image.width * scale}px;height:${image.height * scale}px;image-rendering:pixelated;` +
        "background:#1c1d27";
      return caption(c, `${scale}x`);
    }));
    const at = view.hover && view.hover[0] >= 0 && view.hover[1] >= 0 && view.hover[0] < ed.doc.width &&
      view.hover[1] < ed.doc.height ? `  ·  pixel ${view.hover[0]}, ${view.hover[1]}` : "";
    const selected = ed.selection ? `  ·  selected ${ed.selection.w}x${ed.selection.h}` : "";
    status.textContent = `${ed.doc.width}x${ed.doc.height}  ·  ${view.zoom}x  ·  ${ed.layer.name}${at}${selected}`;
  };

  const panel = (title: string, body: HTMLElement) => {
    const box = el("section", PANEL);
    box.append(el("h3", "margin:0;font-size:13px", title), body);
    return box;
  };

  ed.onChange((panels) => {
    drawPixels();
    if (!panels) return;
    error.textContent = "";
    tools.replaceChildren(toolbar(ed, view));
    side.replaceChildren(
      panel("Preview", preview),
      panel("Color", colors(ed)),
      panel("Layers, top first", layerList(ed, (i) => exportLayer(ed, i))),
      panel("File", files(ed, look, () => view.fit(), report)),
    );
  });
  view.fit();
  ed.changed();
}
