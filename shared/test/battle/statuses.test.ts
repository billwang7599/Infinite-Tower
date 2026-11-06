import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyStatus, BLESSINGS, cleanse, INSCRIPTIONS, maxStacksOf, MOD_CAPS, modsFrom, NO_MODS, passivesOf, STATUS_DEFS,
  stacksOf, statusOn, timeLeft, type StatusOn,
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

test("a character's passives: each inscription's and blessing's status, permanent, one stack", () => {
  const on = passivesOf(["grit", "embers"], ["brannoc", "haldis"]);
  assert.deepEqual(on.map((o) => o.status), [
    INSCRIPTIONS.grit.status, INSCRIPTIONS.embers.status, BLESSINGS.brannoc.status, BLESSINGS.haldis.status,
  ]);
  for (const { status, stacks } of on) {
    assert.equal(timeLeft(on, status), Infinity, status);
    assert.equal(stacks, 1, status);
  }
  assert.deepEqual(passivesOf([], []), []);
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

describe("buffs stack only so far", () => {
  const allOn = (key: keyof typeof NO_MODS, better: (factor: number) => boolean): StatusOn[] =>
    (Object.keys(STATUS_DEFS) as (keyof typeof STATUS_DEFS)[]).flatMap((status) => {
      const factor = (STATUS_DEFS[status] as { mods?: Partial<typeof NO_MODS> }).mods?.[key];
      return factor !== undefined && factor !== 0 && better(factor)
        ? [{ status, left: null, time: null, stacks: maxStacksOf(status), amount: 0 }] : [];
    });

  test("every capped mod, with every status that helps it on at its most stacks, stops at its cap", () => {
    for (const [key, cap] of Object.entries(MOD_CAPS) as [keyof typeof NO_MODS, { min?: number; max?: number }][]) {
      const on = allOn(key, (f) => (cap.max !== undefined ? f > 1 : f < 1));
      assert.ok(on.length > 0, key);
      const value = modsFrom(on)[key];
      if (cap.max !== undefined) assert.ok(value <= cap.max, `${key} ${value}`);
      if (cap.min !== undefined) assert.ok(value >= cap.min, `${key} ${value}`);
    }
    assert.equal(MOD_CAPS.damageDealtFactor.max, modsFrom(allOn("damageDealtFactor", (f) => f > 1)).damageDealtFactor);
  });

  test("the First Door still takes no damage at all", () => {
    assert.equal(modsFrom([{ status: "openedDoor", left: 2, time: 2, stacks: 1, amount: 0 }]).damageTakenFactor, 0);
  });
});
