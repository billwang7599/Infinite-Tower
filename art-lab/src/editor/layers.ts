import { DEFAULT_LOOK, type Look } from "@infinite-tower/shared";
import { blank, copyBitmap, type Bitmap } from "./bitmap.js";
import { stamp } from "./selection.js";

export const PARTS = ["body", "outfit", "head", "face", "hair"] as const;

export interface Layer { name: string; visible: boolean; opacity: number; pixels: Bitmap }
/** Layers bottom to top. */
export interface Doc { name: string; width: number; height: number; layers: Layer[] }
/** Pages of one size sharing one stack of layers; only their pixels differ. `fps` is for animations. */
export interface Project { pages: Doc[]; page: number; fps: number; underlay?: Underlay }

// `shots` names a SHOT_SETS entry, "" for none.
export interface Underlay {
  shots: string;
  body: Look["body"] | "all";
  face: Look["face"];
  skin: Look["skin"];
  hair: Look["hair"] | null;
  dressed: boolean;
  opacity: number;
  shown: boolean;
}

export const NO_UNDERLAY: Underlay = {
  shots: "", body: DEFAULT_LOOK.body, face: DEFAULT_LOOK.face, skin: DEFAULT_LOOK.skin, hair: null, dressed: false,
  opacity: 0.5, shown: true,
};

export const START_FPS = 8;
export const MAX_FPS = 60;
export const MAX_SIDE = 512;

const newLayer = (name: string, width: number, height: number): Layer =>
  ({ name, visible: true, opacity: 1, pixels: blank(width, height) });

export const newDoc = (width: number, height: number, layers: readonly string[] = PARTS, name = ""): Doc =>
  ({ name, width, height, layers: layers.map((layer) => newLayer(layer, width, height)) });

export const newProject = (width: number, height: number, layers: readonly string[]): Project =>
  ({ pages: [newDoc(width, height, layers)], page: 0, fps: START_FPS });

const copyDoc = (doc: Doc): Doc => ({ ...doc, layers: doc.layers.map((l) => ({ ...l, pixels: copyBitmap(l.pixels) })) });

export const copyProject = (p: Project): Project => ({ ...p, pages: p.pages.map(copyDoc) });

export const projectBytes = (p: Project) => p.pages.reduce((sum, d) => sum + d.layers.length * d.width * d.height * 4, 0);

export function projectOf(pictures: readonly { name: string; pixels: Bitmap }[], as: "layers" | "pages"): Project {
  const width = Math.max(...pictures.map((p) => p.pixels.width));
  const height = Math.max(...pictures.map((p) => p.pixels.height));
  if (width > MAX_SIDE || height > MAX_SIDE) throw new Error(`Drawings are at most ${MAX_SIDE}x${MAX_SIDE}; give a cell size`);
  const layer = ({ name, pixels }: { name: string; pixels: Bitmap }): Layer => {
    const fitted = blank(width, height);
    stamp(fitted, pixels, 0, 0);
    return { ...newLayer(name, width, height), pixels: fitted };
  };
  const pages = as === "layers"
    ? [{ name: "", width, height, layers: pictures.map(layer) }]
    : pictures.map((p) => ({ name: p.name, width, height, layers: [layer({ ...p, name: "picture" })] }));
  return { pages, page: 0, fps: START_FPS };
}

export function addPage(p: Project, after: number, copy = false): number {
  const from = p.pages[after]!;
  const page = copy ? copyDoc(from) : {
    ...from, name: "", layers: from.layers.map((l) => ({ ...l, pixels: blank(from.width, from.height) })),
  };
  p.pages.splice(after + 1, 0, page);
  return after + 1;
}

export function removePage(p: Project, index: number): void {
  if (p.pages.length > 1) p.pages.splice(index, 1);
  p.page = Math.min(p.page, p.pages.length - 1);
}

export const movePage = (p: Project, index: number, by: number) => moveIn(p.pages, index, by);

export function addLayer(p: Project, name: string, below: number): number {
  const index = Math.min(below + 1, p.pages[0]!.layers.length);
  for (const d of p.pages) d.layers.splice(index, 0, newLayer(name, d.width, d.height));
  return index;
}

export function removeLayer(p: Project, index: number): void {
  for (const d of p.pages) d.layers.splice(index, 1);
}

export function moveLayer(p: Project, index: number, by: number): number {
  let to = index;
  for (const d of p.pages) to = moveIn(d.layers, index, by);
  return to;
}

export function setLayer(p: Project, index: number, change: Partial<Omit<Layer, "pixels">>): void {
  for (const d of p.pages) Object.assign(d.layers[index]!, change);
}

function moveIn<T>(list: T[], index: number, by: number): number {
  const to = Math.max(0, Math.min(list.length - 1, index + by));
  const [item] = list.splice(index, 1);
  list.splice(to, 0, item!);
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
