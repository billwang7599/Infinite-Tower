import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyStatus, type StatusOn } from "@infinite-tower/shared";
import { statusIcons } from "../../../src/modes/battle/hud.js";
import { followStun, noStun } from "../../../src/modes/battle/stun.js";

describe("statusIcons", () => {
  test("buffs before debuffs, each in the order they went on", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "burning", 4, 1);
    applyStatus(on, "empowered", 8);
    applyStatus(on, "cursed", 6);
    applyStatus(on, "hasted", 5);
    assert.deepEqual(statusIcons(on, []).map((i) => i.status), ["empowered", "hasted", "burning", "cursed"]);
  });

  test("the share of its time left, whole seconds left (rounded up) and its stacks", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "frenzy", 10);
    applyStatus(on, "frenzy", 10);
    on[0]!.left = 2.6;
    const [icon] = statusIcons(on, []);
    assert.deepEqual(icon, { status: "frenzy", harmful: false, stacks: 2, secondsLeft: 3, shareLeft: 0.26 });
  });

  test("a permanent one has no timer", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "warded", null);
    const [icon] = statusIcons(on, []);
    assert.equal(icon!.secondsLeft, null);
    assert.equal(icon!.shareLeft, 1);
  });

  test("a stun shows last, as long as it lasts, its time left draining in tenths of a second", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "burning", 4, 1);
    const stun = noStun();
    followStun(stun, 0.8, 0);
    followStun(stun, 0.33, 0.47);
    assert.deepEqual(statusIcons(on, [], stun).map((i) => i.status), ["burning", "stunned"]);
    assert.deepEqual(statusIcons(on, [], stun)[1], {
      status: "stunned", harmful: true, stacks: 1, secondsLeft: 0.4, shareLeft: 0.41,
    });
    followStun(stun, 0, 0.33);
    assert.deepEqual(statusIcons(on, [], stun).map((i) => i.status), ["burning"]);
  });

  test("gives back the last list when nothing it shows has changed, so the HUD doesn't redraw", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "empowered", 8);
    const first = statusIcons(on, []);
    on[0]!.left = 7.9999;
    assert.equal(statusIcons(on, first), first);
    on[0]!.left = 6;
    assert.notEqual(statusIcons(on, first), first);
  });
});
