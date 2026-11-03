import { el } from "../dom.js";
import type { Bitmap } from "./bitmap.js";
import { projectFromJson } from "./json.js";
import { addLayer, composite } from "./layers.js";
import { GAME_COLORS } from "./palette.js";
import { placeImage, snapToPalette, type Fit, type Scaling } from "./resample.js";
import type { Editor } from "./state.js";
import { toCanvas } from "./view.js";

// Smoothing a big photo straight down in JS is slow; the browser first takes it to this many times the canvas.
const PRESCALE_TIMES = 4;

export const importing = { scaling: "smooth" as Scaling, fit: "contain" as Fit, snap: true };
export const naming = { file: "drawing" };

export function download(blob: Blob, name: string): void {
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const downloadJson = (value: unknown, name: string) =>
  download(new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type: "application/json" }),
    `${name}.json`);

export function exportPng(b: Bitmap, name: string): void {
  toCanvas(b).toBlob((blob) => blob && download(blob, `${name}.png`));
}

export const exportLayer = (ed: Editor, index: number) => {
  const layer = ed.doc.layers[index]!;
  exportPng(composite(ed.doc, [{ ...layer, visible: true }]), `${naming.file}-${layer.name}`);
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
    const { mode, project } = projectFromJson(await file.text());
    ed.open(mode, project);
    naming.file = name;
    return;
  }
  const pixels = placeImage(await decode(file, ed.doc.width, ed.doc.height), ed.doc.width, ed.doc.height,
    importing.fit, importing.scaling);
  if (importing.snap) snapToPalette(pixels, GAME_COLORS);
  ed.edit(() => {
    ed.active = addLayer(ed.project, name, ed.active);
    ed.layer.pixels = pixels;
  });
}

export function pickFile(accept: string, then: (file: File) => void): void {
  const input = el("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = () => { if (input.files?.[0]) then(input.files[0]); };
  input.click();
}
