import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CAMERA_SENSITIVITY, OVERWORLD_CAMERA_ANGLES } from "@infinite-tower/shared";
import { CameraSettings } from "../../src/settings/camera.js";

const sensitivity = (c: CameraSettings) => c.get().sensitivity;

describe("CameraSettings", () => {
  test("starts at the default sensitivity", () => {
    const c = new CameraSettings();
    assert.equal(sensitivity(c), CAMERA_SENSITIVITY.default);
    assert.deepEqual(c.toSaved(), {});
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
    for (const value of [CAMERA_SENSITIVITY.min, 0.5, 2.5, CAMERA_SENSITIVITY.max]) {
      const c = new CameraSettings();
      c.restore({ sensitivity: value });
      assert.equal(sensitivity(c), value);
    }
  });

  test("restore falls back to the default for anything out of range or unreadable", () => {
    const junk: unknown[] = [
      { sensitivity: CAMERA_SENSITIVITY.min - 0.01 }, { sensitivity: CAMERA_SENSITIVITY.max + 0.01 },
      { sensitivity: NaN }, { sensitivity: Infinity }, { sensitivity: "2" }, { sensitivity: null }, {}, undefined,
    ];
    for (const saved of junk) {
      const c = new CameraSettings();
      c.setSensitivity(2);
      c.restore(saved as Parameters<CameraSettings["restore"]>[0]);
      assert.equal(sensitivity(c), CAMERA_SENSITIVITY.default, JSON.stringify(saved));
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
      const value = steps * CAMERA_SENSITIVITY.step;
      c.setSensitivity(value);
      assert.equal(sensitivity(c), Number(value.toFixed(2)));
    }
    c.setSensitivity(1.1);
    assert.equal(sensitivity(c), 1.1);
  });

  test("setSensitivity clamps to the range", () => {
    const c = new CameraSettings();
    c.setSensitivity(0);
    assert.equal(sensitivity(c), CAMERA_SENSITIVITY.min);
    c.setSensitivity(-5);
    assert.equal(sensitivity(c), CAMERA_SENSITIVITY.min);
    c.setSensitivity(99);
    assert.equal(sensitivity(c), CAMERA_SENSITIVITY.max);
  });

  test("reset brings back the default", () => {
    const c = new CameraSettings();
    c.setSensitivity(0.5);
    assert.notDeepEqual(c.toSaved(), {});
    c.reset();
    assert.equal(sensitivity(c), CAMERA_SENSITIVITY.default);
    assert.deepEqual(c.toSaved(), {});
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

  test("the overworld camera starts facing north (no turns), which isn't saved", () => {
    const c = new CameraSettings();
    assert.equal(c.get().overworldTurns, 0);
    assert.deepEqual(c.toSaved(), {});
  });

  test("turning the overworld camera goes any part of a quarter turn each way and wraps round", () => {
    const c = new CameraSettings();
    c.turnOverworld(1);
    assert.equal(c.get().overworldTurns, 1);
    c.turnOverworld(-1);
    c.turnOverworld(-1);
    assert.equal(c.get().overworldTurns, OVERWORLD_CAMERA_ANGLES - 1);
    for (let i = 0; i < OVERWORLD_CAMERA_ANGLES; i++) c.turnOverworld(1);
    assert.equal(c.get().overworldTurns, OVERWORLD_CAMERA_ANGLES - 1);
    c.turnOverworld(1.25);
    assert.equal(c.get().overworldTurns, 0.25);
    c.turnOverworld(0);
    assert.equal(c.get().overworldTurns, 0.25);
  });

  test("the overworld turns are saved and restored, apart from the sensitivity", () => {
    const c = new CameraSettings();
    c.turnOverworld(-1);
    assert.deepEqual(c.toSaved(), { overworldTurns: OVERWORLD_CAMERA_ANGLES - 1 });
    c.setSensitivity(2);
    const copy = new CameraSettings();
    copy.restore(c.toSaved());
    assert.deepEqual(copy.get(), { sensitivity: 2, overworldTurns: OVERWORLD_CAMERA_ANGLES - 1 });
  });

  test("part of a turn is restored as it was; unreadable turns face north", () => {
    const part = new CameraSettings();
    part.restore({ overworldTurns: 1.5 });
    assert.equal(part.get().overworldTurns, 1.5);
    for (const overworldTurns of [-1, OVERWORLD_CAMERA_ANGLES, NaN]) {
      const c = new CameraSettings();
      c.turnOverworld(1);
      c.restore({ overworldTurns });
      assert.equal(c.get().overworldTurns, 0, String(overworldTurns));
    }
  });

  test("reset brings back the default sensitivity but keeps the way the overworld camera looks", () => {
    const c = new CameraSettings();
    c.turnOverworld(1);
    c.setSensitivity(2);
    assert.equal(c.sensitivityIsDefault(), false);
    c.reset();
    assert.equal(c.sensitivityIsDefault(), true);
    assert.equal(c.get().overworldTurns, 1);
    assert.deepEqual(c.toSaved(), { overworldTurns: 1 });
  });
});
