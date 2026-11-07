import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Matrix, NullEngine, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import { CHUNK_SEND_TILES, CHUNK_DROP_TILES, CHUNK_TILES, VIEW } from "@infinite-tower/shared";
import { CAMERA_DISTANCE, CAMERA_PITCH } from "../../../src/modes/overworld/facing.js";
import {
  AHEAD_TILES, buildRank, FOG, HIDE_MARGIN_TILES, levelAt, NEAR_TILES, seenGround, SHOWN_TILES, SKY_BLEND_TILES,
  skyBlendAt,
} from "../../../src/visuals/overworld/chunks.js";
import { CAMERA } from "../../../src/visuals/overworld/scene.js";

const WIDTH_PX = 1600, HEIGHT_PX = Math.round(WIDTH_PX / VIEW.maxAspect);
const EDGE_SAMPLES = 16;
const STEEP_RAD = (65 * Math.PI) / 180;

/** Where the screen's edges meet the ground, the camera tilted to `pitchRad` and looking at its pivot over (0, 0). */
function screenEdgeOnGround(pitchRad: number): { fromFocus: number; fromCamera: number }[] {
  const engine = new NullEngine({
    renderWidth: WIDTH_PX, renderHeight: HEIGHT_PX, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1,
  });
  const scene = new Scene(engine), back = Math.cos(pitchRad) * CAMERA_DISTANCE.maxTiles;
  const up = CAMERA.pivotTiles + Math.sin(pitchRad) * CAMERA_DISTANCE.maxTiles;
  const camera = new UniversalCamera("camera", new Vector3(0, up, -back), scene);
  camera.fov = CAMERA.fovRad;
  camera.setTarget(new Vector3(0, CAMERA.pivotTiles, 0));
  const hits = [];
  for (let i = 0; i <= EDGE_SAMPLES; i++) {
    const x = (i / EDGE_SAMPLES) * WIDTH_PX, y = (i / EDGE_SAMPLES) * HEIGHT_PX;
    for (const [px, py] of [[x, 0], [x, HEIGHT_PX], [0, y], [WIDTH_PX, y]] as const) {
      const ray = scene.createPickingRay(px, py, Matrix.Identity(), camera);
      if (ray.direction.y >= 0) {
        hits.push({ fromFocus: Infinity, fromCamera: Infinity });
        continue;
      }
      const at = ray.origin.add(ray.direction.scale(-ray.origin.y / ray.direction.y));
      hits.push({ fromFocus: Math.hypot(at.x, at.z), fromCamera: Vector3.Distance(camera.position, at) });
    }
  }
  engine.dispose();
  return hits;
}

describe("how far the world is drawn", () => {
  test("seenGround is how far the camera sees at any tilt it's drawn for, at the widest screen; SHOWN_TILES the most", () => {
    for (let k = 0; k <= 8; k++) {
      const pitchRad = CAMERA_PITCH.drawnForRad + ((STEEP_RAD - CAMERA_PITCH.drawnForRad) * k) / 8;
      const hits = screenEdgeOnGround(pitchRad), seen = seenGround(pitchRad);
      const farthest = Math.max(...hits.map((h) => h.fromFocus));
      assert.ok(Math.abs(farthest - seen.fromFocusTiles) < 0.01, `${farthest} tiles seen at ${pitchRad} rad`);
      assert.ok(Math.abs(Math.max(...hits.map((h) => h.fromCamera)) - seen.fromCameraM) < 0.01);
      assert.ok(farthest < SHOWN_TILES);
    }
  });

  test("the farthest ground seen is lost in the fog, and you stand clear of it", () => {
    const farthest = Math.max(...screenEdgeOnGround(CAMERA_PITCH.drawnForRad).map((h) => h.fromCamera));
    assert.ok(farthest >= FOG.endM - 0.01, `${farthest} m against ${FOG.endM}`);
    assert.ok(FOG.startM > CAMERA_DISTANCE.maxTiles);
  });

  test("the server sends every chunk a chunk built ahead looks at, with room to walk before it's needed", () => {
    const furthestNeighbour = SHOWN_TILES + AHEAD_TILES + CHUNK_TILES * Math.SQRT2;
    assert.ok(CHUNK_SEND_TILES - furthestNeighbour >= CHUNK_TILES / 2);
    assert.ok(CHUNK_DROP_TILES > CHUNK_SEND_TILES);
  });
});

describe("levelAt", () => {
  test("near chunks get the full drawing, the rest out to what's seen the cheap one, past it none", () => {
    assert.equal(levelAt(NEAR_TILES, "none", SHOWN_TILES), "near");
    assert.equal(levelAt(NEAR_TILES + 0.1, "none", SHOWN_TILES), "far");
    assert.equal(levelAt(SHOWN_TILES, "none", SHOWN_TILES), "far");
    assert.equal(levelAt(SHOWN_TILES + 0.1, "none", SHOWN_TILES), "none");
  });

  test("near chunks are drawn however little is seen, so their shadows still fall", () => {
    assert.equal(levelAt(NEAR_TILES, "none", NEAR_TILES / 2), "near");
    assert.equal(levelAt(NEAR_TILES + 0.1, "none", NEAR_TILES / 2), "none");
  });

  test("what's drawn stays drawn a little past each edge, so stepping about one doesn't flip it", () => {
    const by = HIDE_MARGIN_TILES / 2;
    assert.equal(levelAt(NEAR_TILES + by, "near", SHOWN_TILES), "near");
    assert.equal(levelAt(NEAR_TILES + HIDE_MARGIN_TILES + by, "near", SHOWN_TILES), "far");
    assert.equal(levelAt(SHOWN_TILES + by, "far", SHOWN_TILES), "far");
    assert.equal(levelAt(SHOWN_TILES + HIDE_MARGIN_TILES + by, "far", SHOWN_TILES), "none");
  });
});

describe("buildRank", () => {
  const chunkAt = (x: number, z: number) => ({ x, z, w: CHUNK_TILES, h: CHUNK_TILES });
  const north = { x: 0, z: 1 };

  test("of two chunks as near, the one ahead builds first", () => {
    const ahead = chunkAt(-8, 40), behind = chunkAt(-8, -40 - CHUNK_TILES);
    assert.ok(buildRank(ahead, { x: 0, z: 0 }, north) < buildRank(behind, { x: 0, z: 0 }, north));
  });

  test("standing still with no way ahead, the nearer builds first", () => {
    const near = chunkAt(-8, 20), far = chunkAt(-8, -40 - CHUNK_TILES);
    assert.ok(buildRank(near, { x: 0, z: 0 }, { x: 0, z: 0 }) < buildRank(far, { x: 0, z: 0 }, { x: 0, z: 0 }));
  });

  test("a chunk right by you still beats a far one ahead", () => {
    const by = chunkAt(-8, -CHUNK_TILES - 1), farAhead = chunkAt(-8, SHOWN_TILES);
    assert.ok(buildRank(by, { x: 0, z: 0 }, north) < buildRank(farAhead, { x: 0, z: 0 }, north));
  });
});

describe("skyBlendAt", () => {
  const field = { id: "field", name: "Field", theme: "grass-field" as const, area: { x: -40, z: -20, w: 40, h: 40 } };
  const wood = { id: "wood", name: "Wood", theme: "mistwood" as const, area: { x: 0, z: -20, w: 40, h: 40 } };
  const map = { regions: [field, wood] };

  test("deep in a region, its sky alone", () => {
    assert.deepEqual(skyBlendAt(map, -20, 0), { near: field, next: wood, nextShare: 0 });
  });

  test("on the border, half each; walking over it the next sky comes in step by step", () => {
    assert.equal(skyBlendAt(map, -0.001, 0).nextShare.toFixed(2), "0.50");
    const shares = [-SKY_BLEND_TILES, -SKY_BLEND_TILES / 2, -0.001].map((x) => skyBlendAt(map, x, 0).nextShare);
    assert.deepEqual(shares.map((s) => s.toFixed(2)), ["0.00", "0.25", "0.50"]);
    assert.equal(skyBlendAt(map, SKY_BLEND_TILES / 2, 0).near, wood);
    assert.equal(skyBlendAt(map, SKY_BLEND_TILES / 2, 0).nextShare.toFixed(2), "0.25");
  });

  test("in the land between two regions, measured from where the nearest gives way", () => {
    const apart = { regions: [field, { ...wood, area: { ...wood.area, x: 20 } }] };
    assert.equal(skyBlendAt(apart, 10 - 0.001, 0).nextShare.toFixed(2), "0.50");
    assert.equal(skyBlendAt(apart, 10 - SKY_BLEND_TILES, 0).nextShare, 0);
  });
});
