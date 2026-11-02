import { drawChibi, drawPortrait, type Look } from "@infinite-tower/client/src/gfx/look/look.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { FIELD, button, checkbox, el, select } from "../dom.js";
import {
  downloadJson, exportLayer, exportPng, importPhoto, importing, naming, openFiles, openPictures, pickFiles, readSaved,
  uploading,
} from "./fileIo.js";
import { projectToJson } from "./json.js";
import { addLayer, composite, MAX_SIDE, newProject } from "./layers.js";
import { MODE_LOOKS } from "./modes.js";
import { toSaveName } from "./names.js";
import { placeImage } from "./resample.js";
import { projectSheet, sheetJson } from "./sheet.js";
import type { Editor } from "./state.js";
import { TEMPLATES } from "./templates.js";

let size = "";
let custom = { width: 48, height: 48 };
let opening = "";
let template = "";

export interface Files {
  saved: readonly string[];
  save: () => void;
  fitView: () => void;
  report: (e: unknown) => void;
}

const row = () => el("div", "display:flex;flex-wrap:wrap;gap:6px;align-items:center");

function numberField(value: number, min: number, onchange: (v: number) => void, width = 46): HTMLInputElement {
  const input = el("input", `${FIELD};width:${width}px`);
  input.type = "number";
  input.min = String(min);
  input.max = String(MAX_SIDE);
  input.value = String(value);
  input.onchange = () => onchange(Math.max(min, Math.min(MAX_SIDE, Math.round(Number(input.value) || min))));
  return input;
}

export function filePanel(ed: Editor, look: () => Look, files: Files): HTMLElement {
  const { fitView, report } = files;
  const box = el("div", "display:flex;flex-direction:column;gap:8px");
  const opened = (then: Promise<void>) => then.then(fitView, report);

  const keep = row();
  const name = el("input", `${FIELD};width:150px`);
  name.value = naming.file;
  name.title = "Letters, digits, - and _";
  name.onchange = () => { naming.file = toSaveName(name.value); name.value = naming.file; };
  keep.append(name, button("Save", files.save, "Ctrl+S: into the repo's art-lab/files, and the PNG to Downloads"));
  if (files.saved.length > 0) {
    if (!files.saved.includes(opening)) opening = files.saved[0]!;
    keep.append(
      select(files.saved.map((n) => [n, n] as const), opening, (v) => { opening = v; }),
      button("Open", () => opened(readSaved(opening).then(({ mode, project }) => {
        naming.file = opening;
        ed.open(mode, project);
      }))),
    );
  }

  const { sizes, layers } = MODE_LOOKS[ed.mode];
  if (!(size in sizes) && size !== "custom") size = Object.keys(sizes)[0]!;
  const make = row();
  const options = [...Object.entries(sizes).map(([n, s]) => [n, `${n} ${s.width}x${s.height}`] as const), ["custom", "custom"] as const];
  make.append(select(options, size, (v) => { size = v; ed.changed(); }));
  if (size === "custom") {
    make.append(numberField(custom.width, 1, (width) => { custom = { ...custom, width }; }), "x",
      numberField(custom.height, 1, (height) => { custom = { ...custom, height }; }));
  }
  make.append(button("New", () => {
    const { width, height } = size === "custom" ? custom : sizes[size]!;
    naming.file = "drawing";
    ed.open(ed.mode, newProject(width, height, layers));
    fitView();
  }, "Start a new drawing (Undo brings the old one back)"));
  if (ed.mode !== "tiles") {
    make.append(button("Add the look's picture", () => addLook(ed, look()), "The Characters tab's look, as a layer"));
  }

  const fromTemplate = row();
  const list = el("select", FIELD);
  for (const group of new Set(TEMPLATES.map((t) => t.group))) {
    const g = el("optgroup");
    g.label = group;
    for (const t of TEMPLATES.filter((t) => t.group === group)) g.append(new Option(t.name, t.name, false, t.name === template));
    list.append(g);
  }
  if (files.saved.length > 0) {
    const g = el("optgroup");
    g.label = "Saved";
    for (const n of files.saved) g.append(new Option(n, `saved:${n}`, false, `saved:${n}` === template));
    list.append(g);
  }
  template ||= list.value;
  list.onchange = () => { template = list.value; };
  fromTemplate.append(list, button("New from template", () => {
    const saved = template.startsWith("saved:") ? template.slice(6) : null;
    const t = TEMPLATES.find((t) => t.name === template);
    if (saved) {
      opened(readSaved(saved).then(({ mode, project }) => {
        naming.file = toSaveName(`${saved}-copy`);
        ed.open(mode, project);
      }));
    } else if (t) {
      naming.file = toSaveName(t.name);
      ed.open(t.mode, t.make());
      fitView();
    }
  }, "A new drawing from art the game draws today, or from a saved one"));

  const own = row();
  own.append(
    button("Open PNG…", () => pickFiles("image/png,image/gif", (f) => opened(openPictures(ed, f)), true),
      "Pixel for pixel, as a new drawing (or drop them on the canvas)"),
    "cells", numberField(uploading.cellWidth, 0, (v) => { uploading.cellWidth = v; }, 40), "x",
    numberField(uploading.cellHeight, 0, (v) => { uploading.cellHeight = v; }, 40),
    el("span", "font-size:11px;color:#9a9cb0", "(0: the whole picture)"),
    "several as", select([["pages", "frames / tiles"], ["layers", "layers"]], uploading.many, (v) => { uploading.many = v; }),
  );

  const photo = row();
  photo.append(
    button("Import photo…", () => pickFiles("image/*", ([f]) => importPhoto(ed, f!).catch(report)),
      "Fitted onto a new layer"),
    select([["smooth", "smoothed"], ["nearest", "nearest neighbour"]], importing.scaling, (v) => { importing.scaling = v; }),
    select([["contain", "fit inside"], ["cover", "fill, cropped"], ["stretch", "stretch"]], importing.fit,
      (v) => { importing.fit = v; }),
    checkbox("snap to the game's colors", importing.snap, (on) => { importing.snap = on; }),
  );

  const out = row();
  out.append(
    button("Export PNG", () => exportPng(composite(ed.doc), naming.file)),
    button("Export each layer", () => ed.doc.layers.forEach((_, i) => exportLayer(ed, i))),
  );
  if (ed.mode !== "sprite") out.append(button("Export sheet", () => exportSheet(ed), "A PNG sheet and its JSON"));
  out.append(
    button("Download JSON", () => downloadJson(projectToJson(ed.mode, ed.project), naming.file)),
    button("Open file…", () => pickFiles(".json,application/json", (f) => opened(openFiles(ed, f)))),
  );
  box.append(keep, make, fromTemplate, own, photo, out);
  return box;
}

function exportSheet(ed: Editor): void {
  const { pages, fps } = ed.project;
  const what = MODE_LOOKS[ed.mode].page;
  const name = `${naming.file}-${what}s`;
  const { sheet, cells } = projectSheet(ed.project);
  exportPng(sheet, name);
  downloadJson(sheetJson(`${name}.png`, pages[0]!.width, pages[0]!.height, pages.map((d) => d.name), cells, what,
    ed.mode === "animation" ? { fps } : {}), name);
}

function addLook(ed: Editor, look: Look): void {
  const small = ed.doc.width === ed.doc.height && ed.doc.width <= 32;
  const pic = small ? drawChibi(look, "front", STARTER_CLOTHES) : drawPortrait(look, STARTER_CLOTHES);
  ed.edit(() => {
    ed.active = addLayer(ed.project, "look", ed.active);
    ed.layer.pixels = placeImage(pic, ed.doc.width, ed.doc.height, "contain", "nearest");
  });
}
