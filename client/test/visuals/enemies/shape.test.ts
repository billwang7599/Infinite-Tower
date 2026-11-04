import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, VertexBuffer } from "@babylonjs/core";
import {
  breathOf, ENEMY_FILL, enemyMaterial, flickOf, lengthwise,
} from "../../../src/visuals/enemies/shape.js";

describe("enemy shapes", () => {
  test("a lengthwise loft runs along +z, its ribs raised by dy, its faces outward", () => {
    const scene = new Scene(new NullEngine());
    const mesh = lengthwise(scene, "trunk", [
      { z: -1, w: 0.2, h: 0.2 }, { z: 0, w: 0.5, h: 0.4, dy: 0.3 }, { z: 1, w: 0.2, h: 0.2 },
    ]);
    const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
    assert.ok(Math.abs(minimum.z + 1) < 1e-6 && Math.abs(maximum.z - 1) < 1e-6, "from the first rib to the last");
    assert.ok(Math.abs(maximum.y - 0.7) < 1e-6, "the middle rib raised");
    assert.ok(Math.abs(maximum.x - 0.5) < 1e-6);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const top = [...Array(positions.length / 3).keys()].find((i) => positions[i * 3 + 1]! > 0.69)!;
    assert.ok(normals[top * 3 + 1]! > 0.5, "the top's normal faces up");
    scene.dispose();
  });

  test("the shade keeps a share of the part's own colour", () => {
    const scene = new Scene(new NullEngine());
    const m = enemyMaterial(scene, "hide", "#806040");
    assert.ok(Math.abs(m.emissiveColor.r - m.diffuseColor.r * ENEMY_FILL) < 1e-6);
    assert.ok(Math.abs(m.emissiveColor.b - m.diffuseColor.b * ENEMY_FILL) < 1e-6);
    scene.dispose();
  });

  test("a breath comes round each period, within -1..1", () => {
    for (const t of [0, 0.4, 1.3]) assert.ok(Math.abs(breathOf(t, 2) - breathOf(t + 2, 2)) < 1e-9);
    assert.ok(Math.abs(breathOf(0.5, 2) - 1) < 1e-9);
  });

  test("a flick is a short twitch once every so often, still between", () => {
    const every = 3, length = 0.25;
    assert.equal(flickOf(length + 0.5, every, length), 0);
    assert.ok(flickOf(length / 2, every, length) > 0.99);
    assert.ok(flickOf(every + length / 2, every, length) > 0.99);
    for (let t = 0; t < 2 * every; t += 0.05) {
      const f = flickOf(t, every, length);
      assert.ok(f >= 0 && f <= 1);
    }
  });
});
