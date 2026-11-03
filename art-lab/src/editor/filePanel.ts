import { drawChibi, drawPortrait, type Look } from "@infinite-tower/client/src/gfx/look/look.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { FIELD, button, checkbox, el, select } from "../dom.js";
import { downloadJson, exportLayer, exportPng, importing, naming, openFile, pickFile } from "./fileIo.js";
import { projectToJson } from "./json.js";
import { addLayer, composite, newProject } from "./layers.js";
import { MODE_LOOKS } from "./modes.js";
import { placeImage } from "./resample.js";
import { packSheet } from "./sheet.js";
import type { Editor } from "./state.js";

const MAX_SIDE = 512;
const SHEET_COLUMNS = 8;

let size = "";
let custom = { width: 48, height: 48 };

export function filePanel(ed: Editor, look: () => Look, fitView: () => void, report: (e: unknown) => void): HTMLElement {
  const box = el("div", "display:flex;flex-direction:column;gap:8px");
  const row = () => el("div", "display:flex;flex-wrap:wrap;gap:6px;align-items:center");
  const { sizes, layers } = MODE_LOOKS[ed.mode];
  if (!(size in sizes) && size !== "custom") size = Object.keys(sizes)[0]!;
  const side = (key: "width" | "height") => {
    const input = el("input", `${FIELD};width:46px`);
    input.type = "number";
    input.min = "1";
    input.max = String(MAX_SIDE);
    input.value = String(custom[key]);
    input.onchange = () => { custom = { ...custom, [key]: Math.max(1, Math.min(MAX_SIDE, Number(input.value) || 1)) }; };
    return input;
  };
  const make = row();
  const options = [...Object.entries(sizes).map(([n, s]) => [n, `${n} ${s.width}x${s.height}`] as const), ["custom", "custom"] as const];
  make.append(select(options, size, (v) => { size = v; ed.changed(); }));
  if (size === "custom") make.append(side("width"), "x", side("height"));
  make.append(button("New", () => {
    const { width, height } = size === "custom" ? custom : sizes[size]!;
    ed.open(ed.mode, newProject(width, height, layers));
    fitView();
  }, "Start a new drawing (Undo brings the old one back)"));
  if (ed.mode === "sprite") {
    make.append(button("Add the look's picture", () => addLook(ed, look()), "The Characters tab's look, as a layer"));
  }

  const bring = row();
  bring.append(
    button("Import image…", () => pickFile("image/*", (f) => openFile(ed, f).catch(report)), "Or drop one on the canvas"),
    select([["smooth", "smoothed"], ["nearest", "nearest neighbour"]], importing.scaling, (v) => { importing.scaling = v; }),
    select([["contain", "fit inside"], ["cover", "fill, cropped"], ["stretch", "stretch"]], importing.fit,
      (v) => { importing.fit = v; }),
    checkbox("snap to the game's colors", importing.snap, (on) => { importing.snap = on; }),
  );

  const keep = row();
  keep.append(
    button("Export PNG", () => exportPng(composite(ed.doc), naming.file)),
    button("Export each layer", () => ed.doc.layers.forEach((_, i) => exportLayer(ed, i))),
  );
  if (ed.mode === "tiles") keep.append(button("Export tileset", () => exportTileset(ed), "A PNG sheet and its JSON"));
  keep.append(
    button("Save…", () => downloadJson(projectToJson(ed.mode, ed.project), naming.file)),
    button("Open…", () => pickFile(".json,application/json", (f) => openFile(ed, f).then(fitView, report))),
  );
  box.append(make, bring, keep);
  return box;
}

function exportTileset(ed: Editor): void {
  const pages = ed.project.pages;
  const { sheet, cells } = packSheet(pages.map((d) => composite(d)), SHEET_COLUMNS);
  exportPng(sheet, `${naming.file}-tiles`);
  downloadJson({
    image: `${naming.file}-tiles.png`, tileWidth: pages[0]!.width, tileHeight: pages[0]!.height,
    tiles: pages.map((d, i) => ({ name: d.name || `tile ${i + 1}`, ...cells[i] })),
  }, `${naming.file}-tiles`);
}

function addLook(ed: Editor, look: Look): void {
  const small = ed.doc.width === ed.doc.height && ed.doc.width <= 32;
  const pic = small ? drawChibi(look, "front", STARTER_CLOTHES) : drawPortrait(look, STARTER_CLOTHES);
  ed.edit(() => {
    ed.active = addLayer(ed.project, "look", ed.active);
    ed.layer.pixels = placeImage(pic, ed.doc.width, ed.doc.height, "contain", "nearest");
  });
}
