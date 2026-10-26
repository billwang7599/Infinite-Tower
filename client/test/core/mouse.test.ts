import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Mouse, shouldAutoLock } from "../../src/core/mouse.js";

/** What the browser does with a lock request: grant it, refuse it, or answer later (`grant()`). */
type Answer = "grant" | "refuse" | "later";

/**
 * Stand-ins for the canvas, document and window: Node's EventTargets with the pointer-lock parts Mouse uses. A
 * granted lock sets `pointerLockElement` and fires pointerlockchange, as the browser does.
 */
function setup(answer: Answer = "grant") {
  const doc = Object.assign(new EventTarget(), {
    pointerLockElement: null as unknown,
    exits: 0,
    exitPointerLock() {
      doc.exits++;
      lockChange(null);
    },
  });
  const lockChange = (element: unknown) => {
    doc.pointerLockElement = element;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  const grant = () => lockChange(canvas);
  const canvas = Object.assign(new EventTarget(), {
    requests: 0,
    requestPointerLock(): Promise<void> {
      canvas.requests++;
      if (answer === "grant") grant();
      return answer === "refuse" ? Promise.reject(new DOMException("no user gesture", "NotAllowedError"))
        : Promise.resolve();
    },
  });
  const mouse = new Mouse(
    canvas as unknown as HTMLCanvasElement, doc as unknown as Document, new EventTarget() as unknown as Window,
  );
  const click = () => canvas.dispatchEvent(new Event("click"));
  /** The player presses Esc: the browser lets go of the lock. */
  const escape = () => lockChange(null);
  return { mouse, canvas, doc, click, escape, grant };
}

describe("shouldAutoLock", () => {
  const base = { wasLockable: false, lockable: true, autoLock: true, locked: false };

  test("locks as the mouse becomes capturable (a battle starts, a screen over it closes)", () => {
    assert.equal(shouldAutoLock(base), true);
  });

  test("not with the setting off", () => {
    assert.equal(shouldAutoLock({ ...base, autoLock: false }), false);
  });

  test("not while it stays capturable, so a lock let go with Esc mid-fight stays let go", () => {
    assert.equal(shouldAutoLock({ ...base, wasLockable: true }), false);
  });

  test("not when it isn't capturable, nor when it's already locked", () => {
    assert.equal(shouldAutoLock({ ...base, lockable: false }), false);
    assert.equal(shouldAutoLock({ ...base, wasLockable: true, lockable: false }), false);
    assert.equal(shouldAutoLock({ ...base, locked: true }), false);
  });
});

describe("Mouse lock", () => {
  test("with auto lock on, becoming lockable asks for the lock, once", () => {
    const { mouse, canvas } = setup();
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    assert.equal(canvas.requests, 1);
    assert.equal(mouse.locked, true);
    mouse.setLockable(true, true);
    assert.equal(canvas.requests, 1);
  });

  test("with auto lock off, nothing is asked until a click", () => {
    const { mouse, canvas, click } = setup();
    mouse.setLockable(false, false);
    mouse.setLockable(true, false);
    assert.equal(canvas.requests, 0);
    click();
    assert.equal(canvas.requests, 1);
    assert.equal(mouse.locked, true);
  });

  test("a click asks nothing while the mouse isn't wanted", () => {
    const { mouse, canvas, click } = setup();
    mouse.setLockable(false, true);
    click();
    assert.equal(canvas.requests, 0);
  });

  test("a refused request is dropped quietly, and a click still asks", async () => {
    const { mouse, canvas, click } = setup("refuse");
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    await new Promise(setImmediate);
    assert.equal(mouse.locked, false);
    click();
    await new Promise(setImmediate);
    assert.equal(canvas.requests, 2);
    await assert.doesNotReject(mouse.lock());
  });

  test("let go with Esc mid-fight, it isn't taken back; leaving and coming back locks again", () => {
    const { mouse, canvas, escape } = setup();
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    escape();
    assert.equal(mouse.locked, false);
    mouse.setLockable(true, true);
    assert.equal(canvas.requests, 1);
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    assert.equal(canvas.requests, 2);
    assert.equal(mouse.locked, true);
  });

  test("no longer lockable (leaving the battle, a screen opens) lets go of the lock", () => {
    const { mouse, doc } = setup();
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    mouse.setLockable(false, true);
    assert.equal(doc.exits, 1);
    assert.equal(mouse.locked, false);
  });

  test("a lock granted after the mouse stopped being wanted is let go at once", () => {
    const { mouse, doc, grant } = setup("later");
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    mouse.setLockable(false, true);
    grant();
    assert.equal(doc.exits, 1);
    assert.equal(mouse.locked, false);
  });
});
