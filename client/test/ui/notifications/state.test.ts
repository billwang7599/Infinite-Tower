import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Notifications } from "../../../src/ui/notifications/state.js";

const { MAX_NOTICES } = Notifications;
const listed = (to: Notifications) => to.notices.get().items.map((n) => n.text);
/** Without the ones fading out. */
const showing = (to: Notifications) => to.notices.get().items.filter((n) => !n.leaving).map((n) => n.text);
const banner = (to: Notifications) => to.announcement.get().current?.text ?? null;

describe("Notifications notices (the corner)", () => {
  test("notices stack up in the order given, newest last", () => {
    const to = new Notifications();
    to.notify("a");
    to.notify("b");
    assert.deepEqual(listed(to), ["a", "b"]);
    assert.deepEqual(showing(to), ["a", "b"]);
  });

  test("up to the cap, none is leaving", () => {
    const to = new Notifications();
    for (let i = 0; i < MAX_NOTICES; i++) to.notify(`n${i}`);
    assert.equal(showing(to).length, MAX_NOTICES);
    assert.equal(listed(to).length, MAX_NOTICES);
  });

  test("one over the cap: the oldest is still listed, leaving (it fades out), the rest stay", () => {
    const to = new Notifications();
    for (let i = 0; i <= MAX_NOTICES; i++) to.notify(`n${i}`);
    const items = to.notices.get().items;
    assert.equal(items.length, MAX_NOTICES + 1);
    assert.deepEqual(items.map((n) => n.leaving), [true, ...Array<boolean>(MAX_NOTICES).fill(false)]);
    assert.equal(items[0]!.text, "n0");
  });

  test("many at once: the newest MAX_NOTICES show, in order", () => {
    const to = new Notifications();
    for (let i = 0; i < 20; i++) to.notify(`n${i}`);
    const newest = Array.from({ length: MAX_NOTICES }, (_, i) => `n${20 - MAX_NOTICES + i}`);
    assert.deepEqual(showing(to), newest);
  });

  test("leaving ones that are never dismissed don't pile up", () => {
    const to = new Notifications();
    for (let i = 0; i < 500; i++) to.notify(`n${i}`);
    assert.ok(listed(to).length <= 2 * MAX_NOTICES, `${listed(to).length} listed`);
    assert.equal(showing(to).length, MAX_NOTICES);
  });

  test("every notice gets its own id, even with the same text", () => {
    const to = new Notifications();
    to.notify("same");
    to.notify("same");
    const [a, b] = to.notices.get().items;
    assert.notEqual(a!.id, b!.id);
  });

  test("dismissing removes only that notice, and works unbound", () => {
    const to = new Notifications();
    to.notify("a");
    to.notify("b");
    to.notify("c");
    const { dismissNotice } = to;
    dismissNotice(to.notices.get().items[1]!.id);
    assert.deepEqual(listed(to), ["a", "c"]);
  });

  test("dismissing a leaving notice removes it", () => {
    const to = new Notifications();
    for (let i = 0; i <= MAX_NOTICES; i++) to.notify(`n${i}`);
    to.dismissNotice(to.notices.get().items[0]!.id);
    assert.deepEqual(listed(to), showing(to));
    assert.equal(listed(to).length, MAX_NOTICES);
  });

  test("dismissing an unknown id changes nothing", () => {
    const to = new Notifications();
    to.notify("a");
    to.dismissNotice(9999);
    assert.deepEqual(listed(to), ["a"]);
  });

  test("a notice isn't a banner", () => {
    const to = new Notifications();
    to.notify("a");
    assert.equal(banner(to), null);
  });
});

describe("Notifications announcement (the centre banner)", () => {
  test("announcing puts up the banner, and adds no notice", () => {
    const to = new Notifications();
    to.announce("A fight!");
    assert.equal(banner(to), "A fight!");
    assert.deepEqual(listed(to), []);
  });

  test("one at a time: a new one replaces the old, with its own id", () => {
    const to = new Notifications();
    to.announce("same");
    const first = to.announcement.get().current!;
    to.announce("same");
    const second = to.announcement.get().current!;
    assert.equal(second.text, "same");
    assert.notEqual(second.id, first.id);
  });

  test("dismissing takes the banner down, and works unbound", () => {
    const to = new Notifications();
    to.announce("a");
    const { dismissAnnouncement } = to;
    dismissAnnouncement(to.announcement.get().current!.id);
    assert.equal(banner(to), null);
  });

  test("dismissing one that was replaced leaves the new one up", () => {
    const to = new Notifications();
    to.announce("old");
    const old = to.announcement.get().current!.id;
    to.announce("new");
    to.dismissAnnouncement(old);
    assert.equal(banner(to), "new");
  });
});

describe("Notifications clear", () => {
  test("takes down the banner and every notice", () => {
    const to = new Notifications();
    for (let i = 0; i <= MAX_NOTICES; i++) to.notify(`n${i}`);
    to.announce("a");
    to.clear();
    assert.deepEqual(listed(to), []);
    assert.equal(banner(to), null);
  });
});
