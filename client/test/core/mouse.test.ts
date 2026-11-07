import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Mouse, shouldAutoLock } from "../../src/core/mouse.js";
import { fakePointerLock, settle, type LockAnswer } from "../fixtures/pointer-lock.js";

function setup(answer: LockAnswer = "grant") {
  const { win, doc, canvas, grant, escape } = fakePointerLock(answer);
  const mouse = new Mouse(canvas as unknown as HTMLCanvasElement, doc as unknown as Document, win);
  const click = () => canvas.dispatchEvent(new Event("click"));
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
    assert.equal(canvas.requests.length, 1);
    assert.equal(mouse.locked, true);
    mouse.setLockable(true, true);
    assert.equal(canvas.requests.length, 1);
  });

  test("with auto lock off, nothing is asked until a click", () => {
    const { mouse, canvas, click } = setup();
    mouse.setLockable(false, false);
    mouse.setLockable(true, false);
    assert.equal(canvas.requests.length, 0);
    click();
    assert.equal(canvas.requests.length, 1);
    assert.equal(mouse.locked, true);
  });

  test("a click asks nothing while the mouse isn't wanted", () => {
    const { mouse, canvas, click } = setup();
    mouse.setLockable(false, true);
    click();
    assert.equal(canvas.requests.length, 0);
  });

  test("a refused request is dropped quietly, and a click still asks", async () => {
    const { mouse, canvas, click } = setup("refuse");
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    await settle();
    assert.equal(mouse.locked, false);
    click();
    await settle();
    assert.equal(canvas.requests.length, 2);
    await assert.doesNotReject(mouse.lock());
  });

  test("let go with Esc mid-fight, it isn't taken back; leaving and coming back locks again", () => {
    const { mouse, canvas, escape } = setup();
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    escape();
    assert.equal(mouse.locked, false);
    mouse.setLockable(true, true);
    assert.equal(canvas.requests.length, 1);
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    assert.equal(canvas.requests.length, 2);
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
