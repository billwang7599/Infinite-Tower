import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MouseSettings, SWING_SENSITIVITY } from "../../src/settings/mouse.js";

const autoLock = (m: MouseSettings) => m.get().autoLock;

describe("MouseSettings", () => {
  test("auto lock starts on", () => {
    const m = new MouseSettings();
    assert.equal(autoLock(m), true);
    assert.deepEqual(m.toSaved(), {});
  });

  test("toSaved is empty when on and says so when off", () => {
    const m = new MouseSettings();
    assert.deepEqual(m.toSaved(), {});
    m.setAutoLock(false);
    assert.deepEqual(m.toSaved(), { autoLock: false });
  });

  test("restore keeps an explicit choice", () => {
    for (const value of [false, true]) {
      const m = new MouseSettings();
      m.setAutoLock(!value);
      m.restore({ autoLock: value });
      assert.equal(autoLock(m), value);
    }
  });

  test("a save from before the setting existed, or an unreadable one, reads as on", () => {
    const junk: unknown[] = [undefined, {}, { autoLock: "false" }, { autoLock: 0 }, { autoLock: null }];
    for (const saved of junk) {
      const m = new MouseSettings();
      m.setAutoLock(false);
      m.restore(saved as Parameters<MouseSettings["restore"]>[0]);
      assert.equal(autoLock(m), true, JSON.stringify(saved));
    }
  });

  test("restore(toSaved()) gives back the same choice", () => {
    const m = new MouseSettings();
    m.setAutoLock(false);
    const copy = new MouseSettings();
    copy.restore(m.toSaved());
    assert.equal(autoLock(copy), false);
  });

  test("listeners hear a change, and nothing when it's set to what it already is", () => {
    const m = new MouseSettings();
    let calls = 0;
    m.subscribe(() => calls++);
    m.setAutoLock(true);
    assert.equal(calls, 0);
    m.setAutoLock(false);
    assert.equal(calls, 1);
  });
});

describe("MouseSettings: swing sensitivity", () => {
  const sensitivity = (m: MouseSettings) => m.get().swingSensitivity;

  test("starts at its default, saved only once changed", () => {
    const m = new MouseSettings();
    assert.equal(sensitivity(m), SWING_SENSITIVITY.default);
    m.setSwingSensitivity(SWING_SENSITIVITY.max);
    assert.deepEqual(m.toSaved(), { swingSensitivity: SWING_SENSITIVITY.max });
    const copy = new MouseSettings();
    copy.restore(m.toSaved());
    assert.equal(sensitivity(copy), SWING_SENSITIVITY.max);
  });

  test("set: kept in range and on the slider's step", () => {
    const m = new MouseSettings();
    m.setSwingSensitivity(SWING_SENSITIVITY.max + 5);
    assert.equal(sensitivity(m), SWING_SENSITIVITY.max);
    m.setSwingSensitivity(SWING_SENSITIVITY.min - 5);
    assert.equal(sensitivity(m), SWING_SENSITIVITY.min);
    m.setSwingSensitivity(1 + SWING_SENSITIVITY.step + 0.001);
    assert.equal(sensitivity(m), 1 + SWING_SENSITIVITY.step);
  });

  test("a save without it, out of range or unreadable reads as the default; auto lock is kept apart", () => {
    const junk: unknown[] = [{}, { swingSensitivity: SWING_SENSITIVITY.max + 1 }, { swingSensitivity: "2" }];
    for (const saved of junk) {
      const m = new MouseSettings();
      m.setSwingSensitivity(SWING_SENSITIVITY.max);
      m.restore(saved as Parameters<MouseSettings["restore"]>[0]);
      assert.equal(sensitivity(m), SWING_SENSITIVITY.default, JSON.stringify(saved));
    }
    const m = new MouseSettings();
    m.restore({ autoLock: false, swingSensitivity: SWING_SENSITIVITY.min });
    assert.deepEqual(m.get(), { autoLock: false, swingSensitivity: SWING_SENSITIVITY.min });
  });
});
