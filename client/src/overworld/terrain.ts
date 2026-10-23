/** Lays out the field: short grass ground, the tall-grass patch, and the tree border. */
import { MeshBuilder, type Scene } from "@babylonjs/core";
import { seededRandom, type FieldLayout } from "@infinite-tower/shared";
import { flatMaterial, layerY } from "./scene.js";
import { grassTexture, tallGrassTexture, treeTexture } from "./textures.js";

export function buildTerrain(scene: Scene, field: FieldLayout): void {
  const r = seededRandom(11);
  const W = field.halfWidth, D = field.halfDepth;

  const grassTex = grassTexture(scene, r);
  grassTex.uScale = (W * 2 + 8) / 8;
  grassTex.vScale = (D * 2 + 8) / 8;
  const ground = MeshBuilder.CreateGround("map-ground", { width: W * 2 + 8, height: D * 2 + 8 }, scene);
  ground.material = flatMaterial(scene, "map-grass", grassTex);

  const g = field.grass;
  const tallTex = tallGrassTexture(scene);
  tallTex.uScale = g.w;
  tallTex.vScale = g.h;
  const tall = MeshBuilder.CreateGround("map-tall-grass", { width: g.w, height: g.h }, scene);
  tall.position.set(g.x + g.w / 2, 0.02, g.z + g.h / 2);
  tall.material = flatMaterial(scene, "map-tall-grass", tallTex);

  // Tree border: one template quad, many instances, three rows deep on every side.
  const tree = MeshBuilder.CreatePlane("map-tree", { size: 2.4 }, scene);
  tree.rotation.x = Math.PI / 2;
  tree.material = flatMaterial(scene, "map-tree", treeTexture(scene), true);
  tree.isVisible = false;
  const place = (x: number, z: number) => {
    const t = tree.createInstance("tree");
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
}
