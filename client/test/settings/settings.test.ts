import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";
import { createSettings, restoreSettings, syncSettings } from "../../src/settings/settings.js";
import { FakeNet } from "../fixtures/fake-net.js";

/** Long enough for any send delay. */
const LATER_MS = 60_000;

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const settings = createSettings();
  const net = new FakeNet();
  const stop = syncSettings(settings, net);
  return { settings, net, stop };
}

describe("createSettings / restoreSettings", () => {
  test("new settings are the defaults", () => {
    const settings = createSettings();
    assert.equal(settings.bindings.isDefault(), true);
    assert.deepEqual(settings.camera.toSaved(), {});
    assert.deepEqual(settings.mouse.toSaved(), {});
    assert.equal(settings.hud.isDefault(), true);
  });

  test("restoreSettings fills every store from the save", () => {
    const settings = createSettings();
    restoreSettings(settings, {
      bindings: { battle: { jump: ["KeyX"] } }, camera: { sensitivity: 2 }, mouse: { autoLock: false },
      hud: { showPing: false },
    });
    assert.deepEqual(settings.bindings.toSaved(), { battle: { jump: ["KeyX"] } });
    assert.equal(settings.camera.get().sensitivity, 2);
    assert.equal(settings.mouse.get().autoLock, false);
    assert.equal(settings.hud.get().showPing, false);
  });

  test("restoreSettings loads key bindings saved under the old group name `field` as the overworld's", () => {
    const settings = createSettings();
    restoreSettings(settings, { bindings: { field: { rest: ["KeyF"] } }, camera: { sensitivity: 2 } });
    assert.deepEqual(settings.bindings.get().overworld.rest, ["KeyF"]);
    assert.deepEqual(settings.bindings.toSaved(), { overworld: { rest: ["KeyF"] } });
  });

  test("restoreSettings with an empty save (or one from before auto lock existed) resets every store", () => {
    const settings = createSettings();
    settings.camera.setSensitivity(2);
    settings.bindings.bind({ group: "battle", action: "turnLeft" }, "KeyZ", null);
    settings.mouse.setAutoLock(false);
    settings.hud.setShowPing(false);
    restoreSettings(settings, {});
    assert.equal(settings.bindings.isDefault(), true);
    assert.deepEqual(settings.camera.toSaved(), {});
    assert.equal(settings.mouse.get().autoLock, true);
    assert.equal(settings.hud.get().showPing, true);
  });
});

describe("syncSettings", () => {
  test("sends nothing until something changes", (t) => {
    const { net } = setup(t);
    t.mock.timers.tick(LATER_MS);
    assert.deepEqual(net.sent, []);
  });

  test("a burst of changes goes out as one message, after a delay", (t) => {
    const { settings, net } = setup(t);
    settings.camera.setSensitivity(1.5);
    settings.camera.setSensitivity(2);
    settings.bindings.bind({ group: "battle", action: "jump" }, "KeyX", null);
    t.mock.timers.tick(1);
    assert.deepEqual(net.sent, []);
    t.mock.timers.tick(LATER_MS);
    assert.equal(net.sent.length, 1);
  });

  test("each change pushes the send back", (t) => {
    const { settings, net } = setup(t);
    for (let i = 0; i < 50; i++) {
      settings.camera.setSensitivity(i % 2 ? 1.5 : 2);
      t.mock.timers.tick(1);
    }
    assert.deepEqual(net.sent, []);
    t.mock.timers.tick(LATER_MS);
    assert.equal(net.sent.length, 1);
  });

  test("the message holds every store's saved form, and passes the server's check", (t) => {
    const { settings, net } = setup(t);
    settings.camera.setSensitivity(2);
    settings.bindings.bind({ group: "battle", action: "jump" }, "KeyX", null);
    settings.mouse.setAutoLock(false);
    settings.hud.setShowPing(false);
    t.mock.timers.tick(LATER_MS);
    const expected = {
      t: "settings",
      settings: {
        bindings: { battle: { jump: ["Space", "KeyX"] } }, camera: { sensitivity: 2 }, mouse: { autoLock: false },
        hud: { showPing: false },
      },
    };
    assert.deepEqual(net.sent, [expected]);
    assert.deepEqual(parseClientMsg(JSON.stringify(net.sent[0])), expected);
  });

  test("changing back to the defaults still sends, with empty saves", (t) => {
    const { settings, net } = setup(t);
    settings.camera.setSensitivity(2);
    t.mock.timers.tick(LATER_MS);
    settings.camera.reset();
    t.mock.timers.tick(LATER_MS);
    assert.deepEqual(net.sent.at(-1), { t: "settings", settings: { bindings: {}, camera: {}, mouse: {}, hud: {} } });
  });

  test("switching auto lock sends it", (t) => {
    const { settings, net } = setup(t);
    settings.mouse.setAutoLock(false);
    t.mock.timers.tick(LATER_MS);
    const sent = net.sent.at(-1);
    assert.deepEqual(sent?.t === "settings" && sent.settings.mouse, { autoLock: false });
  });

  test("stop() sends a waiting change at once", (t) => {
    const { settings, net, stop } = setup(t);
    settings.camera.setSensitivity(2);
    stop();
    assert.equal(net.sent.length, 1);
    t.mock.timers.tick(LATER_MS);
    assert.equal(net.sent.length, 1);
  });

  test("stop() with nothing waiting sends nothing", (t) => {
    const { settings, net, stop } = setup(t);
    settings.camera.setSensitivity(2);
    t.mock.timers.tick(LATER_MS);
    stop();
    assert.equal(net.sent.length, 1);
  });

  test("after stop(), changes send nothing", (t) => {
    const { settings, net, stop } = setup(t);
    stop();
    settings.camera.setSensitivity(2);
    settings.bindings.bind({ group: "battle", action: "jump" }, "KeyX", null);
    t.mock.timers.tick(LATER_MS);
    assert.deepEqual(net.sent, []);
  });
});
