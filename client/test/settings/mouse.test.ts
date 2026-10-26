import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MouseSettings } from "../../src/settings/mouse.js";

const autoLock = (m: MouseSettings) => m.get().autoLock;

describe("MouseSettings", () => {
  test("auto lock starts on", () => {
    const m = new MouseSettings();
    assert.equal(autoLock(m), true);
    assert.equal(m.isDefault(), true);
  });

  test("toSaved is empty when on and says so when off", () => {
    const m = new MouseSettings();
    assert.deepEqual(m.toSaved(), {});
    m.setAutoLock(false);
    assert.deepEqual(m.toSaved(), { autoLock: false });
    assert.equal(m.isDefault(), false);
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
