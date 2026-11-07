import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { followStun, noStun, STUN_CUE, type Stun } from "../../../src/modes/battle/stun.js";
import { STUN_HUD, stunStars, vignetteAlpha } from "../../../src/visuals/battle/stunned.js";

const WIDTH_PX = 1600, HEIGHT_PX = 900;

function stunned(time: number, elapsed: number): Stun {
  const stun = noStun();
  followStun(stun, time, 0);
  followStun(stun, time - elapsed, elapsed);
  return stun;
}

describe("seeing stars", () => {
  test("only while stunned, and only in first person", () => {
    assert.equal(stunStars(noStun(), true, WIDTH_PX, HEIGHT_PX, 1).length, 0);
    assert.equal(stunStars(stunned(0.8, 0.2), false, WIDTH_PX, HEIGHT_PX, 1).length, 0);
    assert.ok(stunStars(stunned(0.8, 0.2), true, WIDTH_PX, HEIGHT_PX, 1).length > 0);
  });

  test("fewer on a short stun than a long one", () => {
    assert.equal(stunStars(stunned(0.25, 0.1), true, WIDTH_PX, HEIGHT_PX, 1).length, STUN_HUD.fewestStars);
    assert.equal(
      stunStars(stunned(STUN_CUE.fullStrengthTime, 0.2), true, WIDTH_PX, HEIGHT_PX, 1).length, STUN_HUD.mostStars,
    );
  });

  test("circle in the top of the view, the near side's bigger and drawn over the far side's", () => {
    const stars = stunStars(stunned(0.8, 0.3), true, WIDTH_PX, HEIGHT_PX, 1);
    for (const star of stars) assert.ok(star.y < HEIGHT_PX / 3, `${star.y}`);
    for (let i = 1; i < stars.length; i++) {
      assert.ok(stars[i]!.y >= stars[i - 1]!.y);
      assert.ok(stars[i]!.radiusPx >= stars[i - 1]!.radiusPx);
    }
    const later = stunStars(stunned(0.8, 0.4), true, WIDTH_PX, HEIGHT_PX, 1);
    assert.notDeepEqual(later.map((s) => s.x), stars.map((s) => s.x));
  });

  test("fade out as the stun runs out", () => {
    const [mid] = stunStars(stunned(0.8, 0.3), true, WIDTH_PX, HEIGHT_PX, 1);
    const [ending] = stunStars(stunned(0.8, 0.77), true, WIDTH_PX, HEIGHT_PX, 1);
    assert.equal(mid!.alpha, 1);
    assert.ok(ending!.alpha > 0 && ending!.alpha < 0.5, `${ending!.alpha}`);
  });
});

describe("the stun's vignette", () => {
  test("darker on a long stun, gone once it's over", () => {
    const short = vignetteAlpha(stunned(0.25, 0.1)), long = vignetteAlpha(stunned(1, 0.2));
    assert.ok(short > 0 && short < long, `${short} ${long}`);
    assert.equal(vignetteAlpha(stunned(0.8, 0.8)), 0);
  });
});
