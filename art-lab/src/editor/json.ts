import type { Doc, Layer } from "./layers.js";

const MAX_SIDE = 512;

const toBase64 = (bytes: Uint8ClampedArray) => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};

const fromBase64 = (text: string) => Uint8ClampedArray.from(atob(text), (ch) => ch.charCodeAt(0));

export const docToJson = (doc: Doc) => JSON.stringify({
  width: doc.width, height: doc.height,
  layers: doc.layers.map((l) => ({ name: l.name, visible: l.visible, opacity: l.opacity, pixels: toBase64(l.pixels.rgba) })),
});

export function docFromJson(text: string): Doc {
  const raw = JSON.parse(text) as { width?: unknown; height?: unknown; layers?: unknown };
  const { width, height, layers } = raw;
  if (!isSide(width) || !isSide(height) || !Array.isArray(layers) || layers.length === 0) {
    throw new Error("Not a drawing saved by the art lab");
  }
  return { width, height, layers: layers.map((l: Record<string, unknown>): Layer => {
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
