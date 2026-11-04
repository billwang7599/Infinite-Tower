import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { WeaponId } from "@infinite-tower/shared";
import { FIXED } from "../../../src/gfx/look/palette.js";
import { LIGHT, OUTLINE, SHADOW } from "../../../src/gfx/look/pixels.js";
import { bladeArt, bladeEdge, buildBlade, BLADE_FROM_M } from "../../../src/visuals/battle/blade.js";
import { WEAPON_LOOKS } from "../../../src/visuals/battle/weapons.js";

const hex = (rgba: Uint8ClampedArray, i: number) =>
  `#${[0, 1, 2].map((k) => rgba[i * 4 + k]!.toString(16).padStart(2, "0")).join("")}`;
const ids = Object.keys(WEAPON_LOOKS) as WeaponId[];
const drawn = ids.filter((id) => WEAPON_LOOKS[id].art);

describe("a blade's pixel art", () => {
  test("is the sword's art laid along the blade, its pixels square on the blade's face", () => {
    for (const id of drawn) {
      const { lengthM, widthM } = WEAPON_LOOKS[id].blade, { picture } = bladeArt(WEAPON_LOOKS[id])!;
      const along = lengthM / picture.width, across = widthM / picture.height;
      assert.ok(Math.abs(along / across - 1) < 0.05, `${id}: ${along} by ${across} m a pixel`);
      const colors = new Set(Array.from({ length: picture.width * picture.height }, (_, i) => hex(picture.rgba, i)));
      assert.ok(colors.has(FIXED.steel[LIGHT]) && colors.has(FIXED.steel[SHADOW]), `${id}: steel, shaded`);
      assert.ok(!colors.has(FIXED.steel[OUTLINE]), `${id}: no dark outline to swallow it`);
      for (let i = 0; i < picture.width * picture.height; i++) assert.equal(picture.rgba[i * 4 + 3], 255, `${id} opaque`);
    }
  });

  test("its edges take the steel's light tone, so it shows edge on", () => {
    for (const id of drawn) {
      const { picture, edge } = bladeArt(WEAPON_LOOKS[id])!;
      const x = Math.floor(edge.u * picture.width), y = Math.floor(edge.v * picture.height);
      assert.equal(hex(picture.rgba, y * picture.width + x), FIXED.steel[LIGHT], id);
    }
  });

  test("a stick has none", () => assert.equal(bladeArt(WEAPON_LOOKS["old-stick"]), null));
});

describe("a 3D blade", () => {
  const scene = new Scene(new NullEngine());
  const materials = {
    grip: new StandardMaterial("g", scene), guard: new StandardMaterial("u", scene), steel: new StandardMaterial("s", scene),
  };

  test("is the look's length and width, a third of its width thick, along the hand's +y", () => {
    for (const id of ids) {
      const look = WEAPON_LOOKS[id], hand = new TransformNode(`hand-${id}`, scene);
      const blade = buildBlade(scene, hand, look, materials).find((m) => m.name === "blade")!;
      blade.refreshBoundingInfo();
      const { minimum, maximum } = blade.getBoundingInfo().boundingBox;
      const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${id} ${what}: ${a}`);
      near(maximum.x - minimum.x, look.blade.widthM, "width");
      near(maximum.y - minimum.y, look.blade.lengthM, "length");
      near(minimum.y, BLADE_FROM_M, "from the guard");
      assert.ok(maximum.z - minimum.z >= look.blade.widthM / 3 - 1e-6, `${id} thick`);
    }
  });

  test("its edge runs from the guard to the tip, wherever the hand is", () => {
    const body = new TransformNode("body", scene), hand = new TransformNode("hand", scene);
    hand.parent = body;
    body.position.set(2, 0, 1);
    hand.position.set(0, 1, 0);
    hand.rotation.x = Math.PI / 2;
    const look = WEAPON_LOOKS.sword, { base, tip } = bladeEdge(hand, look);
    const at = (v: { x: number; y: number; z: number }, want: Vector3) =>
      assert.ok(Vector3.Distance(new Vector3(v.x, v.y, v.z), want) < 1e-6, JSON.stringify(v));
    at(base, new Vector3(2, 1, 1 + BLADE_FROM_M));
    at(tip, new Vector3(2, 1, 1 + BLADE_FROM_M + look.blade.lengthM));
  });
});
