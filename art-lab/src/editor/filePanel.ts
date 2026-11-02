import { VIEWS } from "@infinite-tower/client/src/gfx/look/art.js";
import { drawChibi, drawPortrait, type Look } from "@infinite-tower/client/src/gfx/look/look.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { FIELD, button, checkbox, el, select } from "../dom.js";
import type { Bitmap } from "./bitmap.js";
import { docFromJson, docToJson } from "./json.js";
import { addLayer, composite, newDoc } from "./layers.js";
import { GAME_COLORS } from "./palette.js";
import { placeImage, snapToPalette, type Fit, type Scaling } from "./resample.js";
import type { Editor } from "./state.js";
import { toCanvas } from "./view.js";

const PRESETS: Record<string, { width: number; height: number }> = { ...VIEWS };
type Size = keyof typeof PRESETS | "custom";
const SIZES: [Size, string][] = [
  ...Object.entries(PRESETS).map(([name, { width, height }]): [Size, string] => [name, `${name} ${width}x${height}`]),
  ["custom", "custom"],
];
const MAX_SIDE = 512;
// Smoothing a big photo straight down in JS is slow; the browser first takes it to this many times the canvas.
const PRESCALE_TIMES = 4;

const importing = { scaling: "smooth" as Scaling, fit: "contain" as Fit, snap: true };
let size: Size = "portrait";
let custom = { width: 48, height: 48 };
let fileName = "drawing";

function download(blob: Blob, name: string): void {
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportPng(b: Bitmap, name: string): void {
  toCanvas(b).toBlob((blob) => blob && download(blob, `${name}.png`));
}

export const exportLayer = (ed: Editor, index: number) => {
  const layer = ed.doc.layers[index]!;
  exportPng(composite(ed.doc, [{ ...layer, visible: true }]), `${fileName}-${layer.name}`);
};

async function decode(file: File, width: number, height: number): Promise<Bitmap> {
  const image = await createImageBitmap(file);
  const shrink = Math.min(1, (PRESCALE_TIMES * Math.max(width, height)) / Math.max(image.width, image.height));
  const keep = importing.scaling === "nearest" ? 1 : shrink;
  const c = el("canvas");
  c.width = Math.max(1, Math.round(image.width * keep));
  c.height = Math.max(1, Math.round(image.height * keep));
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(image, 0, 0, c.width, c.height);
  return { width: c.width, height: c.height, rgba: g.getImageData(0, 0, c.width, c.height).data };
}

export async function openFile(ed: Editor, file: File): Promise<void> {
  const name = file.name.replace(/\.[^.]*$/, "");
  if (file.name.endsWith(".json")) {
    ed.open(docFromJson(await file.text()));
    fileName = name;
    return;
  }
  const pixels = placeImage(await decode(file, ed.doc.width, ed.doc.height), ed.doc.width, ed.doc.height,
    importing.fit, importing.scaling);
  if (importing.snap) snapToPalette(pixels, GAME_COLORS);
  ed.edit(() => {
    ed.active = addLayer(ed.doc, name, ed.active);
    ed.layer.pixels = pixels;
  });
}

function pickFile(accept: string, then: (file: File) => void): void {
  const input = el("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = () => { if (input.files?.[0]) then(input.files[0]); };
  input.click();
}

export function files(ed: Editor, look: () => Look, fitView: () => void, report: (error: unknown) => void): HTMLElement {
  const box = el("div", "display:flex;flex-direction:column;gap:8px");
  const row = () => el("div", "display:flex;flex-wrap:wrap;gap:6px;align-items:center");
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
  make.append(select(SIZES, size, (v) => { size = v; ed.changed(); }));
  if (size === "custom") make.append(side("width"), "x", side("height"));
  make.append(button("New", () => {
    const { width, height } = size === "custom" ? custom : PRESETS[size]!;
    ed.open(newDoc(width, height));
    fitView();
  }, "Start a new drawing (Undo brings the old one back)"));
  make.append(button("Add the look's picture", () => addLook(ed, look()), "The Characters tab's look, as a layer"));

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
    button("Export PNG", () => exportPng(composite(ed.doc), fileName)),
    button("Export each layer", () => ed.doc.layers.forEach((_, i) => exportLayer(ed, i))),
    button("Save…", () => download(new Blob([docToJson(ed.doc)], { type: "application/json" }), `${fileName}.json`)),
    button("Open…", () => pickFile(".json,application/json", (f) => openFile(ed, f).then(fitView, report))),
  );
  box.append(make, bring, keep);
  return box;
}

function addLook(ed: Editor, look: Look): void {
  const square = ed.doc.width === ed.doc.height;
  const pic = square && ed.doc.width <= 32 ? drawChibi(look, "front", STARTER_CLOTHES) : drawPortrait(look, STARTER_CLOTHES);
  ed.edit(() => {
    ed.active = addLayer(ed.doc, "look", ed.active);
    ed.layer.pixels = placeImage(pic, ed.doc.width, ed.doc.height, "contain", "nearest");
  });
}
