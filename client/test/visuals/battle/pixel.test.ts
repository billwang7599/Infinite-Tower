import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MeshBuilder, NullEngine, Scene, StandardMaterial, UniversalCamera, Vector3 } from "@babylonjs/core";
import { DYES, SKIN } from "../../../src/gfx/look/palette.js";
import {
  DEFAULT_PIXEL_SCALE, drawOnTop, drawOverOpaque, inDepthPass, keepSharp, LOW_RES_LINES, PIXEL_DEPTH, pixelBands,
  pixelFlags, pixelScale, rampTones, renderScale,
} from "../../../src/visuals/battle/pixel.js";

describe("the pixel-art render's flags", () => {
  test("by default the arena is pixel art with outlines, anti-aliased, its people 3D, its pixels sized by depth", () => {
    assert.deepEqual(pixelFlags(""), {
      scale: DEFAULT_PIXEL_SCALE, fixed: false, outline: true, palette: null, player3d: true, steps: null, aa: true,
    });
    assert.equal(pixelScale(pixelFlags(""), 768), DEFAULT_PIXEL_SCALE);
  });

  test("each layer changes by itself", () => {
    const byDefault = pixelFlags("");
    assert.deepEqual(pixelFlags("?pixel=4"), { ...byDefault, scale: 4 });
    assert.deepEqual(pixelFlags("?pixel=fixed"), { ...byDefault, fixed: true });
    assert.deepEqual(pixelFlags("?outline=0"), { ...byDefault, outline: false });
    assert.deepEqual(pixelFlags("?palette"), { ...byDefault, palette: "ramps" });
    assert.deepEqual(pixelFlags("?palette=bands"), { ...byDefault, palette: "bands" });
    assert.deepEqual(pixelFlags("?player3d=0"), { ...byDefault, player3d: false });
    assert.deepEqual(pixelFlags("?steps=12"), { ...byDefault, steps: 12 });
    assert.deepEqual(pixelFlags("?aa=0"), { ...byDefault, aa: false });
  });

  test("the old look is still a URL away", () => {
    assert.deepEqual(pixelFlags("?pixel=1&outline=0&player3d=0"), {
      scale: null, fixed: false, outline: false, palette: null, player3d: false, steps: null, aa: true,
    });
  });

  test("pixel=auto picks the scale from the canvas height, a number above 1 is taken as it is, 1 or 0 is off", () => {
    assert.equal(pixelFlags("?pixel=auto").scale, "auto");
    assert.equal(pixelFlags("?pixel").scale, "auto");
    assert.equal(pixelScale(pixelFlags("?pixel=auto"), LOW_RES_LINES * 3), 3);
    assert.equal(pixelScale(pixelFlags("?pixel=auto"), LOW_RES_LINES / 2), 1);
    assert.equal(pixelScale(pixelFlags("?pixel=5"), 768), 5);
    assert.equal(pixelFlags("?pixel=1").scale, null);
    assert.equal(pixelFlags("?pixel=0").scale, null);
    assert.equal(pixelScale(pixelFlags("?pixel=1"), 768), 1);
  });

  test("pixels sized by depth draw at full resolution; fixed ones draw the whole arena small", () => {
    assert.equal(renderScale(pixelFlags(""), 768), 1);
    assert.equal(renderScale(pixelFlags("?pixel=fixed"), 768), DEFAULT_PIXEL_SCALE);
    assert.equal(renderScale(pixelFlags("?pixel=1"), 768), 1);
  });

  test("outline, player3d and aa are on unless set to 0", () => {
    assert.equal(pixelFlags("?outline").outline, true);
    assert.equal(pixelFlags("?outline=1").outline, true);
    assert.equal(pixelFlags("?player3d").player3d, true);
    assert.equal(pixelFlags("?aa").aa, true);
    assert.equal(pixelFlags("?aa=1").aa, true);
  });

  test("steps needs a rate above zero", () => {
    assert.equal(pixelFlags("?steps").steps, null);
    assert.equal(pixelFlags("?steps=0").steps, null);
    assert.equal(pixelFlags("?steps=8").steps, 8);
  });
});

describe("pixels sized by depth", () => {
  const base = DEFAULT_PIXEL_SCALE, fovRad = PIXEL_DEPTH.fovRad;
  const sizeAt = (depthM: number, limits: number[]) => base - limits.filter((l) => depthM > l).length;
  const heightPx = (depthM: number, fov = fovRad) => 768 / (2 * depthM * Math.tan(fov / 2));

  test("are the full size up close and shrink a pixel at a time with depth, never under their floor", () => {
    const limits = pixelBands(base, fovRad);
    assert.equal(limits.length, base - PIXEL_DEPTH.minPx);
    assert.equal(sizeAt(0.3, limits), base);
    assert.equal(sizeAt(PIXEL_DEPTH.fullSizeM, limits), base);
    assert.deepEqual(limits, [...limits].sort((a, b) => a - b));
    assert.equal(sizeAt(limits.at(-1)! + 0.01, limits), PIXEL_DEPTH.minPx);
    assert.equal(sizeAt(1000, limits), PIXEL_DEPTH.minPx, "far off, still pixel art");
    assert.ok(PIXEL_DEPTH.minPx >= 2);
    for (const big of [base + 1, base + 3]) {
      assert.equal(big - pixelBands(big, fovRad).length, PIXEL_DEPTH.minPx, `a scale of ${big}`);
    }
    assert.deepEqual(pixelBands(PIXEL_DEPTH.minPx, fovRad), []);
    assert.deepEqual(pixelBands(1, fovRad), []);
  });

  test("so a model walking away keeps about as many pixels until they're at their floor", () => {
    const limits = pixelBands(base, fovRad), floorFrom = limits.at(-1)!;
    const pixels = (depthM: number) => heightPx(depthM) / sizeAt(depthM, limits);
    const atFullSize = pixels(PIXEL_DEPTH.fullSizeM);
    for (let d = PIXEL_DEPTH.fullSizeM; d <= floorFrom; d += 0.25) {
      const share = pixels(d) / atFullSize;
      assert.ok(share > 2 / 3 && share < 3 / 2, `${d} m: ${share.toFixed(2)} of its pixels`);
    }
  });

  test("a wider view (first person) brings the bands nearer, as much as it shrinks what's seen", () => {
    const wide = 75 * Math.PI / 180, narrow = pixelBands(base, fovRad), near = pixelBands(base, wide);
    const shrink = Math.tan(fovRad / 2) / Math.tan(wide / 2);
    near.forEach((l, i) => assert.ok(Math.abs(l - narrow[i]! * shrink) < 1e-9));
  });
});

describe("what the outline reads and darkens", () => {
  const scene = new Scene(new NullEngine());
  const camera = new UniversalCamera("camera", new Vector3(0, 0, -6), scene);
  camera.setTarget(Vector3.Zero());
  const box = (name: string, x: number) => {
    const mesh = MeshBuilder.CreateBox(name, { size: 0.5 }, scene);
    mesh.position.x = x;
    mesh.material = new StandardMaterial(name, scene);
    return mesh;
  };
  const opaque = box("opaque", -1), seeThrough = box("see-through", -0.5), blade = box("blade", 0);
  const trail = box("trail", 0.5), sky = box("sky", 1);
  seeThrough.visibility = 0.5;
  keepSharp(blade);
  drawOnTop(trail);
  sky.infiniteDistance = true;
  const drawn: string[] = [];
  for (const mesh of [opaque, seeThrough, blade, trail]) mesh.onBeforeRenderObservable.add(() => drawn.push(mesh.name));
  drawOverOpaque(scene, () => drawn.push("outline"));

  test("the depth has the blade, so what's behind it can't outline through it, but not the trail or the sky", () => {
    assert.equal(inDepthPass(opaque), true);
    assert.equal(inDepthPass(blade), true);
    assert.equal(inDepthPass(trail), false);
    assert.equal(inDepthPass(sky), false);
  });

  test("it darkens the opaque scene before see-through things, the blade and the trail are drawn", () => {
    for (let i = 0; i < 3; i++) scene.render();
    const frame = drawn.slice(drawn.lastIndexOf("opaque"));
    assert.deepEqual(frame, ["opaque", "outline", "see-through", "blade", "trail"]);
    assert.equal(drawn.filter((n) => n === "outline").length, 3, "once a frame");
  });

  test("the blade hides behind what's in front of it; the trail is drawn over everything", () => {
    assert.equal(scene.getAutoClearDepthStencilSetup(blade.renderingGroupId).autoClear, false);
    assert.equal(scene.getAutoClearDepthStencilSetup(trail.renderingGroupId).autoClear, true);
    assert.ok(trail.renderingGroupId > blade.renderingGroupId && blade.renderingGroupId > opaque.renderingGroupId);
  });
});

describe("the palette the colours snap to", () => {
  test("holds every ramp's tones once, as 0-1 channels", () => {
    const tones = rampTones();
    const keys = tones.map((t) => t.join());
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.includes([0xfd / 255, 0xe8 / 255, 0xde / 255].join()), SKIN.porcelain[3]);
    assert.ok(keys.includes([0x09 / 255, 0x09 / 255, 0x0c / 255].join()), DYES.soot[0]);
    assert.ok(tones.flat().every((c) => c >= 0 && c <= 1));
  });
});
