/** Draws a "grass-field" level: short grass ground, the tall-grass patches and the tree border, in pixel art. */
import { MeshBuilder, TransformNode, type DynamicTexture, type Scene } from "@babylonjs/core";
import { seededRandom, type LevelLayout } from "@infinite-tower/shared";
import { pixelMaterial } from "../../sprites.js";
import { pixelTexture } from "../../textures.js";
import { layerY } from "../scene.js";

/** Tiles across the short-grass texture (16 texels a tile): big enough that the repeat isn't obvious. */
const GRASS_TEXTURE_TILES = 8;

export function buildGrassField(scene: Scene, level: LevelLayout): TransformNode {
  const root = new TransformNode(`level-${level.id}`, scene);
  const rand = seededRandom(11);
  const halfW = level.halfWidth, halfD = level.halfDepth;

  // The ground reaches 4 tiles past the edge on every side, under the tree border.
  const groundW = halfW * 2 + 8, groundD = halfD * 2 + 8;
  const grassTex = grassTexture(scene, rand);
  grassTex.uScale = groundW / GRASS_TEXTURE_TILES;
  grassTex.vScale = groundD / GRASS_TEXTURE_TILES;
  const ground = MeshBuilder.CreateGround("overworld-ground", { width: groundW, height: groundD }, scene);
  ground.material = pixelMaterial(scene, "overworld-grass", grassTex, { unlit: true, cutout: false });
  ground.parent = root;

  level.grass.forEach((g, i) => {
    const tallTex = tallGrassTexture(scene);
    tallTex.uScale = g.w;
    tallTex.vScale = g.h;
    const tall = MeshBuilder.CreateGround(`overworld-tall-grass-${i}`, { width: g.w, height: g.h }, scene);
    tall.position.set(g.x + g.w / 2, 0.02, g.z + g.h / 2);
    tall.material = pixelMaterial(scene, `overworld-tall-grass-${i}`, tallTex, { unlit: true, cutout: false });
    tall.parent = root;
  });

  // Tree border: one template quad, many instances, three rows deep on every side.
  const tree = MeshBuilder.CreatePlane("overworld-tree", { size: 2.4 }, scene);
  tree.rotation.x = Math.PI / 2;
  tree.material = pixelMaterial(scene, "overworld-tree", treeTexture(scene), { unlit: true });
  tree.isVisible = false;
  tree.parent = root;
  const place = (x: number, z: number) => {
    const t = tree.createInstance("tree");
    t.parent = root;
    t.position.set(x, layerY(z, 1), z);
    t.rotation.x = Math.PI / 2;
    const s = 0.85 + rand() * 0.35;
    t.scaling.set(s, s, s);
  };
  for (let x = -halfW - 3; x <= halfW + 3; x += 1.5) {
    for (const z of [halfD + 0.3, halfD + 1.8, halfD + 3.3]) place(x + rand() * 0.5, z);
    for (const z of [-halfD - 0.3, -halfD - 1.8, -halfD - 3.3]) place(x + rand() * 0.5, z);
  }
  for (let z = -halfD; z <= halfD; z += 1.5) {
    for (const x of [halfW + 0.3, halfW + 1.8, halfW + 3.3]) place(x, z + rand() * 0.5);
    for (const x of [-halfW - 0.3, -halfW - 1.8, -halfW - 3.3]) place(x, z + rand() * 0.5);
  }
  return root;
}

/** Short grass, GRASS_TEXTURE_TILES square. */
function grassTexture(scene: Scene, rand: () => number): DynamicTexture {
  return pixelTexture(scene, "grass", 128, (ctx) => {
    ctx.fillStyle = "#5fa84e";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 560; i++) {
      ctx.fillStyle = ["#6fbb5a", "#529646", "#79c463", "#4b8c40"][Math.floor(rand() * 4)]!;
      ctx.fillRect(Math.floor(rand() * 128), Math.floor(rand() * 128), 1 + Math.floor(rand() * 2), 1);
    }
    for (let i = 0; i < 9; i++) { // little flowers
      const x = 1 + Math.floor(rand() * 124), y = 1 + Math.floor(rand() * 124);
      ctx.fillStyle = rand() < 0.5 ? "#f4f0d8" : "#f2c94c";
      for (const [dx, dy] of [[0, 0], [1, 1], [1, -1], [2, 0]] as const) ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}

/** Tall grass: one tile, four dense tufts. */
function tallGrassTexture(scene: Scene): DynamicTexture {
  return pixelTexture(scene, "tall-grass", 16, (ctx) => {
    ctx.fillStyle = "#3d7f36";
    ctx.fillRect(0, 0, 16, 16);
    const tuft = (x: number, y: number) => {
      ctx.fillStyle = "#2c6128"; ctx.fillRect(x, y + 5, 7, 2);
      ctx.fillStyle = "#62b24f";
      ctx.fillRect(x, y + 1, 1, 4); ctx.fillRect(x + 3, y, 1, 5); ctx.fillRect(x + 6, y + 1, 1, 4);
      ctx.fillStyle = "#86d06a";
      ctx.fillRect(x + 1, y + 2, 1, 3); ctx.fillRect(x + 4, y + 1, 1, 3); ctx.fillRect(x + 5, y + 3, 1, 2);
    };
    tuft(0, 1); tuft(8, 9); tuft(9, 0); tuft(1, 9);
  });
}

/** A round tree seen from above (transparent background). */
function treeTexture(scene: Scene): DynamicTexture {
  const tex = pixelTexture(scene, "tree", 32, (ctx) => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "#5b3b22"; ctx.fillRect(13, 22, 6, 9); // trunk
    const blob = (cx: number, cy: number, rad: number, color: string) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    };
    blob(16, 14, 12, "#1f4a24"); blob(15, 12, 10, "#2f6b2f"); blob(13, 10, 6, "#3f8a3a"); blob(11, 8, 2.5, "#5aa64c");
  });
  tex.hasAlpha = true;
  return tex;
}
