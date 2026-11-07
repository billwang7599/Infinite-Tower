import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, VertexBuffer } from "@babylonjs/core";
import { loft, RING_POINTS, sectionAt } from "../../../../src/visuals/battle/person/loft.js";

describe("a loft through sections", () => {
  test("is closed and its faces point outward", () => {
    const scene = new Scene(new NullEngine());
    const mesh = loft(scene, "pipe", [{ y: 0, x: 1, z: 1 }, { y: 2, x: 0.5, z: 0.5 }], 2);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const front = [...Array(positions.length / 3).keys()].find((i) => positions[i * 3 + 2]! > 0.99)!;
    assert.ok(normals[front * 3 + 2]! > 0.5, "the front's normal faces ahead");
    assert.equal(mesh.getTotalIndices(), (RING_POINTS * 6) + RING_POINTS * 3 * 2);
    scene.dispose();
  });

  test("a section between two is their mix", () => {
    const s = sectionAt([{ y: 0, x: 1, z: 2 }, { y: 2, x: 3, z: 4, dz: 2 }], 1);
    assert.deepEqual(s, { y: 1, x: 2, z: 3, dz: 1, dx: 0 });
  });
});
