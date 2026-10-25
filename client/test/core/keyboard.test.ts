import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Keyboard } from "../../src/core/keyboard.js";

/** A stand-in for window: Node's EventTarget, fed plain Events carrying the KeyboardEvent fields we read. */
function setup() {
  const target = new EventTarget();
  const keyboard = new Keyboard(target as unknown as Window);
  keyboard.enabled = true;
  const send = (type: string, code = "", repeat = false) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { code, repeat });
    target.dispatchEvent(event);
    return event;
  };
  return { keyboard, send };
}

describe("Keyboard", () => {
  test("a key is held from keydown to keyup", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyW");
    assert.equal(keyboard.isDown(["KeyW"]), true);
    assert.equal(keyboard.isDown(["KeyS", "KeyW"]), true);
    assert.equal(keyboard.isDown(["KeyS"]), false);
    send("keyup", "KeyW");
    assert.equal(keyboard.isDown(["KeyW"]), false);
  });

  test("a tap is latched until consumed, once", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    send("keyup", "KeyJ");
    assert.equal(keyboard.consumePressed(["KeyJ"]), true);
    assert.equal(keyboard.consumePressed(["KeyJ"]), false);
  });

  test("consuming one key leaves other keys' presses latched", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    send("keydown", "KeyK");
    assert.equal(keyboard.consumePressed(["KeyJ"]), true);
    assert.equal(keyboard.consumePressed(["KeyK"]), true);
  });

  test("auto-repeat counts as held, not as a new press", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    keyboard.consumePressed(["KeyJ"]);
    send("keydown", "KeyJ", true);
    assert.equal(keyboard.consumePressed(["KeyJ"]), false);
    assert.equal(keyboard.isDown(["KeyJ"]), true);
  });

  test("clearPressed forgets latched presses but not held keys", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyJ");
    keyboard.clearPressed();
    assert.equal(keyboard.consumePressed(["KeyJ"]), false);
    assert.equal(keyboard.isDown(["KeyJ"]), true);
  });

  test("losing focus lets go of every held key", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyW");
    send("keydown", "KeyD");
    send("blur");
    assert.equal(keyboard.isDown(["KeyW", "KeyD"]), false);
  });

  test("while disabled, keys are ignored and left to the page", () => {
    const { keyboard, send } = setup();
    keyboard.enabled = false;
    const event = send("keydown", "Space");
    assert.equal(keyboard.isDown(["Space"]), false);
    assert.equal(event.defaultPrevented, false);
  });

  test("disabling forgets held keys and latched presses", () => {
    const { keyboard, send } = setup();
    send("keydown", "KeyW");
    keyboard.enabled = false;
    keyboard.enabled = true;
    assert.equal(keyboard.isDown(["KeyW"]), false);
    assert.equal(keyboard.consumePressed(["KeyW"]), false);
  });

  test("keys the browser would scroll or move focus with are swallowed; letters are not", () => {
    const { send } = setup();
    for (const code of ["Space", "ArrowUp", "Tab"]) assert.equal(send("keydown", code).defaultPrevented, true, code);
    assert.equal(send("keydown", "KeyW").defaultPrevented, false);
  });

  test("axis gives -1, 0 or 1", () => {
    const { keyboard, send } = setup();
    const axis = () => keyboard.axis(["KeyA"], ["KeyD"]);
    assert.equal(axis(), 0);
    send("keydown", "KeyD");
    assert.equal(axis(), 1);
    send("keydown", "KeyA");
    assert.equal(axis(), 0);
    send("keyup", "KeyD");
    assert.equal(axis(), -1);
  });
});
