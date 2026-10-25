import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACTIONS, KeyBindings, keysOf, type ActionRef } from "../../src/settings/bindings.js";

const up: ActionRef = { group: "field", action: "up" };
const character: ActionRef = { group: "field", action: "character" };
const inventory: ActionRef = { group: "field", action: "inventory" };
const jump: ActionRef = { group: "battle", action: "jump" };

const defaults = () => new KeyBindings().get();

describe("KeyBindings saving", () => {
  test("toSaved is empty at the defaults", () => {
    assert.deepEqual(new KeyBindings().toSaved(), {});
  });

  test("toSaved holds only the actions that changed", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.bind(inventory, "KeyC", "KeyI");
    assert.deepEqual(b.toSaved(), {
      field: { character: ["KeyI"], inventory: ["KeyC"] },
      battle: { jump: ["Space", "KeyX"] },
    });
  });

  test("changing a key and changing it back saves nothing", () => {
    const b = new KeyBindings();
    b.bind(up, "KeyZ", "KeyW");
    b.bind(up, "KeyW", "KeyZ");
    assert.deepEqual(b.toSaved(), {});
    assert.equal(b.isDefault(), true);
  });

  test("restore(toSaved()) gives back the same keys", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.bind(inventory, "KeyC", "KeyI");
    b.unbind(up, "ArrowUp");
    const copy = new KeyBindings();
    copy.restore(JSON.parse(JSON.stringify(b.toSaved())));
    assert.deepEqual(copy.get(), b.get());
  });

  test("restore puts every action not in the save back to its defaults", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.restore({ field: { up: ["KeyZ"] } });
    assert.deepEqual(keysOf(b.get(), up), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), jump), ACTIONS.battle.jump.keys);
  });

  test("restore takes the defaults for anything unreadable, action by action", () => {
    const b = new KeyBindings();
    b.restore({
      field: {
        up: "KeyW",
        down: [],
        left: ["KeyA", "KeyB", "KeyX", "KeyY"],
        right: ["KeyD", "KeyD"],
        character: ["Escape"],
        inventory: [5],
        rest: ["MetaLeft", "KeyE"],
        teleport: ["KeyT"],
      },
      battle: { jump: ["KeyX"] },
      menu: { open: ["KeyM"] },
    });
    const expected = new KeyBindings();
    expected.bind(jump, "KeyX", "Space");
    assert.deepEqual(b.get(), expected.get());
  });

  test("restore of a non-object or a group that isn't an object gives the defaults", () => {
    for (const saved of [null, undefined, "field", 42, [], { field: "up", battle: null }]) {
      const b = new KeyBindings();
      b.bind(character, "KeyX", null);
      b.restore(saved);
      assert.deepEqual(b.get(), defaults(), JSON.stringify(saved));
    }
  });
});

describe("KeyBindings reset", () => {
  test("reset brings back the defaults", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.unbind(up, "KeyW");
    assert.equal(b.isDefault(), false);
    b.reset();
    assert.equal(b.isDefault(), true);
    assert.deepEqual(b.get(), defaults());
  });

  test("isDefault notices a reordering", () => {
    const b = new KeyBindings();
    b.restore({ field: { up: ["ArrowUp", "KeyW"] } });
    assert.equal(b.isDefault(), false);
  });
});
