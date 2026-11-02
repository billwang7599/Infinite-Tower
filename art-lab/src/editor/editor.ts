import type { Look } from "@infinite-tower/client/src/gfx/look/look.js";
import { ChevronRight, Layers, MousePointer2, Redo2, Save, Scan, Undo2, ZoomIn, type IconNode } from "lucide";
import { MOD_KEY, caption, el, icon, iconButton, tip, withIcon } from "../dom.js";
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
import { toolOptions, toolRail } from "./toolbar.js";
import { TOOLS } from "./tools.js";
import { underlayPanel } from "./underlay.js";
import { CanvasView, toCanvas } from "./view.js";

const PREVIEW_SCALES = [1, 2, 4];
const TILE_PREVIEW_SCALES = [2, 4];
const collapsed = new Set<string>();

function statusItem(node: IconNode, title: string): [HTMLElement, HTMLElement] {
  const item = el("span", "flex items-center gap-1.5");
  const value = el("span", "text-fg");
  item.append(icon(node, 13), value);
  tip(item, title);
  return [item, value];
}

export function mountEditor(root: HTMLElement, bar: HTMLElement, look: () => Look): void {
  const ed = new Editor();
  const view = new CanvasView(ed, 1, 1);
  const playback = new Playback();
  const modes = el("div", "flex rounded-md border border-line bg-ink-950 p-0.5");
  const options = el("div", "flex h-10 flex-none items-center gap-3 overflow-x-auto border-b border-line " +
    "bg-ink-850 px-3");
  const rail = el("nav", "flex w-12 flex-none flex-col items-center gap-1 border-r border-line bg-ink-850 py-2");
  const workspace = el("div", "relative min-w-0 flex-1 overflow-hidden bg-ink-950");
  const preview = el("div", "flex flex-wrap items-end gap-4");
  const side = el("aside", "w-[360px] flex-none overflow-y-auto border-l border-line bg-ink-900 2xl:w-[400px]");
  const status = el("footer", "flex h-7 flex-none items-center gap-5 border-t border-line bg-ink-850 px-3 " +
    "text-label text-fg-muted tabular-nums");
  const toolName = el("span", "font-medium text-fg");
  const [cursorItem, cursorAt] = statusItem(MousePointer2, "The pixel under the cursor");
  const [sizeItem, size] = statusItem(Scan, "Canvas size");
  const [zoomItem, zoom] = statusItem(ZoomIn, "Zoom");
  const [layerItem, layerName] = statusItem(Layers, "Layer being drawn on");
  const selected = el("span");
  const message = el("span", "ml-auto truncate");
  status.append(toolName, cursorItem, sizeItem, zoomItem, layerItem, selected, message);
  const say = (text: string, ok = true) => {
    message.textContent = text;
    message.className = `ml-auto truncate ${ok ? "text-ok" : "text-danger"}`;
  };
  const report = (e: unknown) => say(e instanceof Error ? e.message : String(e), false);
  let saved: string[] = [];
  const refreshSaved = () => listSaved().then((names) => { saved = names; ed.changed(); });
  const save = () => saveDrawing(ed).then((text) => { say(text); return refreshSaved(); }).catch(report);

  const actions = el("div", "ml-auto flex items-center gap-1");
  actions.append(
    iconButton(Undo2, "Undo", () => ed.undo(), `${MOD_KEY}Z`),
    iconButton(Redo2, "Redo", () => ed.redo(), `${MOD_KEY}⇧Z`),
    el("span", "mx-2 h-5 w-px bg-line"),
  );
  const saveButton = withIcon(el("button", "btn btn-primary", "Save"), Save);
  saveButton.onclick = save;
  tip(saveButton, "Into the repo's art-lab/files, and the PNG to Downloads", `${MOD_KEY}S`);
  actions.append(saveButton);
  bar.append(modes, actions);

  workspace.append(view.canvas);
  const middle = el("div", "flex min-h-0 flex-1");
  middle.append(rail, workspace, side);
  root.append(options, middle, status);
  let sized = false;
  new ResizeObserver(() => {
    view.resize(workspace.clientWidth, workspace.clientHeight);
    if (!sized) view.fit();
    sized = true;
  }).observe(workspace);

  view.canvas.ondragover = (e) => e.preventDefault();
  view.canvas.ondrop = (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length > 0) openFiles(ed, files).then(() => view.fit(), report);
  };

  const picture = (scale: number, image = composite(ed.doc)) => {
    const c = toCanvas(image);
    c.className = "checker pixelated rounded-sm";
    c.style.width = `${image.width * scale}px`;
    c.style.height = `${image.height * scale}px`;
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
    const inside = hx >= 0 && hy >= 0 && hx < ed.doc.width && hy < ed.doc.height;
    toolName.textContent = view.spaceHeld ? TOOLS.hand.label : TOOLS[ed.tool].label;
    cursorAt.textContent = inside ? `${hx}, ${hy}` : "–";
    size.textContent = `${ed.doc.width} × ${ed.doc.height}`;
    zoom.textContent = `${view.zoom}x`;
    layerName.textContent = ed.layer.name;
    selected.textContent = ed.selection ? `Selected ${ed.selection.w} × ${ed.selection.h}` : "";
  };

  const panel = (title: string, body: HTMLElement) => {
    const box = el("section", "border-b border-line");
    const head = el("button", "flex h-9 w-full cursor-pointer items-center gap-1.5 px-3 text-left section-label " +
      "hover:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent");
    const chevron = icon(ChevronRight, 14);
    chevron.classList.add("transition-transform");
    if (!collapsed.has(title)) chevron.classList.add("rotate-90");
    head.append(chevron, title);
    head.onclick = () => {
      if (!collapsed.delete(title)) collapsed.add(title);
      ed.changed();
    };
    body.classList.add("px-3", "pb-3");
    box.append(head, ...(collapsed.has(title) ? [] : [body]));
    return box;
  };

  ed.onChange((panels) => {
    drawPixels();
    if (!panels) return;
    if (playback.playing && !looping) play();
    modes.replaceChildren(...MODES.map((mode) => {
      const b = el("button", "btn btn-ghost btn-sm px-3", MODE_LOOKS[mode].label);
      b.setAttribute("aria-pressed", String(mode === ed.mode));
      b.onclick = () => { ed.switchTo(mode); view.fit(); };
      return b;
    }));
    rail.replaceChildren(...toolRail(ed));
    options.replaceChildren(...toolOptions(ed, view));
    side.replaceChildren(
      panel(ed.mode === "tiles" ? "Preview: the tile repeated" : "Preview", preview),
      ...(ed.mode === "tiles" ? [panel("Tileset", pageStrip(ed))] : []),
      ...(ed.mode === "animation"
        ? [panel("Frames", pageStrip(ed)), panel("Playback", timeline(ed, view, playback))]
        : []),
      panel("Color", colors(ed)),
      panel("Layers", layerList(ed, (i) => exportLayer(ed, i))),
      ...(ed.mode === "tiles" ? [] : [panel("Underlay", underlayPanel(ed))]),
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
