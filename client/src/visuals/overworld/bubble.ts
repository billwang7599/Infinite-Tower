import { Color3, DynamicTexture, StandardMaterial, type Mesh, type Scene } from "@babylonjs/core";
import { standingQuad } from "./scene.js";

const TEXTURE_PX = { width: 640, height: 176 };
const WIDTH_TILES = 4;
const HEIGHT_TILES = (WIDTH_TILES * TEXTURE_PX.height) / TEXTURE_PX.width;
const MAX_LINES = 3;
const LINE_PX = 46;
const PAD_PX = 12;
const TAIL_PX = 10;
const FONT = "500 38px system-ui, sans-serif";

export interface Bubble {
  text: string;
  mesh: Mesh;
  dispose(): void;
}

/** Its bottom, the tail's tip, is at the mesh's origin. */
export function speechBubble(scene: Scene, text: string): Bubble {
  const texture = new DynamicTexture("overworld-bubble", TEXTURE_PX, scene, true);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.font = FONT;
  const lines = wrap(ctx, text, TEXTURE_PX.width - 2 * PAD_PX);
  const widthPx = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 2 * PAD_PX;
  const heightPx = lines.length * LINE_PX + 2 * PAD_PX;
  const left = (TEXTURE_PX.width - widthPx) / 2, top = TEXTURE_PX.height - TAIL_PX - heightPx;
  const mid = TEXTURE_PX.width / 2;
  ctx.fillStyle = "rgba(242, 234, 216, 0.92)";
  ctx.strokeStyle = "rgba(10, 8, 14, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(left, top, widthPx, heightPx, 12);
  ctx.moveTo(mid - TAIL_PX, top + heightPx);
  ctx.lineTo(mid, TEXTURE_PX.height);
  ctx.lineTo(mid + TAIL_PX, top + heightPx);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1a1520";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => ctx.fillText(line, mid, top + PAD_PX + LINE_PX * (i + 0.5)));
  texture.hasAlpha = true;
  texture.update();
  const material = new StandardMaterial("overworld-bubble", scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true;
  material.emissiveColor = Color3.White();
  material.backFaceCulling = false;
  const mesh = standingQuad(scene, "overworld-bubble", WIDTH_TILES, HEIGHT_TILES);
  mesh.material = material;
  return {
    text, mesh,
    dispose() {
      mesh.dispose();
      material.dispose(false, true);
    },
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxPx: number): string[] {
  const fits = (s: string) => ctx.measureText(s).width <= maxPx;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (lines.length > MAX_LINES) break;
    if (fits(line ? `${line} ${word}` : word)) {
      line = line ? `${line} ${word}` : word;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (!fits(line) && lines.length <= MAX_LINES) {
      let cut = line.length - 1;
      while (cut > 1 && !fits(line.slice(0, cut))) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  if (lines.length <= MAX_LINES) return lines;
  let last = lines[MAX_LINES - 1]!;
  while (last && !fits(`${last}…`)) last = last.slice(0, -1);
  return [...lines.slice(0, MAX_LINES - 1), `${last}…`];
}
