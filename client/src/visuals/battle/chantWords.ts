import { DynamicTexture, Mesh, MeshBuilder, StandardMaterial, type Scene, type TransformNode } from "@babylonjs/core";
import { wordKind, type SkilledData, type Word, type WordKind } from "@infinite-tower/shared";

const AHEAD_M = 0.8;
const ABOVE_CENTER_M = 0.9;
const HEIGHT_M = 0.42;
const SQUARES = 5;
const SQUARE_PX = 96;
const GAP_PX = 12;
const MAX_FONT_PX = 34;
const WIDTH_PX = SQUARES * (SQUARE_PX + GAP_PX);
const KIND_COLOR: Record<WordKind, string> = { form: "#e8c45a", element: "#7dd3fc", modifier: "#f0abfc" };

export interface ChantWords { plane: Mesh; texture: DynamicTexture; painted: string }

export function drawChantWords(
  scene: Scene, w: ChantWords | null, skilled: SkilledData, node: TransformNode,
): ChantWords | null {
  if (!skilled.chanting) return dropChantWords(w);
  w ??= createChantWords(scene);
  const painted = skilled.words.join(" ");
  if (painted !== w.painted) {
    paint(w.texture, skilled.words);
    w.painted = painted;
  }
  const { x, y, z } = node.position;
  w.plane.position.set(x + skilled.aim.x * AHEAD_M, y + ABOVE_CENTER_M, z + skilled.aim.z * AHEAD_M);
  return w;
}

export function dropChantWords(w: ChantWords | null): null {
  if (w) {
    w.plane.material?.dispose();
    w.texture.dispose();
    w.plane.dispose();
  }
  return null;
}

function createChantWords(scene: Scene): ChantWords {
  const plane = MeshBuilder.CreatePlane("chant-words", { width: HEIGHT_M * SQUARES, height: HEIGHT_M }, scene);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.renderingGroupId = 1;
  const texture = new DynamicTexture("chant-words", { width: WIDTH_PX, height: SQUARE_PX + GAP_PX }, scene, true);
  texture.hasAlpha = true;
  const material = new StandardMaterial("chant-words", scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true;
  material.backFaceCulling = false;
  plane.material = material;
  paint(texture, []);
  return { plane, texture, painted: "" };
}

function paint(texture: DynamicTexture, words: readonly Word[]): void {
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, WIDTH_PX, SQUARE_PX + GAP_PX);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  const shown = [...words.slice(-(SQUARES - 1)), null];
  shown.forEach((word, i) => {
    const x = GAP_PX / 2 + (SQUARES - shown.length + i) * (SQUARE_PX + GAP_PX), y = GAP_PX / 2;
    ctx.fillStyle = "rgba(11, 13, 26, 0.75)";
    ctx.fillRect(x, y, SQUARE_PX, SQUARE_PX);
    ctx.strokeStyle = word ? KIND_COLOR[wordKind(word)] : "rgba(255, 255, 255, 0.35)";
    ctx.setLineDash(word ? [] : [10, 8]);
    ctx.strokeRect(x, y, SQUARE_PX, SQUARE_PX);
    if (!word) return;
    ctx.fillStyle = "#ffffff";
    let fontPx = MAX_FONT_PX;
    do ctx.font = `bold ${fontPx--}px sans-serif`;
    while (ctx.measureText(word).width > SQUARE_PX - GAP_PX);
    ctx.fillText(word, x + SQUARE_PX / 2, y + SQUARE_PX / 2);
  });
  texture.update();
}
