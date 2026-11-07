import { wordKind, type SkilledData, type Vec3, type WordKind } from "@infinite-tower/shared";
import type { ScreenPoint } from "./overlay.js";

const AHEAD_M = 0.8;
const ABOVE_CENTER_M = 0.9;
const HEIGHT_M = 0.42;
// The px are a drawing TALL_PX tall, shown HEIGHT_M tall.
const SQUARES = 5;
const SQUARE_PX = 96;
const GAP_PX = 12;
const MAX_FONT_PX = 34;
const WIDTH_PX = SQUARES * (SQUARE_PX + GAP_PX);
const TALL_PX = SQUARE_PX + GAP_PX;
const KIND_COLOR: Record<WordKind, string> = { form: "#e8c45a", element: "#7dd3fc", modifier: "#f0abfc" };

export function drawChantWords(
  g: CanvasRenderingContext2D, project: (at: Vec3) => ScreenPoint | null, skilled: SkilledData, from: Vec3,
): void {
  const { aim } = skilled;
  const at = project({ x: from.x + aim.x * AHEAD_M, y: from.y + ABOVE_CENTER_M, z: from.z + aim.z * AHEAD_M });
  if (!at) return;
  const scale = (at.pxPerM * HEIGHT_M) / TALL_PX;
  g.setTransform(scale, 0, 0, scale, at.x - (WIDTH_PX * scale) / 2, at.y - (TALL_PX * scale) / 2);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 4;
  const shown = [...skilled.words.slice(-(SQUARES - 1)), null];
  shown.forEach((word, i) => {
    const x = GAP_PX / 2 + (SQUARES - shown.length + i) * (SQUARE_PX + GAP_PX), y = GAP_PX / 2;
    g.fillStyle = "rgba(11, 13, 26, 0.75)";
    g.fillRect(x, y, SQUARE_PX, SQUARE_PX);
    g.strokeStyle = word ? KIND_COLOR[wordKind(word)] : "rgba(255, 255, 255, 0.35)";
    g.setLineDash(word ? [] : [10, 8]);
    g.strokeRect(x, y, SQUARE_PX, SQUARE_PX);
    if (!word) return;
    g.fillStyle = "#ffffff";
    let fontPx = MAX_FONT_PX;
    do g.font = `bold ${fontPx--}px sans-serif`;
    while (g.measureText(word).width > SQUARE_PX - GAP_PX);
    g.fillText(word, x + SQUARE_PX / 2, y + SQUARE_PX / 2);
  });
  g.setLineDash([]);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
