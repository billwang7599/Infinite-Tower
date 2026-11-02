import { el } from "../dom.js";
import type { Bitmap } from "./bitmap.js";
import { projectFromJson, projectToJson, toBase64 } from "./json.js";
import { addLayer, composite, projectOf } from "./layers.js";
import { isSaveName, toSaveName } from "./names.js";
import { GAME_COLORS } from "./palette.js";
import { placeImage, snapToPalette, type Fit, type Scaling } from "./resample.js";
import { projectSheet, splitSheet } from "./sheet.js";
import type { Editor } from "./state.js";
import { toCanvas } from "./view.js";

// Smoothing a big photo straight down in JS is slow; the browser first takes it to this many times the canvas.
const PRESCALE_TIMES = 4;
const FILES_API = "/api/files";

export const importing = { scaling: "smooth" as Scaling, fit: "contain" as Fit, snap: true };
export const uploading = { cellWidth: 0, cellHeight: 0, many: "pages" as "pages" | "layers" };
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

const pngOf = (b: Bitmap) => new Promise<Blob>((done, fail) =>
  toCanvas(b).toBlob((blob) => (blob ? done(blob) : fail(new Error("Couldn't make the PNG"))), "image/png"));

export const exportPng = (b: Bitmap, name: string) => pngOf(b).then((blob) => download(blob, `${name}.png`));

export const exportLayer = (ed: Editor, index: number) => {
  const layer = ed.doc.layers[index]!;
  return exportPng(composite(ed.doc, [{ ...layer, visible: true }]), `${naming.file}-${layer.name}`);
};

export async function saveDrawing(ed: Editor): Promise<string> {
  const name = naming.file;
  if (!isSaveName(name)) throw new Error("A file name is letters, digits, - and _");
  const drawing = projectToJson(ed.mode, ed.project);
  const png = await pngOf(ed.project.pages.length === 1 ? composite(ed.doc) : projectSheet(ed.project).sheet);
  download(png, `${name}.png`);
  const res = await fetch(`${FILES_API}/${name}`, {
    method: "PUT", body: JSON.stringify({ drawing, png: toBase64(new Uint8Array(await png.arrayBuffer())) }),
  }).catch(() => null);
  if (res?.ok) return `Saved ${(await res.json() as { json: string }).json} and its .png`;
  downloadJson(drawing, name);
  return `Not saved in the repo (${res ? (await res.json().catch(() => ({})) as { error?: string }).error ?? res.status
    : "no dev server"}), only downloaded`;
}

export async function listSaved(): Promise<string[]> {
  const res = await fetch(FILES_API).catch(() => null);
  return res?.ok ? (await res.json() as { name: string }[]).map((f) => f.name) : [];
}

export async function readSaved(name: string): Promise<ReturnType<typeof projectFromJson>> {
  const res = await fetch(`${FILES_API}/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Couldn't open ${name}`);
  return projectFromJson(await res.text());
}

async function decodePhoto(file: File, width: number, height: number): Promise<Bitmap> {
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

async function decodeExact(file: File): Promise<Bitmap> {
  const image = await createImageBitmap(file, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const c = el("canvas");
  [c.width, c.height] = [image.width, image.height];
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(image, 0, 0);
  return { width: c.width, height: c.height, rgba: g.getImageData(0, 0, c.width, c.height).data };
}

const baseName = (file: File) => file.name.replace(/\.[^.]*$/, "");

export async function importPhoto(ed: Editor, file: File): Promise<void> {
  const pixels = placeImage(await decodePhoto(file, ed.doc.width, ed.doc.height), ed.doc.width, ed.doc.height,
    importing.fit, importing.scaling);
  if (importing.snap) snapToPalette(pixels, GAME_COLORS);
  ed.edit(() => {
    ed.active = addLayer(ed.project, baseName(file), ed.active);
    ed.layer.pixels = pixels;
  });
}

export async function openPictures(ed: Editor, files: readonly File[]): Promise<void> {
  const pictures = await Promise.all(files.map(async (f) => ({ name: baseName(f), pixels: await decodeExact(f) })));
  const { cellWidth: w, cellHeight: h } = uploading;
  const cut = w > 0 && h > 0;
  const parts = cut
    ? pictures.flatMap((p) => splitSheet(p.pixels, w, h).map((pixels, i) => ({ name: `${p.name} ${i + 1}`, pixels })))
    : pictures;
  const project = projectOf(parts, cut ? "pages" : uploading.many);
  const mode = project.pages.length === 1 ? ed.mode : ed.mode === "tiles" ? "tiles" : "animation";
  naming.file = toSaveName(pictures[0]!.name);
  ed.open(mode, project);
}

export async function openFiles(ed: Editor, files: readonly File[]): Promise<void> {
  const json = files.find((f) => f.name.endsWith(".json"));
  if (json) {
    const { mode, project } = projectFromJson(await json.text());
    naming.file = toSaveName(baseName(json));
    ed.open(mode, project);
    return;
  }
  const exact = files.filter((f) => f.type === "image/png" || f.type === "image/gif");
  if (exact.length > 0) return openPictures(ed, exact);
  if (files[0]) return importPhoto(ed, files[0]);
}

export function pickFiles(accept: string, then: (files: File[]) => void, multiple = false): void {
  const input = el("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = multiple;
  input.onchange = () => { if (input.files?.length) then([...input.files]); };
  input.click();
}
