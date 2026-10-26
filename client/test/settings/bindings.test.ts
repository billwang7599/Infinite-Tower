import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MAX_KEYS_PER_ACTION } from "@infinite-tower/shared";
import {
  ACTIONS, GROUPS, KeyBindings, actionsOf, isBindable, keysOf, type ActionRef,
} from "../../src/settings/bindings.js";

const up: ActionRef = { group: "field", action: "up" };
const character: ActionRef = { group: "field", action: "character" };
const inventory: ActionRef = { group: "field", action: "inventory" };
const jump: ActionRef = { group: "battle", action: "jump" };
const dodge: ActionRef = { group: "battle", action: "dodge" };
const turnLeft: ActionRef = { group: "battle", action: "turnLeft" };

const keys = (b: KeyBindings, ref: ActionRef) => keysOf(b.get(), ref);

describe("ACTIONS and helpers", () => {
  test("every action lists at least one default key, within the limit, none reserved", () => {
    for (const group of GROUPS) {
      for (const ref of actionsOf(group)) {
        const defaults = keysOf(new KeyBindings().get(), ref);
        assert.ok(defaults.length >= 1 && defaults.length <= MAX_KEYS_PER_ACTION, `${group}.${ref.action}`);
        assert.ok(defaults.every(isBindable), `${group}.${ref.action}`);
      }
    }
  });

  test("no key is the default of two actions in the same group", () => {
    for (const group of GROUPS) {
      const all = actionsOf(group).flatMap((ref) => keysOf(new KeyBindings().get(), ref));
      assert.equal(new Set(all).size, all.length, group);
    }
  });

  test("the bag screen's keys only turn (R) and use (Enter); the mouse does the rest", () => {
    assert.deepEqual(Object.keys(ACTIONS.bag), ["turn", "use"]);
    assert.deepEqual(ACTIONS.bag.turn.keys, ["KeyR"]);
    assert.deepEqual(ACTIONS.bag.use.keys, ["Enter"]);
  });

  test("a right click turns too, shown next to the turn keys (mouse buttons can't be rebound)", () => {
    assert.deepEqual(ACTIONS.bag.turn.mouse, [2]);
  });

  test("actionsOf lists a group's actions in order, tagged with the group", () => {
    assert.deepEqual(actionsOf("field"), Object.keys(ACTIONS.field).map((action) => ({ group: "field", action })));
  });

  test("Escape and the Meta keys can't be bound; ordinary keys can", () => {
    for (const key of ["Escape", "MetaLeft", "MetaRight"]) assert.equal(isBindable(key), false);
    for (const key of ["KeyW", "Space", "Enter", "ShiftLeft"]) assert.equal(isBindable(key), true);
  });
});

describe("KeyBindings.bind", () => {
  test("a new key starts with the defaults", () => {
    const b = new KeyBindings();
    assert.deepEqual(keys(b, up), ACTIONS.field.up.keys);
    assert.equal(b.isDefault(), true);
  });

  test("adding a free key puts it after the action's keys", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(character, "KeyX", null), { ok: true, takenFrom: null, gave: null });
    assert.deepEqual(keys(b, character), ["KeyC", "KeyX"]);
  });

  test("replacing a key keeps its place in the list", () => {
    const b = new KeyBindings();
    b.bind(up, "KeyZ", "KeyW");
    assert.deepEqual(keys(b, up), ["KeyZ", "ArrowUp"]);
  });

  test("adding to an action that already has the most keys is refused and changes nothing", () => {
    const b = new KeyBindings();
    const before = b.get();
    assert.equal(keys(b, dodge).length, MAX_KEYS_PER_ACTION);
    assert.deepEqual(b.bind(dodge, "KeyX", null), { ok: false, full: true });
    assert.equal(b.get(), before);
  });

  test("replacing a key on an action with the most keys still works", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(dodge, "KeyX", "KeyK"), { ok: true, takenFrom: null, gave: null });
    assert.deepEqual(keys(b, dodge), ["KeyX", "ShiftLeft", "ShiftRight"]);
  });

  test("a key held by another action with spare keys moves over", () => {
    const b = new KeyBindings();
    const result = b.bind(character, "ArrowUp", null);
    assert.deepEqual(result, { ok: true, takenFrom: up, gave: null });
    assert.deepEqual(keys(b, character), ["KeyC", "ArrowUp"]);
    assert.deepEqual(keys(b, up), ["KeyW"]);
  });

  test("replacing with another action's only key swaps the two keys", () => {
    const b = new KeyBindings();
    const result = b.bind(inventory, "KeyC", "KeyI");
    assert.deepEqual(result, { ok: true, takenFrom: character, gave: "KeyI" });
    assert.deepEqual(keys(b, inventory), ["KeyC"]);
    assert.deepEqual(keys(b, character), ["KeyI"]);
  });

  test("adding another action's only key is refused and changes nothing", () => {
    const b = new KeyBindings();
    const before = b.get();
    assert.deepEqual(b.bind(inventory, "KeyC", null), { ok: false, onlyKeyOf: character });
    assert.equal(b.get(), before);
  });

  test("the same key can be used in the field and in battle", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(jump, "KeyC", null), { ok: true, takenFrom: null, gave: null });
    assert.deepEqual(keys(b, jump), ["Space", "KeyC"]);
    assert.deepEqual(keys(b, character), ["KeyC"]);
  });

  test("a reserved key is ignored", () => {
    const b = new KeyBindings();
    let calls = 0;
    b.subscribe(() => calls++);
    for (const key of ["Escape", "MetaLeft", "MetaRight"]) {
      assert.deepEqual(b.bind(up, key, "KeyW"), { ok: true, takenFrom: null, gave: null });
      b.bind(up, key, null);
    }
    assert.deepEqual(keys(b, up), ACTIONS.field.up.keys);
    assert.equal(calls, 0);
  });

  test("replacing a key with itself changes nothing", () => {
    const b = new KeyBindings();
    const before = b.get();
    b.bind(up, "KeyW", "KeyW");
    assert.equal(b.get(), before);
  });

  test("replacing a key with another of the action's own keys leaves no duplicate", () => {
    const b = new KeyBindings();
    b.bind(up, "ArrowUp", "KeyW");
    assert.deepEqual(keys(b, up), ["ArrowUp"]);
  });

  test("binding notifies listeners", () => {
    const b = new KeyBindings();
    let calls = 0;
    b.subscribe(() => calls++);
    b.bind(character, "KeyX", null);
    assert.equal(calls, 1);
  });

  // It used to take H off turnLeft without adding it to dodge, leaving H bound to nothing.
  test("adding another action's key to a full action is refused and leaves the key where it was", () => {
    const b = new KeyBindings();
    const before = b.get();
    assert.deepEqual(b.bind(dodge, "KeyH", null), { ok: false, full: true });
    assert.equal(b.get(), before);
    const holders = actionsOf("battle").filter((ref) => keys(b, ref).includes("KeyH"));
    assert.deepEqual(holders, [turnLeft]);
  });

  test("moving one of a full action's own keys to the end isn't refused", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(dodge, "KeyK", null), { ok: true, takenFrom: null, gave: null });
    assert.deepEqual(keys(b, dodge), ["ShiftLeft", "ShiftRight", "KeyK"]);
  });
});

describe("KeyBindings.unbind", () => {
  test("drops one key from an action that has others", () => {
    const b = new KeyBindings();
    b.unbind(up, "KeyW");
    assert.deepEqual(keys(b, up), ["ArrowUp"]);
  });

  test("never leaves an action with no key", () => {
    const b = new KeyBindings();
    b.unbind(character, "KeyC");
    assert.deepEqual(keys(b, character), ["KeyC"]);
    b.unbind(up, "KeyW");
    b.unbind(up, "ArrowUp");
    assert.deepEqual(keys(b, up), ["ArrowUp"]);
  });
});
