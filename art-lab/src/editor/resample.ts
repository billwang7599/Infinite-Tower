import { blank, getPixel, setPixel, type Bitmap, type Rgba } from "./bitmap.js";
import { stamp } from "./selection.js";

export type Scaling = "nearest" | "smooth";
export type Fit = "contain" | "cover" | "stretch";

export function resize(src: Bitmap, width: number, height: number, scaling: Scaling): Bitmap {
  const out = blank(width, height);
  const sx = src.width / width, sy = src.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (scaling === "nearest") {
        setPixel(out, x, y, getPixel(src, Math.floor((x + 0.5) * sx), Math.floor((y + 0.5) * sy)));
        continue;
      }
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let v = y0; v < y1; v++) {
        for (let u = x0; u < x1; u++) {
          const p = getPixel(src, u, v);
          r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3]; n++;
        }
      }
      if (a > 0) setPixel(out, x, y, [r / a, g / a, b / a, a / n]);
    }
  }
  return out;
}

export function placeImage(src: Bitmap, width: number, height: number, fit: Fit, scaling: Scaling): Bitmap {
  if (fit === "stretch") return resize(src, width, height, scaling);
  const pick = fit === "contain" ? Math.min : Math.max;
  const scale = pick(width / src.width, height / src.height);
  const w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
  const out = blank(width, height);
  stamp(out, resize(src, w, h, scaling), Math.floor((width - w) / 2), Math.floor((height - h) / 2));
  return out;
}

export function snapToPalette(b: Bitmap, palette: readonly Rgba[], alphaCut = 128): void {
  const cache = new Map<number, Rgba>();
  for (let i = 0; i < b.rgba.length; i += 4) {
    if (b.rgba[i + 3]! < alphaCut) { b.rgba.fill(0, i, i + 4); continue; }
    const key = (b.rgba[i]! << 16) | (b.rgba[i + 1]! << 8) | b.rgba[i + 2]!;
    let best = cache.get(key);
    if (!best) {
      best = nearest(palette, b.rgba[i]!, b.rgba[i + 1]!, b.rgba[i + 2]!);
      cache.set(key, best);
    }
    b.rgba.set([best[0], best[1], best[2], 255], i);
  }
}

// "Redmean": a cheap distance that weighs red and blue by how red the pair is, closer to how eyes see it than RGB.
function nearest(palette: readonly Rgba[], r: number, g: number, b: number): Rgba {
  let best = palette[0]!, bestDistance = Infinity;
  for (const c of palette) {
    const mean = (r + c[0]) / 2, dr = r - c[0], dg = g - c[1], db = b - c[2];
    const d = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (d < bestDistance) { best = c; bestDistance = d; }
  }
  return best;
}
