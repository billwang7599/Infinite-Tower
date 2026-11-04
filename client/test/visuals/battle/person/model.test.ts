import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS } from "@infinite-tower/shared";
import { ACCENTS, DYES, EYES, HAIR, SKIN } from "../../../../src/gfx/look/palette.js";
import { BASE } from "../../../../src/gfx/look/pixels.js";
import { SPRITE_SIZE } from "../../../../src/visuals/battle/pose.js";
import { personBuild } from "../../../../src/visuals/battle/person/model.js";

describe("the 3D player's build, from the look", () => {
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
