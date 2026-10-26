import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACTIONS, KeyBindings, keysOf, type ActionRef } from "../../src/settings/bindings.js";

const up: ActionRef = { group: "overworld", action: "up" };
const character: ActionRef = { group: "overworld", action: "character" };
const inventory: ActionRef = { group: "overworld", action: "inventory" };
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
      overworld: { character: ["KeyI"], inventory: ["KeyC"] },
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
    b.restore({ overworld: { up: ["KeyZ"] } });
    assert.deepEqual(keysOf(b.get(), up), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), jump), ACTIONS.battle.jump.keys);
  });

  test("restore takes the defaults for anything unreadable, action by action", () => {
    const b = new KeyBindings();
    b.restore({
      overworld: {
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

  test("a save from the keyboard bag (cursor keys, grab) loads: what's left of it is kept, the rest ignored", () => {
    const turn: ActionRef = { group: "bag", action: "turn" };
    const use: ActionRef = { group: "bag", action: "use" };
    const b = new KeyBindings();
    b.restore({
      field: { inventory: ["KeyB"] },
      bag: {
        up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], grab: ["KeyG", "Space"], move: ["KeyM"],
        turn: ["KeyT"],
      },
    });
    assert.deepEqual(keysOf(b.get(), turn), ["KeyT"]);
    assert.deepEqual(keysOf(b.get(), use), ACTIONS.bag.use.keys);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyB"]);
    assert.deepEqual(Object.keys(b.get().bag), ["turn", "use"]);
    const saved = { overworld: { inventory: ["KeyB"] }, bag: { turn: ["KeyT"] } };
    assert.deepEqual(b.toSaved(), saved, "the old ones aren't saved back");
  });

  test("a save with only removed bag actions gives the defaults", () => {
    const b = new KeyBindings();
    b.restore({ bag: { grab: ["KeyJ"], up: ["ArrowUp"] } });
    assert.equal(b.isDefault(), true);
    assert.deepEqual(b.toSaved(), {});
  });

  test("restore of a non-object or a group that isn't an object gives the defaults", () => {
    for (const saved of [null, undefined, "overworld", 42, [], { overworld: "up", battle: null }]) {
      const b = new KeyBindings();
      b.bind(character, "KeyX", null);
      b.restore(saved);
      assert.deepEqual(b.get(), defaults(), JSON.stringify(saved));
    }
  });
});

describe("KeyBindings saved before the field was renamed the overworld", () => {
  const overworld = (action: "up" | "inventory" | "rest"): ActionRef => ({ group: "overworld", action });

  test("restore loads keys saved under the old group name `field` into `overworld`", () => {
    const b = new KeyBindings();
    b.restore({ field: { up: ["KeyZ"], inventory: ["KeyB"] }, battle: { jump: ["KeyX"] } });
    assert.deepEqual(keysOf(b.get(), overworld("up")), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), overworld("inventory")), ["KeyB"]);
    assert.deepEqual(keysOf(b.get(), overworld("rest")), ACTIONS.overworld.rest.keys);
    assert.deepEqual(keysOf(b.get(), jump), ["KeyX"]);
  });

  test("the next save writes them under `overworld`, without `field`", () => {
    const b = new KeyBindings();
    b.restore({ field: { up: ["KeyZ"] } });
    assert.deepEqual(b.toSaved(), { overworld: { up: ["KeyZ"] } });
  });

  test("a save with both groups goes by `overworld` and ignores `field`", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { up: ["KeyZ"] }, field: { up: ["KeyY"], inventory: ["KeyB"] } });
    assert.deepEqual(keysOf(b.get(), overworld("up")), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), overworld("inventory")), ACTIONS.overworld.inventory.keys);
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
    b.restore({ overworld: { up: ["ArrowUp", "KeyW"] } });
    assert.equal(b.isDefault(), false);
  });
});
