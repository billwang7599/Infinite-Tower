import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, VertexBuffer } from "@babylonjs/core";
import { HIT_FLASH_TIME } from "@infinite-tower/shared/fight";
import {
  breathOf, easePace, ENEMY_FILL, ENEMY_SHADE_TINT, enemyMaterial, flashMaterials, flickOf, HIT_FLASH_COLOR,
  holdLeg, lengthwise, newLegHold,
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

  test("the shade keeps a share of the part's own colour, cooler than its lit side", () => {
    const scene = new Scene(new NullEngine());
    const m = enemyMaterial(scene, "hide", "#806040"), e = m.emissiveColor, d = m.diffuseColor;
    assert.ok(Math.abs(e.r - d.r * ENEMY_SHADE_TINT.r * ENEMY_FILL) < 1e-6);
    assert.ok(Math.abs(e.b - d.b * ENEMY_SHADE_TINT.b * ENEMY_FILL) < 1e-6);
    assert.ok(e.b / e.r > d.b / d.r, "bluer in shade");
    assert.ok(e.g > 0.05, "not black");
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

const FRAME_TIME = 1 / 60;

describe("enemy motion never pops", () => {
  test("a walk eases out when it stops and in when it starts", () => {
    let pace = 0.6;
    const stopped: number[] = [];
    for (let i = 0; i < 60; i++) stopped.push(pace = easePace(pace, 0, FRAME_TIME));
    assert.ok(stopped[0]! > 0.45, "still nearly at its pace the frame it stops");
    assert.ok(stopped.at(-1)! < 0.01, "standing within a second");
    for (let i = 1; i < stopped.length; i++) assert.ok(stopped[i - 1]! - stopped[i]! < 0.1);
    assert.ok(easePace(0, 0.6, FRAME_TIME) < 0.1, "and grows in from standing");
  });

  test("a leg eases into a held angle and back into its walk", () => {
    const hold = newLegHold(), walkAt = (i: number) => Math.sin(i * 0.2) * 0.5;
    let last = holdLeg(hold, null, walkAt(0), FRAME_TIME);
    assert.equal(last, walkAt(0), "walking free, exactly the walk");
    for (let i = 1; i < 120; i++) {
      const held = i >= 30 && i < 60 ? -1 : i >= 60 && i < 70 ? -0.2 : null;
      const leg = holdLeg(hold, held, walkAt(i), FRAME_TIME);
      assert.ok(Math.abs(leg - last) < 0.25, `frame ${i}: ${last.toFixed(2)} to ${leg.toFixed(2)}`);
      last = leg;
    }
    assert.ok(Math.abs(last - walkAt(119)) < 0.01, "back to the walk");
    const settled = newLegHold();
    for (let i = 0; i < 30; i++) last = holdLeg(settled, -1, 0, FRAME_TIME);
    assert.ok(Math.abs(last + 1) < 0.01, "held long enough, it's at the angle");
  });

  test("a hit's flash is brightest at the hit and fades out with it", () => {
    const scene = new Scene(new NullEngine()), m = enemyMaterial(scene, "hide", "#806040");
    const base = [m.emissiveColor.clone()], at = (flash: number) => {
      flashMaterials([m], base, flash);
      return m.emissiveColor.r;
    };
    assert.ok(Math.abs(at(HIT_FLASH_TIME) - HIT_FLASH_COLOR.r) < 1e-6);
    const half = at(HIT_FLASH_TIME / 2);
    assert.ok(half > base[0]!.r && half < HIT_FLASH_COLOR.r, "between, half way");
    assert.ok(Math.abs(at(0) - base[0]!.r) < 1e-6, "its own colour after");
    scene.dispose();
  });
});
