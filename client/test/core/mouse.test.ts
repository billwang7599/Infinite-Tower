import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Mouse, shouldAutoLock } from "../../src/core/mouse.js";
import { fakePointerLock, settle, type LockAnswer } from "../fixtures/pointer-lock.js";

function setup(answer: LockAnswer = "grant") {
  const { win, doc, canvas, grant, escape, blur } = fakePointerLock(answer);
  const mouse = new Mouse(canvas as unknown as HTMLCanvasElement, doc as unknown as Document, win);
  const click = (button = 0) =>
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { button, buttons: [1, 4, 2][button] }));
  const changes: { locked: boolean; byPlayer: boolean }[] = [];
  mouse.onLock((locked, byPlayer) => changes.push({ locked, byPlayer }));
  return { mouse, canvas, doc, click, escape, grant, blur, changes };
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

  test("Esc held as it becomes wanted, the lock waits for Esc to come up; not wanted by then, nothing's asked", () => {
    const { mouse, canvas } = setup();
    mouse.setLockable(true, true, true);
    assert.equal(canvas.requests.length, 0);
    mouse.lockIfDue();
    mouse.lockIfDue();
    assert.equal(canvas.requests.length, 1);
    assert.equal(mouse.locked, true);
    mouse.setLockable(false, true);
    mouse.setLockable(true, true, true);
    mouse.setLockable(false, true);
    mouse.lockIfDue();
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

  test("a press with any button on the game asks for it", () => {
    for (const button of [0, 1, 2]) {
      const { mouse, canvas, click } = setup();
      mouse.setLockable(true, false);
      click(button);
      assert.equal(canvas.requests.length, 1, `${button}`);
      assert.equal(mouse.locked, true);
    }
  });

  test("a drag's lock asks for raw movement; still held as the mouse becomes wanted, it's asked again for the OS's", () => {
    const { mouse, canvas } = setup();
    mouse.lockWhileHeld(["Mouse2"]);
    mouse.setLockable(true, true);
    mouse.setLockable(true, true);
    assert.deepEqual(canvas.requests, [{ unadjustedMovement: true }, { unadjustedMovement: false }]);
    assert.equal(mouse.locked, true);
  });

  test("a lock lost while still wanted is the player's (Esc); let go by the game or with the window's focus, it isn't", () => {
    const { mouse, escape, changes } = setup();
    mouse.setLockable(true, true);
    escape();
    mouse.setLockable(false, true);
    mouse.setLockable(true, true);
    mouse.setLockable(false, true);
    assert.deepEqual(changes, [
      { locked: true, byPlayer: false }, { locked: false, byPlayer: true },
      { locked: true, byPlayer: false }, { locked: false, byPlayer: false },
    ]);
    const lostFocus = setup();
    lostFocus.mouse.setLockable(true, true);
    lostFocus.blur();
    assert.deepEqual(lostFocus.changes.at(-1), { locked: false, byPlayer: false });
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
