import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  NullEngine, Scene, TransformNode, type AbstractMesh, type Mesh, type StandardMaterial,
} from "@babylonjs/core";
import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from "@infinite-tower/shared";
import { ACCENTS, DYES, EYES, HAIR, SKIN } from "../../../../src/gfx/look/palette.js";
import { BASE } from "../../../../src/gfx/look/pixels.js";
import { SPRITE_SIZE } from "../../../../src/visuals/battle/pose.js";
import { STARTER_WEAR, type PersonWear } from "../../../../src/visuals/battle/person/body.js";
import {
  buildPerson, disposePerson, FILL_EMISSIVE, FILL_LIGHT, personBuild,
} from "../../../../src/visuals/battle/person/model.js";
import type { Sky } from "../../../../src/visuals/sky/sky.js";

function built(look: Look, wear?: Readonly<Record<string, PersonWear>>) {
  const scene = new Scene(new NullEngine()), cast: AbstractMesh[] = [];
  const sky = { castShadows: (m: AbstractMesh) => cast.push(m) } as unknown as Sky;
  const model = buildPerson({ scene, sky }, 1, new TransformNode("player", scene), personBuild(look), wear);
  const meshes = scene.meshes as Mesh[];
  return { scene, model, cast, meshes };
}
const colorOf = (m: Mesh) => (m.material as StandardMaterial).diffuseColor.toHexString();
const lowest = (meshes: Mesh[], name: string) => Math.min(...meshes.filter((m) => m.name === name).map((m) => {
  m.computeWorldMatrix(true);
  m.refreshBoundingInfo();
  return m.getBoundingInfo().boundingBox.minimumWorld.y;
}));

describe("the 3D person's build, from the look", () => {
  test("takes each picked colour's base tone", () => {
    const look = { ...DEFAULT_LOOK, skin: "dark", hairColor: "pink", eyeColor: "gold", outfit: "moss",
      accent: "cyan" } as const;
    const { colors } = personBuild(look);
    assert.equal(colors.skin, SKIN.dark[BASE]);
    assert.equal(colors.hair, HAIR.pink[BASE]);
    assert.equal(colors.iris, EYES.gold[BASE]);
    assert.equal(colors.cloth, DYES.moss[BASE]);
    assert.equal(colors.accent, ACCENTS.cyan[BASE]);
  });

  test("a wider body type is wider at the shoulders, waist and hips, and as tall", () => {
    const [skinny, medium, wide] = (["skinny", "medium", "wide"] as const)
      .map((body) => personBuild({ ...DEFAULT_LOOK, body }));
    for (const part of ["shoulderM", "waistM", "hipM", "armM"] as const) {
      assert.ok(skinny![part] < medium![part] && medium![part] < wide![part], part);
    }
    assert.equal(skinny!.shoulderY, wide!.shoulderY);
    assert.equal(skinny!.headY, wide!.headY);
  });

  test("stands in the sprite's frame: feet on the ground, legs, then waist, shoulders, head", () => {
    for (const body of LOOK_OPTIONS.body) {
      const b = personBuild({ ...DEFAULT_LOOK, body });
      assert.ok(b.legY > 0 && b.legY < b.waistY && b.waistY < b.shoulderY && b.shoulderY < b.headY, body);
      assert.ok(b.headY + b.headM <= SPRITE_SIZE, body);
      assert.ok(b.reachM > 0.3 && b.reachM < b.shoulderY, body);
    }
  });
});

describe("the 3D person's model", () => {
  test("every mesh hangs from one joint of the skeleton and casts a real shadow", () => {
    const { scene, model, cast, meshes } = built(DEFAULT_LOOK);
    const joints = new Set<unknown>(Object.values(model.joints));
    assert.ok(meshes.length > 20);
    for (const m of meshes) assert.ok(joints.has(m.parent), `${m.name} under ${m.parent?.name}`);
    assert.equal(cast.length, meshes.length);
    scene.dispose();
  });

  test("lit from behind, every part still gets a fill of its own colour, so dark looks aren't silhouettes", () => {
    const look = { ...DEFAULT_LOOK, skin: "dark", hairColor: "black", outfit: "soot" } as const;
    const { scene, model } = built(look);
    assert.ok(FILL_LIGHT > 0.3);
    for (const m of model.materials) {
      assert.equal(m.linkEmissiveWithDiffuse, true, m.name);
      assert.ok(m.emissiveColor.equals(FILL_EMISSIVE), m.name);
    }
    scene.dispose();
  });

  test("clothes colour the body parts they cover, and come off as a table entry", () => {
    const dressed = built(DEFAULT_LOOK), bare = built(DEFAULT_LOOK, { boots: STARTER_WEAR.boots! });
    const named = (meshes: Mesh[], name: string) => meshes.find((m) => m.name === name)!;
    assert.notEqual(named(dressed.meshes, "person-ribs").material, named(dressed.meshes, "person-neck").material);
    assert.equal(named(bare.meshes, "person-ribs").material, named(bare.meshes, "person-neck").material, "bare skin");
    assert.equal(colorOf(named(dressed.meshes, "person-foot")), colorOf(named(bare.meshes, "person-foot")), "boots");
    assert.equal(bare.meshes.filter((m) => m.name.endsWith("-trim")).length, 2, "the boots' cuffs only");
    dressed.scene.dispose();
    bare.scene.dispose();
  });

  test("each hair style is its own shape: long hair hangs lowest, then the ponytail, a bob, short", () => {
    const low = Object.fromEntries(LOOK_OPTIONS.hair.map((hair) => {
      const { scene, meshes } = built({ ...DEFAULT_LOOK, hair });
      const y = Math.min(lowest(meshes, "person-hair"), ...["person-tail", "person-lock"]
        .filter((n) => meshes.some((m) => m.name === n)).map((n) => lowest(meshes, n)));
      scene.dispose();
      return [hair, y];
    })) as Record<Look["hair"], number>;
    assert.ok(low.long < low.ponytail && low.ponytail < low.bob && low.bob < low.short, JSON.stringify(low));
  });

  test("a sword, a hat or something slung on the back has a joint to hang from", () => {
    const { scene, model } = built(DEFAULT_LOOK);
    const { joints } = model;
    for (const j of ["root", "hips", "spine", "chest", "neck", "head", "crown", "back"] as const) {
      joints[j].computeWorldMatrix(true);
    }
    assert.equal(joints["grip.R"].parent, joints["hand.R"]);
    assert.ok(joints.crown.getAbsolutePosition().y > joints.head.getAbsolutePosition().y);
    assert.ok(joints.back.getAbsolutePosition().z < 0);
    disposePerson(model);
    assert.equal(scene.meshes.length, 0);
    scene.dispose();
  });
});
