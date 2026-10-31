import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CORE_STEPS, fillToFinish, REALMS, STEP_NAMES, type CoreState } from "@infinite-tower/shared";
import { coreLight, nearness, REALM_LOOKS, SPARKS_FROM, sparksPerSec } from "../../src/gfx/core/light.js";
import { BREAKTHROUGH, CoreSphere } from "../../src/gfx/core/sphere.js";

const core = (steps: number, fill = 0): CoreState => ({ steps, fill, points: {} });
const STEPS_PER_REALM = STEP_NAMES.length;

describe("the core's light", () => {
  test("is brighter every step, up to Peak Tian", () => {
    for (let steps = 1; steps < CORE_STEPS; steps++) {
      assert.ok(coreLight(steps).brightness > coreLight(steps - 1).brightness, `step ${steps}`);
    }
  });

  test("is bigger every step of a realm, and each realm's Early bigger than the realm before's", () => {
    for (let steps = 1; steps < CORE_STEPS; steps++) {
      if (steps % STEPS_PER_REALM === 0) {
        assert.ok(coreLight(steps).radius > coreLight(steps - STEPS_PER_REALM).radius, `realm at ${steps}`);
      } else assert.ok(coreLight(steps).radius > coreLight(steps - 1).radius, `step ${steps}`);
    }
  });

  test("follows the core's realm, a whole core staying Peak Tian", () => {
    REALMS.forEach((realm, i) => assert.equal(coreLight(i * STEPS_PER_REALM).realm, realm));
    assert.equal(coreLight(CORE_STEPS - 1).realm, "Tian");
    assert.deepEqual(coreLight(CORE_STEPS), coreLight(CORE_STEPS - 1));
  });

  test("has a colour of its own in each realm, from fiery Yan to ethereal Tian", () => {
    const middles = REALMS.map((realm) => {
      const ramp = REALM_LOOKS[realm].ramp;
      return ramp[Math.floor(ramp.length / 2)]!;
    });
    assert.equal(new Set(middles.map((rgb) => rgb.join())).size, REALMS.length);
    const [red, green, blue] = middles[0]!;
    assert.ok(red > green && green > blue, "Yan is fiery");
    const tian = middles[REALMS.length - 1]!;
    assert.ok(Math.min(...tian) / Math.max(...tian) > 0.6, "Tian is pale");
  });
});

describe("near a breakthrough", () => {
  test("nearness is how much of the step is filled, and nothing at a whole core", () => {
    assert.equal(nearness(core(0)), 0);
    assert.equal(nearness(core(4, fillToFinish(5) / 2)), 0.5);
    assert.equal(nearness(core(CORE_STEPS)), 0);
  });

  test("no sparks until SPARKS_FROM, then more the nearer it is", () => {
    assert.equal(sparksPerSec(0), 0);
    assert.equal(sparksPerSec(SPARKS_FROM), 0);
    let last = 0;
    for (let near = SPARKS_FROM + 0.05; near <= 1; near += 0.05) {
      assert.ok(sparksPerSec(near) > last, `at ${near}`);
      last = sparksPerSec(near);
    }
  });
});

describe("a breakthrough", () => {
  test("shows the old step until its flash, then the new one, whichever came first", () => {
    for (const coreFirst of [true, false]) {
      const sphere = new CoreSphere();
      sphere.show(core(1, 90));
      sphere.frame(10);
      if (coreFirst) sphere.show(core(2));
      sphere.breakthrough(10, core(2));
      if (!coreFirst) sphere.show(core(2));
      assert.ok(sphere.bursting);
      sphere.frame(10 + BREAKTHROUGH.flashTime - 0.01);
      assert.equal(sphere.steps, 1);
      sphere.frame(10 + BREAKTHROUGH.flashTime);
      assert.equal(sphere.steps, 2);
      sphere.frame(10 + BREAKTHROUGH.endTime);
      assert.ok(!sphere.bursting);
    }
  });

  test("a core sent during it is shown once it's over", () => {
    const sphere = new CoreSphere();
    sphere.show(core(1));
    sphere.breakthrough(0, core(2));
    sphere.frame(BREAKTHROUGH.flashTime);
    sphere.show(core(2, 30));
    assert.equal(sphere.nearness, 0);
    sphere.frame(BREAKTHROUGH.endTime);
    assert.equal(sphere.nearness, nearness(core(2, 30)));
  });

  test("losing a step shows at once, with none", () => {
    const sphere = new CoreSphere();
    sphere.show(core(3));
    sphere.show(core(2));
    assert.equal(sphere.steps, 2);
    assert.ok(!sphere.bursting);
  });
});
