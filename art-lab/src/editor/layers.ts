import { blank, copyBitmap, type Bitmap } from "./bitmap.js";

export const PARTS = ["body", "outfit", "head", "face", "hair"] as const;

export interface Layer { name: string; visible: boolean; opacity: number; pixels: Bitmap }
/** Layers bottom to top. */
export interface Doc { width: number; height: number; layers: Layer[] }

export const newLayer = (name: string, width: number, height: number): Layer =>
  ({ name, visible: true, opacity: 1, pixels: blank(width, height) });

export const newDoc = (width: number, height: number): Doc =>
  ({ width, height, layers: PARTS.map((part) => newLayer(part, width, height)) });

export const copyDoc = (doc: Doc): Doc =>
  ({ ...doc, layers: doc.layers.map((l) => ({ ...l, pixels: copyBitmap(l.pixels) })) });

export function addLayer(doc: Doc, name: string, below: number): number {
  const index = Math.min(below + 1, doc.layers.length);
  doc.layers.splice(index, 0, newLayer(name, doc.width, doc.height));
  return index;
}

export function removeLayer(doc: Doc, index: number): void {
  doc.layers.splice(index, 1);
}

export function moveLayer(doc: Doc, index: number, by: number): number {
  const to = Math.max(0, Math.min(doc.layers.length - 1, index + by));
  const [layer] = doc.layers.splice(index, 1);
  doc.layers.splice(to, 0, layer!);
  return to;
}

export function composite(doc: Doc, layers: readonly Layer[] = doc.layers): Bitmap {
  const out = blank(doc.width, doc.height);
  const o = out.rgba;
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const s = layer.pixels.rgba;
    for (let i = 0; i < o.length; i += 4) {
      const sa = (s[i + 3]! / 255) * layer.opacity;
      if (sa === 0) continue;
      const da = o[i + 3]! / 255;
      const a = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) o[i + c] = (s[i + c]! * sa + o[i + c]! * da * (1 - sa)) / a;
      o[i + 3] = a * 255;
    }
  }
  return out;
}
