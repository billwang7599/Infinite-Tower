import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { LOOK_OPTIONS } from "@infinite-tower/shared";
import { SPRITE_SIZE } from "../../../../src/visuals/battle/pose.js";
import {
  buildSkeleton, JOINTS, restInModel, SKELETON, type JointName,
} from "../../../../src/visuals/battle/person/skeleton.js";

describe("the person's skeleton", () => {
  test("is one table: every joint once, each after its parent, with Blender's .L / .R names", () => {
    assert.deepEqual(SKELETON.map((j) => j.name).sort(), [...JOINTS].sort());
    const seen = new Set<JointName>();
    for (const j of SKELETON) {
      assert.ok(j.parent === null ? seen.size === 0 : seen.has(j.parent), j.name);
      seen.add(j.name);
    }
    for (const name of ["hips", "spine", "chest", "neck", "head", "upper_arm.L", "forearm.R", "hand.L", "thigh.R",
      "shin.L", "foot.R", "grip.R"] as const) assert.ok(seen.has(name), name);
  });

  test("left and right mirror each other across the middle", () => {
    for (const body of LOOK_OPTIONS.body) {
      for (const name of JOINTS.filter((j) => j.endsWith(".R"))) {
        const right = restInModel(name, body), left = restInModel(name.replace(/\.R$/, ".L") as JointName, body);
        assert.deepEqual({ ...left, x: -left.x }, right, `${body} ${name}`);
      }
    }
  });

  test("stands up: feet on the ground, hips, chest, neck, head going up, within the sprite's height", () => {
    const y = (j: JointName) => restInModel(j, "medium").y;
    assert.ok(Math.abs(y("foot.R") - y("root")) < y("hips"));
    assert.ok(y("hips") < y("spine") && y("spine") < y("chest") && y("chest") < y("neck") && y("neck") < y("head"));
    assert.ok(y("head") < y("crown") && y("crown") <= SPRITE_SIZE);
    assert.ok(y("hand.R") < y("upper_arm.R") && y("upper_arm.R") < y("neck"));
  });

  test("a wider body's shoulders and hips sit further out", () => {
    for (const j of ["upper_arm.R", "thigh.R"] as const) {
      const [skinny, wide] = (["skinny", "wide"] as const).map((b) => restInModel(j, b).x);
      assert.ok(skinny! < wide!, j);
    }
  });

  test("is built as nodes from the table, each where the table puts it", () => {
    const scene = new Scene(new NullEngine()), holder = new TransformNode("holder", scene);
    const joints = buildSkeleton(scene, holder, "wide");
    for (const j of SKELETON) {
      const node = joints[j.name];
      assert.equal(node.parent, j.parent ? joints[j.parent] : holder, j.name);
      node.computeWorldMatrix(true);
      const at = restInModel(j.name, "wide"), got = node.getAbsolutePosition();
      assert.ok(Math.abs(got.x - at.x) + Math.abs(got.y - at.y) + Math.abs(got.z - at.z) < 1e-6, j.name);
    }
    scene.dispose();
  });
});
