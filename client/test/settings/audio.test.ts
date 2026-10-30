import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AudioSettings, VOLUME, VOLUMES } from "../../src/settings/audio.js";

describe("AudioSettings", () => {
  test("starts at the defaults, which save as nothing", () => {
    const a = new AudioSettings();
    assert.deepEqual(a.get(), VOLUME.defaults);
    assert.deepEqual(a.toSaved(), {});
  });

  test("saves only what differs, and restore(toSaved()) gives it back", () => {
    const a = new AudioSettings();
    a.setVolume("ambient", 0.25);
    assert.deepEqual(a.toSaved(), { ambient: 0.25 });
    const copy = new AudioSettings();
    copy.restore(JSON.parse(JSON.stringify(a.toSaved())));
    assert.deepEqual(copy.get(), a.get());
  });

  test("set: kept from 0 to 1 and on the slider's step", () => {
    const a = new AudioSettings();
    a.setVolume("master", 3);
    assert.equal(a.get().master, 1);
    a.setVolume("master", -1);
    assert.equal(a.get().master, 0);
    a.setVolume("effects", 0.5 + VOLUME.step + 0.001);
    assert.equal(a.get().effects, 0.5 + VOLUME.step);
  });

  test("each volume reads back on its own: a save without it, out of range or unreadable is its default", () => {
    const junk: unknown[] = [undefined, null, {}, { master: 2 }, { master: -0.5 }, { master: "0.5" }];
    for (const saved of junk) {
      const a = new AudioSettings();
      a.setVolume("master", 0.1);
      a.restore(saved as Parameters<AudioSettings["restore"]>[0]);
      assert.equal(a.get().master, VOLUME.defaults.master, JSON.stringify(saved));
    }
    const a = new AudioSettings();
    a.restore({ master: 0, ambient: 0.5 });
    assert.deepEqual(a.get(), { ...VOLUME.defaults, master: 0, ambient: 0.5 });
  });

  test("isDefault tells each volume apart", () => {
    const a = new AudioSettings();
    a.setVolume("effects", 0.3);
    assert.deepEqual(VOLUMES.map((v) => a.isDefault(v)), VOLUMES.map((v) => v !== "effects"));
  });
});
