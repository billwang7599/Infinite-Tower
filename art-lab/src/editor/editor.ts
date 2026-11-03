import type { Look } from "@infinite-tower/client/src/gfx/look/look.js";
import { BUTTON, caption, el } from "../dom.js";
import { colors } from "./colors.js";
import { runCommand } from "./commands.js";
import { exportLayer, listSaved, openFiles, saveDrawing } from "./fileIo.js";
import { filePanel } from "./filePanel.js";
import { commandFor, typingIn } from "./keys.js";
import { layerList } from "./layerList.js";
import { composite } from "./layers.js";
import { MODES, MODE_LOOKS } from "./modes.js";
import { pageStrip } from "./pageStrip.js";
import { frameAt, tiled } from "./sheet.js";
import { Editor } from "./state.js";
import { Playback, timeline } from "./timeline.js";
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
  const playback = new Playback();
  const modes = el("div", "display:flex;gap:6px;margin-bottom:12px");
  const tools = el("div");
  const status = el("div", "font-size:12px;color:#9a9cb0;min-height:16px");
  const message = el("div", "font-size:12px;min-height:16px");
  const preview = el("div", "display:flex;gap:16px;align-items:end;flex-wrap:wrap");
  const side = el("div", "display:flex;flex-direction:column;gap:12px;min-width:420px;flex:1");
  const say = (text: string, color = "#9ad6a0") => {
    message.textContent = text;
    message.style.color = color;
  };
  const report = (e: unknown) => say(e instanceof Error ? e.message : String(e), "#e07070");
  let saved: string[] = [];
  const refreshSaved = () => listSaved().then((names) => { saved = names; ed.changed(); });
  const save = () => saveDrawing(ed).then((text) => { say(text); return refreshSaved(); }).catch(report);

  const left = el("div", `display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-width:${VIEW_PX}px`);
  left.append(tools, view.canvas, status, message);
  const layout = el("div", "display:flex;gap:20px;align-items:start;flex-wrap:wrap");
  layout.append(left, side);
  root.append(modes, layout);

  view.canvas.ondragover = (e) => e.preventDefault();
  view.canvas.ondrop = (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length > 0) openFiles(ed, files).then(() => view.fit(), report);
  };

  const picture = (scale: number, image = composite(ed.doc)) => {
    const c = toCanvas(image);
    c.style.cssText = `width:${image.width * scale}px;height:${image.height * scale}px;image-rendering:pixelated;` +
      "background:#1c1d27";
    return c;
  };

  const drawPreview = () => {
    const { pages } = ed.project;
    const playing = playback.playing && ed.mode === "animation";
    const shown = playing ? pages[frameAt(playback.elapsedSec(performance.now()), ed.project.fps, pages.length)]! : ed.doc;
    const image = composite(shown);
    preview.replaceChildren(...(ed.mode === "tiles"
      ? TILE_PREVIEW_SCALES.map((scale) => caption(picture(scale, tiled(image, 3, 3)), `3x3 at ${scale}x`))
      : PREVIEW_SCALES.map((scale) => caption(picture(scale, image), `${scale}x`))));
  };
  let looping = false;
  const play = () => {
    looping = playback.playing;
    if (!looping) return;
    drawPreview();
    requestAnimationFrame(play);
  };

  const drawPixels = () => {
    view.draw();
    drawPreview();
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
    if (playback.playing && !looping) play();
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
      ...(ed.mode === "animation" ? [panel("Frames", pageStrip(ed)), panel("Playback", timeline(ed, view, playback))] : []),
      panel("Color", colors(ed)),
      panel("Layers, top first", layerList(ed, (i) => exportLayer(ed, i))),
      panel("File", filePanel(ed, look, { saved, save, fitView: () => view.fit(), report })),
    );
  });
  const shown = () => root.offsetParent !== null;
  document.addEventListener("keydown", (e) => {
    if (e.key === " " && shown() && !typingIn(e.target as HTMLElement)) {
      e.preventDefault();
      view.spaceHeld = true;
      ed.changed(false);
    }
    const command = shown() ? commandFor(e) : null;
    if (!command) return;
    if (typingIn(e.target as HTMLElement)) {
      if (command.do !== "save") return;
      (e.target as HTMLElement).blur();
    }
    e.preventDefault();
    runCommand(command, ed, view, save);
  });
  document.addEventListener("keyup", (e) => {
    if (e.key !== " " || !view.spaceHeld) return;
    view.spaceHeld = false;
    ed.changed(false);
  });
  window.addEventListener("blur", () => { view.spaceHeld = false; });
  view.fit();
  refreshSaved();
}
