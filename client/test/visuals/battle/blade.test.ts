import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { WeaponId } from "@infinite-tower/shared";
import { FIXED } from "../../../src/gfx/look/palette.js";
import { LIGHT, OUTLINE, SHADOW } from "../../../src/gfx/look/pixels.js";
import {
  bladeArt, bladeEdge, buildBlade, BLADE_FROM_M, dropShield, holdingOf, holdShield, SHIELD,
} from "../../../src/visuals/battle/blade.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";
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

  test("a wooden sword has none", () => assert.equal(bladeArt(WEAPON_LOOKS["wooden-sword"]), null));
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

describe("a 3D shield", () => {
  test("a round board on the hand's face, its boss out ahead (+z), the hand behind it", () => {
    const scene = new Scene(new NullEngine()), hand = new TransformNode("hand", scene);
    const ctx = { scene, sky: { castShadows: () => {} } } as unknown as ArenaScene;
    const shield = holdShield(ctx, hand, "wooden-shield"), meshes = shield.root.getChildMeshes();
    let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const m of meshes) {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo({});
      min = Vector3.Minimize(min, m.getBoundingInfo().boundingBox.minimumWorld);
      max = Vector3.Maximize(max, m.getBoundingInfo().boundingBox.maximumWorld);
    }
    const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 0.02, `${what}: ${a} vs ${b}`);
    near(max.x - min.x, 2 * SHIELD.radiusM, "across");
    near(max.y - min.y, 2 * SHIELD.radiusM, "up");
    near((max.x + min.x) / 2, 0, "centred across");
    near((max.y + min.y) / 2, 0, "centred up");
    assert.ok(min.z > 0 && max.z - min.z < SHIELD.radiusM / 2, `in front of the hand, flat: ${min.z} to ${max.z}`);
    dropShield(shield);
    assert.equal(hand.getChildMeshes().length, 0);
    scene.dispose();
  });
});

describe("a held thing's turn", () => {
  test("puts the blade along the hand's +y and its edge along +x, the flat facing +z", () => {
    const blade = new Vector3(0.3, 0.8, 0.5).normalize(), edge = Vector3.Cross(blade, new Vector3(1, 0, 0)).normalize();
    const turn = holdingOf(blade, edge, new Quaternion());
    const along = (v: Vector3) => v.applyRotationQuaternion(turn);
    assert.ok(Vector3.Distance(along(Vector3.Up()), blade) < 1e-6);
    assert.ok(Vector3.Distance(along(new Vector3(1, 0, 0)), edge) < 1e-6);
    assert.ok(Vector3.Distance(along(new Vector3(0, 0, 1)), Vector3.Cross(edge, blade)) < 1e-6);
    const shortest = Quaternion.FromUnitVectorsToRef(Vector3.Up(), blade, new Quaternion());
    assert.ok(Math.abs(Math.abs(Quaternion.Dot(holdingOf(blade, null, new Quaternion()), shortest)) - 1) < 1e-6,
      "no edge: turned the shortest way from upright");
  });
});
