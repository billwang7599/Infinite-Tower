import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { ACCENTS, EYES, FIXED, HAIR, type Ramp } from "../src/gfx/look/palette.js";

export const SOURCES = fileURLToPath(new URL("../art/sd/", import.meta.url));
const OUTPUT = fileURLToPath(new URL("../src/gfx/look/base.ts", import.meta.url));
const SIZE = 64;

interface Image {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export function readPng(path: string): Image {
  const file = readFileSync(path);
  let width = 0, height = 0, depth = 0, type = 0, palette: Buffer | null = null;
  const data: Buffer[] = [];
  for (let at = 8; at < file.length;) {
    const length = file.readUInt32BE(at), kind = file.toString("latin1", at + 4, at + 8);
    const body = file.subarray(at + 8, at + 8 + length);
    if (kind === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]!; type = body[9]!;
      if (body[12]) throw new Error(`${path}: interlaced PNGs aren't read`);
    } else if (kind === "PLTE") palette = body;
    else if (kind === "IDAT") data.push(body);
    at += 12 + length;
  }
  if (depth !== 8) throw new Error(`${path}: only 8-bit PNGs are read`);
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!channels) throw new Error(`${path}: PNG color type ${type}`);
  const raw = inflateSync(Buffer.concat(data)), stride = width * channels;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= channels ? pixels[y * stride + x - channels]! : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels]! : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predicted = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]!;
      pixels[y * stride + x] = (v + predicted) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = pixels.subarray(i * channels, (i + 1) * channels);
    const rgb = type === 3 ? [...palette!.subarray(p[0]! * 3, p[0]! * 3 + 3)]
      : channels < 3 ? [p[0]!, p[0]!, p[0]!] : [...p.subarray(0, 3)];
    rgba.set([...rgb, channels === 4 ? p[3]! : channels === 2 ? p[1]! : 255], i * 4);
  }
  return { width, height, rgba };
}

const CHARS = {
  skin: "abcdef", cloth: "ghijkl", hair: "mnopqr", iris: "stuvwx", white: "yzABCD", line: "EFGHIJ", mouth: "KLMNOP",
  blush: "QRSTUV", accent: "WXYZ01",
} as const;
type Material = keyof typeof CHARS;

type Reading = readonly (readonly string[])[];
const ramp = (r: Ramp): Reading => r.map((c) => [c]);
const READ: Record<Material, Reading> = {
  skin: [
    ["#3a2626"], ["#887775", "#9f837f", "#564a4e"], ["#dcc0b6", "#ceb0a9", "#b79d98"], ["#fde9de"], ["#fef4ee"], [],
  ],
  cloth: [["#0c1a26"], ["#4d6680", "#162a3b"], ["#8fa8c1", "#80a9cd", "#7ca3ce"], ["#ebf4f9", "#feffff"], [], []],
  hair: ramp(HAIR.brown), iris: ramp(EYES.blue), white: ramp(FIXED.white), line: ramp(FIXED.line),
  mouth: ramp(FIXED.mouth), blush: ramp(FIXED.blush), accent: ramp(ACCENTS.cyan),
};
const sourceColors = () => Object.fromEntries((["skin", "cloth", "hair", "iris", "accent"] as const).map((m) => {
  const tones = READ[m];
  return [m, tones.map((c, i) => c[0] ?? tones.slice(0, i).reverse().find((t) => t[0])![0]!)];
}));
// Hair and eyes came out in whatever color Stable Diffusion liked: each picture's is read with the ramp it fits best.
const FITTED: Partial<Record<Material, readonly Ramp[]>> = { hair: Object.values(HAIR), iris: Object.values(EYES) };

type Kind = "body" | "head" | "hair" | "eyes" | "mouth";
const MATERIALS: Record<Kind, readonly Material[]> = {
  body: ["skin", "cloth"],
  head: ["skin", "cloth"],
  hair: ["hair", "skin", "cloth", "accent"],
  eyes: ["line", "white", "iris", "skin"],
  mouth: ["line", "mouth", "white", "skin", "blush"],
};

type Rgb = readonly [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbAt = (im: Image, i: number): Rgb => [im.rgba[i * 4]!, im.rgba[i * 4 + 1]!, im.rgba[i * 4 + 2]!];
export function distance([r1, g1, b1]: Rgb, [r2, g2, b2]: Rgb): number {
  const r = (r1 + r2) / 2;
  return Math.sqrt((2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2);
}
const luma = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;
const DARK_LUMA = 24;
const TIE_ROWS = 30;
/** Further apart than this, a part's pixel is something it drew, not the base showing through. */
const CHANGED = 45;

const isBackground = ([r, g, b]: Rgb) => Math.min(r, g, b) > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 14;

export function outside(im: Image): Uint8Array {
  const seen = new Uint8Array(SIZE * SIZE), stack: number[] = [];
  // Not from the bottom edge: the bust runs off it, its white bodysuit as white as the background.
  for (let i = 0; i < SIZE; i++) stack.push(i, i * SIZE, i * SIZE + SIZE - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i] || !isBackground(rgbAt(im, i))) continue;
    seen[i] = 1;
    const x = i % SIZE, y = Math.floor(i / SIZE);
    if (x > 0) stack.push(i - 1);
    if (x < SIZE - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - SIZE);
    if (y < SIZE - 1) stack.push(i + SIZE);
  }
  return seen;
}

type Pixel = readonly [Material, number] | null;

function classify(im: Image, take: (i: number) => boolean, kind: Kind): Pixel[] {
  const allowed = MATERIALS[kind], outlined = kind !== "eyes" && kind !== "mouth";
  const reads = { ...READ };
  const candidatesOf = () => allowed
    .flatMap((m) => reads[m].flatMap((colors, tone) => colors.map((h) => ({ m, tone, rgb: hex(h) }))))
    .filter(({ tone, m }) => tone > 0 || !outlined || m === "line");
  const colors = Array.from({ length: SIZE * SIZE }, (_, i) => i)
    .filter((i) => take(i) && (!outlined || luma(rgbAt(im, i)) >= DARK_LUMA)).map((i) => rgbAt(im, i));
  const error = () => {
    const candidates = candidatesOf();
    return colors.reduce((sum, rgb) => sum + Math.min(...candidates.map((c) => distance(rgb, c.rgb))), 0);
  };
  for (const m of allowed) {
    const options = FITTED[m];
    if (!options) continue;
    reads[m] = options.map((r) => { reads[m] = ramp(r); return { read: reads[m], e: error() }; })
      .sort((a, b) => a.e - b.e)[0]!.read;
  }
  const candidates = candidatesOf();
  let dark: number[] = [];
  const out: Pixel[] = Array.from({ length: SIZE * SIZE }, (_, i) => {
    if (!take(i)) return null;
    const rgb = rgbAt(im, i);
    if (outlined && luma(rgb) < DARK_LUMA) {
      dark.push(i);
      return null;
    }
    let best = candidates[0]!, bestDistance = Infinity;
    // Light brown hair is nearer skin's shadows than hair's light tones (real skin is lighter), and the blue
    // bodysuit nearer a cyan tie (ties are up on the head).
    const skinless = kind === "hair" && luma(rgb) < 170, low = i >= TIE_ROWS * SIZE;
    for (const c of candidates) {
      if ((skinless && c.m === "skin") || (low && c.m === "accent")) continue;
      const d = distance(rgb, c.rgb);
      if (d < bestDistance) { best = c; bestDistance = d; }
    }
    return [best.m, best.tone];
  });
  // Dark pixels are the outline of whatever material they border most; in hair, of the hair.
  if (kind === "hair") dark = dark.filter((i) => { out[i] = ["hair", 0]; return false; });
  while (dark.length) {
    const found = dark.flatMap((i) => {
      const x = i % SIZE, counts = new Map<Material, number>();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const q = x + dx >= 0 && x + dx < SIZE ? out[i + dy * SIZE + dx] : null;
        if ((dx || dy) && q) counts.set(q[0], (counts.get(q[0]) ?? 0) + 1);
      }
      const best = [...counts].sort((a, b) => b[1] - a[1])[0];
      return best ? [[i, best[0]] as const] : [];
    });
    if (!found.length) break;
    for (const [i, m] of found) out[i] = [m, 0];
    dark = dark.filter((i) => !out[i]);
  }
  for (const i of dark) out[i] = [allowed[0]!, 0];
  if (kind === "hair") centerTones(out, "hair");
  return out;
}

function centerTones(pixels: Pixel[], material: Material): void {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const p of pixels) if (p?.[0] === material && p[1] > 0) counts[p[1]]!++;
  const shift = 3 - counts.indexOf(Math.max(...counts));
  pixels.forEach((p, i) => {
    if (p?.[0] === material && p[1] > 0) pixels[i] = [material, Math.min(5, Math.max(1, p[1] + shift))];
  });
}

interface Grid {
  x: number;
  y: number;
  rows: string[];
}

function grid(pixels: readonly Pixel[]): Grid {
  const at = pixels.flatMap((p, i) => (p ? [i] : []));
  if (!at.length) return { x: 0, y: 0, rows: [] };
  const xs = at.map((i) => i % SIZE), ys = at.map((i) => Math.floor(i / SIZE));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    let row = "";
    for (let x = x0; x <= x1; x++) {
      const p = pixels[y * SIZE + x];
      row += p ? CHARS[p[0]][p[1]] : ".";
    }
    rows.push(row);
  }
  return { x: x0, y: y0, rows };
}

const load = (name: string) => readPng(`${SOURCES}${name}.png`);
const maskOf = (name: string) => {
  const im = load(`mask-${name}`);
  return (i: number) => im.rgba[i * 4]! > 127;
};

const PARTS = {
  hair: { short: "hair", bob: "hair", long: "hairlong", ponytail: "hairlong" },
  eyes: { round: "eyes", sharp: "eyes", sleepy: "eyes", cat: "eyes" },
  mouth: { smile: "mouth", flat: "mouth", grin: "mouth", cat: "mouth", pout: "mouth" },
} as const;
const BODY_SOURCES = { skinny: "body-skinny", medium: "base", wide: "body-wide" } as const;
const FACE_SOURCES = { soft: "base", sharp: "face-sharp", square: "face-square" } as const;

function erode(mask: (i: number) => boolean, by: number): (i: number) => boolean {
  return (i) => {
    const x = i % SIZE, y = Math.floor(i / SIZE);
    for (let dy = -by; dy <= by; dy++) for (let dx = -by; dx <= by; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > by) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || !mask(ny * SIZE + nx)) return false;
    }
    return true;
  };
}

function trace() {
  const base = load("base"), baseOutside = outside(base), head = maskOf("head"), jaw = maskOf("jaw");
  const bodies = Object.fromEntries(Object.entries(BODY_SOURCES).map(([name, source]) => {
    const im = load(source), out = outside(im);
    return [name, grid(classify(im, (i) => !out[i] && !head(i), "body"))];
  }));
  const heads = Object.fromEntries(Object.entries(FACE_SOURCES).map(([name, source]) => {
    const im = load(source), out = outside(im);
    return [name, grid(classify(im, (i) => !out[i] && (head(i) || jaw(i)), "head"))];
  }));
  const changed = (im: Image, mask: (i: number) => boolean) => (i: number) =>
    mask(i) && !isBackground(rgbAt(im, i)) && distance(rgbAt(im, i), rgbAt(base, i)) > CHANGED;
  // Eyes and mouths keep clear of the head's edge, which differs between face shapes.
  const inner = erode(head, 3);
  const hair = Object.fromEntries(Object.entries(PARTS.hair).map(([name, mask]) => {
    const im = load(`hair-${name}`), area = maskOf(mask), drawn = changed(im, area);
    // The base's outline where the hair's runs over it is the hair's outline now.
    const near = (i: number) => [-SIZE - 1, -SIZE, -SIZE + 1, -1, 1, SIZE - 1, SIZE, SIZE + 1]
      .some((d) => Math.abs((i % SIZE) - ((i + d) % SIZE)) <= 1 && drawn(i + d));
    // Under the soft chin, lines drawn into the background are the chin's, which other face shapes don't share.
    const underChin = (i: number) => i % SIZE >= 18 && i % SIZE <= 38 && i >= 30 * SIZE;
    const pixels = classify(im, (i) => !underChin(i) &&
      (drawn(i) || (luma(rgbAt(im, i)) < DARK_LUMA && near(i) && !baseOutside[i])), "hair");
    const only = (keep: (p: readonly [Material, number], i: number) => boolean) =>
      grid(pixels.map((p, i) => (p && keep(p, i) ? p : null)));
    return [name, {
      back: only(([m], i) => (m === "hair" || m === "accent") && !!baseOutside[i]),
      front: only(([m], i) => (m === "hair" || m === "accent") && !baseOutside[i]),
      shade: only(([m], i) => m === "skin" && !baseOutside[i]),
      // Where the hair sits inside the base's head, Stable Diffusion painted background over the bald crown.
      cut: grid(Array.from({ length: SIZE * SIZE }, (_, i) =>
        area(i) && head(i) && isBackground(rgbAt(im, i)) ? ["skin", 0] as const : null)),
    }];
  }));
  const face = (kind: "eyes" | "mouth") => Object.fromEntries(Object.entries(PARTS[kind]).map(([name, mask]) => {
    const im = load(`${kind}-${name}`), area = maskOf(mask);
    const pixels = classify(im, changed(im, (i) => area(i) && inner(i)), kind);
    if (kind === "eyes") browsToHair(pixels);
    return [name, grid(pixels)];
  }));
  return { body: bodies, head: heads, hair, eyes: face("eyes"), mouth: face("mouth") };
}

function browsToHair(pixels: Pixel[]): void {
  const rowOf = (i: number) => Math.floor(i / SIZE);
  const lines = new Set(pixels.flatMap((p, i) => (p?.[0] === "line" ? [rowOf(i)] : [])));
  let top = Math.min(...pixels.flatMap((p, i) => (p && (p[0] === "white" || p[0] === "iris") ? [rowOf(i)] : [])));
  while (lines.has(top - 1)) top--;
  pixels.forEach((p, i) => {
    if (!p || rowOf(i) >= top) return;
    if (p[0] === "line") pixels[i] = ["hair", Math.min(p[1], 2)];
    else if (p[0] === "skin" && p[1] <= 1) pixels[i] = ["hair", 1];
  });
}

const pictures = () => ({
  body: BODY_SOURCES, face: FACE_SOURCES,
  ...Object.fromEntries(Object.entries(PARTS).map(([part, options]) =>
    [part, Object.fromEntries(Object.keys(options).map((option) => [option, `${part}-${option}`]))])),
});

export function source(): string {
  const legend = Object.entries(CHARS).flatMap(([m, chars]) => [...chars].map((c, tone) => `${c}: ["${m}", ${tone}]`));
  const lines = [
    "// Generated by client/scripts/trace-portraits.ts from the Stable Diffusion pictures in client/art/sd/.",
    "// Don't edit: change the pictures and run `npm run trace -w @infinite-tower/client`.",
    'import type { Ramp } from "./palette.js";',
    'import type { Ink } from "./pixels.js";',
    "",
    "export interface Traced {",
    "  x: number;",
    "  y: number;",
    "  rows: readonly string[];",
    "}",
    "",
    "// The pictures' own colors, to compare the traced art with them.",
    `export const TRACED_COLORS: Readonly<Record<string, Ramp>> = ${literal(sourceColors(), "")};`,
    "",
    "export const TRACED_INKS: Readonly<Record<string, Ink>> = {",
    ...chunk(legend, 6).map((l) => `  ${l.join(", ")},`),
    "};",
    "",
    "// The picture each look option was traced from.",
    `export const TRACED_PICTURES = ${literal(pictures(), "")} as const;`,
    "",
    `export const TRACED = ${literal(trace(), "")} as const;`,
    "",
  ];
  return lines.join("\n");
}

const chunk = <T>(list: T[], n: number) =>
  Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

function literal(value: unknown, indent: string): string {
  const inner = indent + "  ";
  if (Array.isArray(value)) {
    const json = value.map((v) => JSON.stringify(v));
    if (value.every((v) => typeof v === "string" && v.startsWith("#"))) return `[${json.join(", ")}]`;
    return value.length ? `[\n${json.map((v) => `${inner}${v},`).join("\n")}\n${indent}]` : "[]";
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if ("rows" in value) {
      const { x, y, rows } = value as Grid;
      return `{ x: ${x}, y: ${y}, rows: ${literal(rows, indent)} }`;
    }
    return `{\n${entries.map(([k, v]) => `${inner}${k}: ${literal(v, inner)},`).join("\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  writeFileSync(OUTPUT, source());
  console.log(`wrote ${OUTPUT}`);
}
