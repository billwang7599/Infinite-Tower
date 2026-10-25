import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CameraSettings, SENSITIVITY } from "../../src/settings/camera.js";

const sensitivity = (c: CameraSettings) => c.get().sensitivity;

describe("CameraSettings", () => {
  test("starts at the default sensitivity", () => {
    const c = new CameraSettings();
    assert.equal(sensitivity(c), SENSITIVITY.default);
    assert.equal(c.isDefault(), true);
  });

  test("toSaved is empty at the default and holds the value otherwise", () => {
    const c = new CameraSettings();
    assert.deepEqual(c.toSaved(), {});
    c.setSensitivity(2);
    assert.deepEqual(c.toSaved(), { sensitivity: 2 });
  });

  test("restore(toSaved()) gives back the same sensitivity", () => {
    const c = new CameraSettings();
    c.setSensitivity(1.35);
    const copy = new CameraSettings();
    copy.restore(c.toSaved());
    assert.equal(sensitivity(copy), 1.35);
  });

  test("restore takes any number in range, ends included", () => {
    for (const value of [SENSITIVITY.min, 0.5, 2.5, SENSITIVITY.max]) {
      const c = new CameraSettings();
      c.restore({ sensitivity: value });
      assert.equal(sensitivity(c), value);
    }
  });

  test("restore falls back to the default for anything out of range or unreadable", () => {
    const junk: unknown[] = [
      { sensitivity: SENSITIVITY.min - 0.01 }, { sensitivity: SENSITIVITY.max + 0.01 }, { sensitivity: NaN },
      { sensitivity: Infinity }, { sensitivity: "2" }, { sensitivity: null }, {}, undefined,
    ];
    for (const saved of junk) {
      const c = new CameraSettings();
      c.setSensitivity(2);
      c.restore(saved as Parameters<CameraSettings["restore"]>[0]);
      assert.equal(sensitivity(c), SENSITIVITY.default, JSON.stringify(saved));
    }
  });

  test("setSensitivity snaps to the slider's step", () => {
    const c = new CameraSettings();
    c.setSensitivity(1.12);
    assert.equal(sensitivity(c), 1.1);
    c.setSensitivity(1.13);
    assert.equal(sensitivity(c), 1.15);
  });

  test("setSensitivity leaves no float noise", () => {
    const c = new CameraSettings();
    for (let steps = 5; steps <= 60; steps++) {
      const value = steps * SENSITIVITY.step;
      c.setSensitivity(value);
      assert.equal(sensitivity(c), Number(value.toFixed(2)));
    }
    c.setSensitivity(1.1);
    assert.equal(sensitivity(c), 1.1);
  });

  test("setSensitivity clamps to the range", () => {
    const c = new CameraSettings();
    c.setSensitivity(0);
    assert.equal(sensitivity(c), SENSITIVITY.min);
    c.setSensitivity(-5);
    assert.equal(sensitivity(c), SENSITIVITY.min);
    c.setSensitivity(99);
    assert.equal(sensitivity(c), SENSITIVITY.max);
  });

  test("reset brings back the default", () => {
    const c = new CameraSettings();
    c.setSensitivity(0.5);
    assert.equal(c.isDefault(), false);
    c.reset();
    assert.equal(sensitivity(c), SENSITIVITY.default);
    assert.equal(c.isDefault(), true);
  });

  test("listeners hear a change but not a value that snaps to the same step", () => {
    const c = new CameraSettings();
    let calls = 0;
    c.subscribe(() => calls++);
    c.setSensitivity(1.01);
    assert.equal(calls, 0);
    c.setSensitivity(1.2);
    assert.equal(calls, 1);
  });
});
