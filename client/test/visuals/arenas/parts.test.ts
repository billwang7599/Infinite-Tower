import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Color3, InstancedMesh, MeshBuilder, NullEngine, Scene, TransformNode, type Mesh } from "@babylonjs/core";
import { ARENA_LOOK_IDS } from "@infinite-tower/shared";
import { ARENA_LOOKS } from "../../../src/visuals/arenas/index.js";
import { HAZE_SHARES, hazed, scatter } from "../../../src/visuals/arenas/parts.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";
import { createSky } from "../../../src/visuals/sky/sky.js";
import { stubCanvas } from "../../fixtures/canvas.js";

stubCanvas();
const arenaScene = (): ArenaScene => {
  const scene = new Scene(new NullEngine());
  return { scene, sky: createSky(scene) } as ArenaScene;
};

describe("far props in haze", () => {
  test("each further ring is lit less and glows nearer the sky's colour", () => {
    const pine = new Color3(0.1, 0.19, 0.15), sky = new Color3(0.33, 0.29, 0.31);
    const rings = HAZE_SHARES.map((share) => hazed(pine, sky, share));
    const off = (c: Color3) => Math.abs(c.r / (c.g || 1) - sky.r / sky.g);
    for (let i = 1; i < rings.length; i++) {
      assert.ok(rings[i]!.diffuse.toLuminance() < rings[i - 1]!.diffuse.toLuminance(), "lit less");
      assert.ok(rings[i]!.emissive.toLuminance() > rings[i - 1]!.emissive.toLuminance(), "glows more");
      assert.ok(off(rings[i]!.emissive) < off(rings[i - 1]!.emissive), "nearer the sky's hue");
    }
    const lit = rings[0]!.diffuse.add(rings[0]!.emissive);
    assert.ok(Math.abs(lit.g - (pine.g + (sky.g - pine.g) * HAZE_SHARES[0])) < 1e-6, "fully lit, its hazed colour");
  });
});

describe("scattered props", () => {
  test("are thin instances, one mesh a template however many are scattered", () => {
    for (const id of ARENA_LOOK_IDS) {
      const ctx = arenaScene(), root = ARENA_LOOKS[id].build(ctx, 12), meshes = root.getChildMeshes();
      assert.equal(meshes.filter((m) => m instanceof InstancedMesh).length, 0, id);
      assert.ok(meshes.filter((m) => (m as Mesh).hasThinInstances).length > 5, id);
      ctx.scene.dispose();
    }
  });

  test("each stands at its spot, its height times its scale up, turned by its yaw", () => {
    const ctx = arenaScene(), root = new TransformNode("root", ctx.scene);
    const box = MeshBuilder.CreateBox("box", { width: 2, height: 1, depth: 0.5 }, ctx.scene);
    scatter(ctx, root, [[box, 0.5]], [{ x: 3, z: -2, scale: 2, yaw: Math.PI / 2 }]);
    const { minimumWorld: lo, maximumWorld: hi } = box.getBoundingInfo().boundingBox;
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    assert.ok([[lo.x, 2.5], [lo.y, 0], [lo.z, -4], [hi.x, 3.5], [hi.y, 2], [hi.z, 0]].every(([a, b]) => near(a!, b!)),
      `${lo} ${hi}`);
    ctx.scene.dispose();
  });
});
