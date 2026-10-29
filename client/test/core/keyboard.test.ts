import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Keyboard } from "../../src/core/keyboard.js";

interface Sent {
  repeat?: boolean;
  tagName?: string;
  enterKeyHint?: string;
}

/** A stand-in for window: Node's EventTarget, fed plain Events carrying the KeyboardEvent fields we read. */
function setup(use: (key: string) => boolean = () => false) {
  const target = new EventTarget();
  const keyboard = new Keyboard(target as unknown as Window);
  const heard: [string, boolean][] = [];
  keyboard.listen((key, repeat) => {
    heard.push([key, repeat]);
    return use(key);
  });
  const send = (type: string, code = "", { repeat = false, tagName, enterKeyHint }: Sent = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { code, repeat });
    if (tagName) Object.defineProperty(event, "target", { value: { tagName, enterKeyHint } });
    target.dispatchEvent(event);
    return event;
  };
  return { keyboard, send, heard };
}

describe("Keyboard: held keys and presses", () => {
  test("a key is held from keydown to keyup", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyW");
    assert.deepEqual([...keyboard.held], ["KeyW"]);
    send("keyup", "KeyW");
    assert.deepEqual([...keyboard.held], []);
  });

  test("a tap is latched until cleared", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    send("keyup", "KeyJ");
    assert.deepEqual([...keyboard.presses.keys()], ["KeyJ"]);
  });

  test("auto-repeat counts as held, not as a new press", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    keyboard.clearPressed();
    send("keydown", "KeyJ", { repeat: true });
    assert.equal(keyboard.presses.size, 0);
    assert.equal(keyboard.held.has("KeyJ"), true);
  });

  test("clearPressed forgets latched presses but not held keys", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    keyboard.clearPressed();
    assert.equal(keyboard.presses.size, 0);
    assert.equal(keyboard.held.has("KeyJ"), true);
  });

  test("losing focus lets go of every held key", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyW");
    send("keydown", "KeyD");
    send("blur");
    assert.equal(keyboard.held.size, 0);
  });

  test("presses are counted in the order they came; a key pressed again counts anew", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    send("keydown", "KeyI");
    assert.ok(keyboard.presses.get("KeyJ")! < keyboard.presses.get("KeyI")!);
    send("keyup", "KeyJ");
    send("keydown", "KeyJ");
    assert.ok(keyboard.presses.get("KeyJ")! > keyboard.presses.get("KeyI")!);
  });

  test("held keys stay held whoever has the keys: the keyboard knows no actions or layers", () => {
    const { keyboard, send, heard } = setup();
    send("keydown", "KeyW");
    send("keydown", "Escape");
    assert.deepEqual([...keyboard.held], ["KeyW", "Escape"]);
    assert.deepEqual(heard, [["KeyW", false], ["Escape", false]]);
  });
});

describe("Keyboard: its listener", () => {
  test("gets every key raw, with auto-repeat flagged", () => {
    const { send, heard } = setup();
    send("keydown", "KeyE");
    send("keydown", "KeyE", { repeat: true });
    assert.deepEqual(heard, [["KeyE", false], ["KeyE", true]]);
  });

  test("a key it uses is kept from the page; one it doesn't is left to it", () => {
    const { send } = setup((key) => key === "Enter");
    assert.equal(send("keydown", "Enter").defaultPrevented, true);
    assert.equal(send("keydown", "Space").defaultPrevented, false);
  });

  test("a press is latched before the listener hears it, so it can clear it", () => {
    const { keyboard, send } = setup(() => {
      keyboard.clearPressed();
      return true;
    });
    send("keydown", "KeyB");
    assert.equal(keyboard.presses.size, 0);
  });
});

describe("Keyboard: typing in a text field", () => {
  test("letters, Space and Enter stay the field's: nobody hears them, the page keeps them", () => {
    const { keyboard, send, heard } = setup(() => true);
    for (const code of ["KeyW", "KeyJ", "Space", "Enter"]) {
      assert.equal(send("keydown", code, { tagName: "INPUT" }).defaultPrevented, false, code);
    }
    assert.deepEqual(heard, []);
    assert.equal(keyboard.held.size, 0);
  });

  test("the arrows and Esc still count", () => {
    const { send, heard } = setup();
    for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"]) {
      send("keydown", code, { tagName: "INPUT" });
    }
    assert.deepEqual(heard.map(([key]) => key), ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"]);
  });

  test("digits and Backspace count too (a skill's word search), but stay the field's if nobody uses them", () => {
    const { send, heard } = setup((key) => key === "Digit3");
    assert.equal(send("keydown", "Digit3", { tagName: "INPUT" }).defaultPrevented, true);
    assert.equal(send("keydown", "Digit5", { tagName: "INPUT" }).defaultPrevented, false);
    assert.equal(send("keydown", "Backspace", { tagName: "INPUT" }).defaultPrevented, false);
    assert.deepEqual(heard.map(([key]) => key), ["Digit3", "Digit5", "Backspace"]);
  });

  test("Enter counts in a field whose Enter sends (the chat's); its letters and Space stay the field's", () => {
    const { send, heard } = setup((key) => key === "Enter");
    const chat = { tagName: "INPUT", enterKeyHint: "send" };
    assert.equal(send("keydown", "Enter", chat).defaultPrevented, true);
    assert.equal(send("keydown", "KeyW", chat).defaultPrevented, false);
    assert.equal(send("keydown", "Space", chat).defaultPrevented, false);
    assert.deepEqual(heard.map(([key]) => key), ["Enter"]);
  });

  test("keys pressed anywhere else count as usual", () => {
    const { send, heard } = setup();
    send("keydown", "KeyW", { tagName: "BUTTON" });
    assert.deepEqual(heard, [["KeyW", false]]);
  });
});

describe("Keyboard: taking the next key raw (rebinding)", () => {
  test("the next key goes raw to the capture, kept from the page and from the listener", () => {
    const { keyboard, send, heard } = setup();
    const taken: string[] = [];
    keyboard.captureKey((key) => taken.push(key) > 0);
    const event = send("keydown", "Escape");
    send("keydown", "Escape");
    assert.deepEqual(taken, ["Escape"], "one key, then the capture is over");
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(heard, [["Escape", false]], "only the key after it");
  });

  test("a key the capture turns down leaves it waiting, still kept from the page; repeats are skipped", () => {
    const { keyboard, send } = setup();
    const offered: string[] = [];
    keyboard.captureKey((key) => {
      offered.push(key);
      return key !== "MetaLeft";
    });
    assert.equal(send("keydown", "MetaLeft").defaultPrevented, true);
    assert.equal(send("keydown", "KeyQ", { repeat: true }).defaultPrevented, true);
    send("keydown", "KeyQ");
    send("keydown", "KeyZ");
    assert.deepEqual(offered, ["MetaLeft", "KeyQ"]);
  });

  test("it takes keys from any target, and holds none", () => {
    const { keyboard, send } = setup();
    const taken: string[] = [];
    keyboard.captureKey((key) => taken.push(key) > 0);
    send("keydown", "KeyW", { tagName: "INPUT" });
    assert.deepEqual(taken, ["KeyW"]);
    assert.equal(keyboard.held.size, 0);
  });

  test("cancelled, it takes nothing; an old capture's cancel doesn't end a newer one", () => {
    const { keyboard, send } = setup();
    const first: string[] = [], second: string[] = [];
    const cancelFirst = keyboard.captureKey((key) => first.push(key) > 0);
    cancelFirst();
    send("keydown", "KeyX");
    assert.deepEqual(first, []);
    keyboard.captureKey((key) => second.push(key) > 0);
    cancelFirst();
    send("keydown", "KeyY");
    assert.deepEqual(second, ["KeyY"]);
  });
});
