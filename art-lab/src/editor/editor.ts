import type { Look } from "@infinite-tower/client/src/gfx/look/look.js";
import { BUTTON, caption, el } from "../dom.js";
import { colors } from "./colors.js";
import { exportLayer, openFile } from "./fileIo.js";
import { filePanel } from "./filePanel.js";
import { layerList } from "./layerList.js";
import { composite } from "./layers.js";
import { MODES, MODE_LOOKS } from "./modes.js";
import { pageStrip } from "./pageStrip.js";
import { tiled } from "./sheet.js";
import { Editor } from "./state.js";
import { toolbar } from "./toolbar.js";
import { CanvasView, toCanvas } from "./view.js";

const VIEW_PX = 640;
const PREVIEW_SCALES = [1, 2, 4];
const TILE_PREVIEW_SCALES = [2, 4];
const PANEL = "display:flex;flex-direction:column;gap:10px;padding:10px;background:#101118;border:1px solid #26283a;" +
  "border-radius:4px";

export function mountEditor(root: HTMLElement, look: () => Look): void {
  const ed = new Editor();
  const view = new CanvasView(ed, VIEW_PX, VIEW_PX);
  const modes = el("div", "display:flex;gap:6px;margin-bottom:12px");
  const tools = el("div");
  const status = el("div", "font-size:12px;color:#9a9cb0;min-height:16px");
  const error = el("div", "font-size:12px;color:#e07070");
  const preview = el("div", "display:flex;gap:16px;align-items:end;flex-wrap:wrap");
  const side = el("div", "display:flex;flex-direction:column;gap:12px;min-width:420px;flex:1");
  const report = (e: unknown) => { error.textContent = e instanceof Error ? e.message : String(e); };

  const left = el("div", `display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-width:${VIEW_PX}px`);
  left.append(tools, view.canvas, status, error);
  const layout = el("div", "display:flex;gap:20px;align-items:start;flex-wrap:wrap");
  layout.append(left, side);
  root.append(modes, layout);

  view.canvas.ondragover = (e) => e.preventDefault();
  view.canvas.ondrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) openFile(ed, file).then(() => view.fit(), report);
  };

  const picture = (scale: number, image = composite(ed.doc)) => {
    const c = toCanvas(image);
    c.style.cssText = `width:${image.width * scale}px;height:${image.height * scale}px;image-rendering:pixelated;` +
      "background:#1c1d27";
    return c;
  };

  const drawPixels = () => {
    view.draw();
    const image = composite(ed.doc);
    preview.replaceChildren(...(ed.mode === "tiles"
      ? TILE_PREVIEW_SCALES.map((scale) => caption(picture(scale, tiled(image, 3, 3)), `3x3 at ${scale}x`))
      : PREVIEW_SCALES.map((scale) => caption(picture(scale, image), `${scale}x`))));
    const [hx, hy] = view.hover ?? [-1, -1];
    const at = hx >= 0 && hy >= 0 && hx < ed.doc.width && hy < ed.doc.height ? `  ·  pixel ${hx}, ${hy}` : "";
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
    modes.replaceChildren(...MODES.map((mode) => {
      const b = el("button", BUTTON, MODE_LOOKS[mode].label);
      if (mode === ed.mode) b.style.background = "#8a6d2a";
      b.onclick = () => { ed.switchTo(mode); view.fit(); };
      return b;
    }));
    tools.replaceChildren(toolbar(ed, view));
    side.replaceChildren(
      panel(ed.mode === "tiles" ? "Preview: the tile repeated, to show its seams" : "Preview", preview),
      ...(ed.mode === "tiles" ? [panel("Tileset", pageStrip(ed))] : []),
      panel("Color", colors(ed)),
      panel("Layers, top first", layerList(ed, (i) => exportLayer(ed, i))),
      panel("File", filePanel(ed, look, () => view.fit(), report)),
    );
  });
  view.fit();
}
