import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyStatus, cleanse, maxStacksOf, modsFrom, NO_MODS, STATUS_DEFS, stacksOf, statusOn, timeLeft, type StatusOn,
} from "@infinite-tower/shared";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

describe("putting a status on", () => {
  test("again, it keeps the longer time and takes the new amount", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "burning", 4, 2);
    applyStatus(on, "burning", 1, 3);
    assert.equal(timeLeft(on, "burning"), 4);
    assert.equal(statusOn(on, "burning")!.amount, 3);
    applyStatus(on, "burning", 6, 3);
    assert.equal(timeLeft(on, "burning"), 6);
    assert.equal(statusOn(on, "burning")!.time, 6);
    assert.equal(on.length, 1);
  });

  test("a stacking one gains a stack each time, up to its cap, on one timer", () => {
    const on: StatusOn[] = [];
    for (let i = 0; i < maxStacksOf("frenzy") + 2; i++) applyStatus(on, "frenzy", 10);
    assert.equal(stacksOf(on, "frenzy"), maxStacksOf("frenzy"));
    assert.equal(on.length, 1);
  });

  test("one that doesn't stack stays at one", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "empowered", 8);
    applyStatus(on, "empowered", 8);
    assert.equal(stacksOf(on, "empowered"), 1);
  });

  test("a permanent one (null) stays permanent", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "warded", null);
    applyStatus(on, "warded", 6);
    assert.equal(timeLeft(on, "warded"), Infinity);
  });
});

describe("what statuses do to stats", () => {
  test("nothing on: no change", () => {
    assert.deepEqual(modsFrom([]), NO_MODS);
  });

  test("factors multiply, per stack and across statuses; lifesteal adds", () => {
    const on: StatusOn[] = [];
    applyStatus(on, "frenzy", 10);
    applyStatus(on, "frenzy", 10);
    applyStatus(on, "empowered", 8);
    applyStatus(on, "siphoning", 8);
    const frenzy = STATUS_DEFS.frenzy.mods.damageDealtFactor;
    close(modsFrom(on).damageDealtFactor, frenzy * frenzy * STATUS_DEFS.empowered.mods.damageDealtFactor);
    close(modsFrom(on).lifesteal, STATUS_DEFS.siphoning.mods.lifesteal);
  });

  test("a permanent status counts the same as a timed one", () => {
    const timed: StatusOn[] = [], permanent: StatusOn[] = [];
    applyStatus(timed, "bloodrage", 8);
    applyStatus(permanent, "bloodrage", null);
    assert.deepEqual(modsFrom(permanent), modsFrom(timed));
  });
});

test("cleansing takes off harmful timed statuses only", () => {
  const on: StatusOn[] = [];
  applyStatus(on, "burning", 4, 1);
  applyStatus(on, "cursed", 6);
  applyStatus(on, "empowered", 8);
  applyStatus(on, "rooted", null);
  cleanse(on);
  assert.deepEqual(on.map((o) => o.status), ["empowered", "rooted"]);
});
