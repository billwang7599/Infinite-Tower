import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene } from "@babylonjs/core";
import { waterMap } from "../../../src/modes/overworld/water.js";
import { buildChunk } from "../../../src/visuals/overworld/terrain.js";
import { terrainArt } from "../../../src/visuals/overworld/terrainArt.js";
import { stubCanvas } from "../../fixtures/canvas.js";
import { testMap } from "../../fixtures/map.js";

stubCanvas();

function meshesOf(tiles: string[]) {
  const scene = new Scene(new NullEngine()), map = testMap(tiles, "kingdom");
  const job = buildChunk(scene, map, waterMap(map), map.bounds, terrainArt(scene), []);
  let step = job.next();
  while (!step.done) step = job.next();
  const counts = { meshes: step.value.meshes.length, casters: step.value.casters.length };
  scene.dispose();
  return counts;
}

describe("a chunk's meshes", () => {
  test("its lamp posts are one mesh, so more of them cost no more meshes or shadow casters", () => {
    const one = meshesOf(["........", "........", "...L....", "........", "........", "........", "........", "........"]);
    const four = meshesOf(["........", ".L....L.", "...L....", "........", "........", ".L......", "........", "........"]);
    assert.deepEqual(four, one);
  });
});
