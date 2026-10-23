/** Draws a "grass-field" level: short grass ground, the tall-grass patches, and the tree border. */
import { MeshBuilder, TransformNode, type Scene } from "@babylonjs/core";
import { seededRandom, type LevelLayout } from "@infinite-tower/shared";
import { pixelMaterial } from "../../../gfx/sprites.js";
import { layerY } from "../../scene.js";
import { grassTexture, tallGrassTexture, treeTexture } from "./textures.js";

export function buildGrassField(scene: Scene, level: LevelLayout): TransformNode {
  const root = new TransformNode(`level-${level.id}`, scene);
  const r = seededRandom(11);
  const W = level.halfWidth, D = level.halfDepth;

  const grassTex = grassTexture(scene, r);
  grassTex.uScale = (W * 2 + 8) / 8;
  grassTex.vScale = (D * 2 + 8) / 8;
  const ground = MeshBuilder.CreateGround("field-ground", { width: W * 2 + 8, height: D * 2 + 8 }, scene);
  ground.material = pixelMaterial(scene, "field-grass", grassTex, { unlit: true, cutout: false });
  ground.parent = root;

  level.grass.forEach((g, i) => {
    const tallTex = tallGrassTexture(scene);
    tallTex.uScale = g.w;
    tallTex.vScale = g.h;
    const tall = MeshBuilder.CreateGround(`field-tall-grass-${i}`, { width: g.w, height: g.h }, scene);
    tall.position.set(g.x + g.w / 2, 0.02, g.z + g.h / 2);
    tall.material = pixelMaterial(scene, `field-tall-grass-${i}`, tallTex, { unlit: true, cutout: false });
    tall.parent = root;
  });

  // Tree border: one template quad, many instances, three rows deep on every side.
  const tree = MeshBuilder.CreatePlane("field-tree", { size: 2.4 }, scene);
  tree.rotation.x = Math.PI / 2;
  tree.material = pixelMaterial(scene, "field-tree", treeTexture(scene), { unlit: true });
  tree.isVisible = false;
  tree.parent = root;
  const place = (x: number, z: number) => {
    const t = tree.createInstance("tree");
    t.parent = root;
    t.position.set(x, layerY(z, 1), z);
    t.rotation.x = Math.PI / 2;
    const s = 0.85 + r() * 0.35;
    t.scaling.set(s, s, s);
  };
  for (let x = -W - 3; x <= W + 3; x += 1.5) {
    for (const z of [D + 0.3, D + 1.8, D + 3.3]) place(x + r() * 0.5, z);
    for (const z of [-D - 0.3, -D - 1.8, -D - 3.3]) place(x + r() * 0.5, z);
  }
  for (let z = -D; z <= D; z += 1.5) {
    for (const x of [W + 0.3, W + 1.8, W + 3.3]) place(x, z + r() * 0.5);
    for (const x of [-W - 0.3, -W - 1.8, -W - 3.3]) place(x, z + r() * 0.5);
  }
  return root;
}
