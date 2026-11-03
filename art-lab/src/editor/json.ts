import { START_FPS, type Doc, type Layer, type Project } from "./layers.js";
import { MODES, type Mode } from "./modes.js";

const MAX_SIDE = 512;
const MAX_FPS = 60;

const toBase64 = (bytes: Uint8ClampedArray) => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};

const fromBase64 = (text: string) => Uint8ClampedArray.from(atob(text), (ch) => ch.charCodeAt(0));

export const projectToJson = (mode: Mode, p: Project) => JSON.stringify({
  mode, fps: p.fps,
  pages: p.pages.map((d) => ({
    name: d.name, width: d.width, height: d.height,
    layers: d.layers.map((l) => ({ name: l.name, visible: l.visible, opacity: l.opacity, pixels: toBase64(l.pixels.rgba) })),
  })),
});

export function projectFromJson(text: string): { mode: Mode; project: Project } {
  const raw = JSON.parse(text) as { mode?: unknown; pages?: unknown; fps?: unknown };
  if (!MODES.includes(raw.mode as Mode) || !Array.isArray(raw.pages) || raw.pages.length === 0) {
    throw new Error("Not a drawing saved by the art lab");
  }
  const pages = raw.pages.map(docFrom);
  const { width, height } = pages[0]!;
  if (pages.some((d) => d.width !== width || d.height !== height || d.layers.length !== pages[0]!.layers.length)) {
    throw new Error("The pages don't match in size or layers");
  }
  const fps = typeof raw.fps === "number" ? Math.max(1, Math.min(MAX_FPS, Math.round(raw.fps))) : START_FPS;
  return { mode: raw.mode as Mode, project: { pages, page: 0, fps } };
}

function docFrom(raw: Record<string, unknown>): Doc {
  const { width, height, layers } = raw;
  if (!isSide(width) || !isSide(height) || !Array.isArray(layers) || layers.length === 0) {
    throw new Error("Not a drawing saved by the art lab");
  }
  return { name: String(raw.name ?? ""), width, height, layers: layers.map((l: Record<string, unknown>): Layer => {
    const rgba = typeof l.pixels === "string" ? fromBase64(l.pixels) : null;
    if (!rgba || rgba.length !== width * height * 4) throw new Error("A layer's pixels don't fit the drawing");
    return {
      name: String(l.name ?? "layer"), visible: l.visible !== false,
      opacity: typeof l.opacity === "number" ? Math.max(0, Math.min(1, l.opacity)) : 1,
      pixels: { width, height, rgba },
    };
  }) };
}

const isSide = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_SIDE;
