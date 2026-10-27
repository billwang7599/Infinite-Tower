import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACTIONS, KeyBindings, keysOf, type ActionRef } from "../../src/settings/bindings.js";

const forward: ActionRef = { group: "general", action: "forward" };
const back: ActionRef = { group: "general", action: "back" };
const character: ActionRef = { group: "general", action: "character" };
const inventory: ActionRef = { group: "general", action: "inventory" };
const rest: ActionRef = { group: "overworld", action: "rest" };
const turnItem: ActionRef = { group: "overworld", action: "turnItem" };
const useItem: ActionRef = { group: "overworld", action: "useItem" };
const jump: ActionRef = { group: "battle", action: "jump" };
const turnLeft: ActionRef = { group: "battle", action: "turnLeft" };

const defaults = () => new KeyBindings().get();

describe("KeyBindings saving", () => {
  test("toSaved is empty at the defaults", () => {
    assert.deepEqual(new KeyBindings().toSaved(), {});
  });

  test("toSaved holds only the actions that changed", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.bind(inventory, "KeyC", "KeyB");
    assert.deepEqual(b.toSaved(), {
      general: { character: ["KeyB"], inventory: ["KeyC"] },
      battle: { jump: ["Space", "KeyX"] },
    });
  });

  test("changing a key and changing it back saves nothing", () => {
    const b = new KeyBindings();
    b.bind(forward, "KeyZ", "KeyW");
    b.bind(forward, "KeyW", "KeyZ");
    assert.deepEqual(b.toSaved(), {});
    assert.equal(b.isDefault(), true);
  });

  test("restore(toSaved()) gives back the same keys", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.bind(inventory, "KeyC", "KeyB");
    b.unbind(turnLeft, "ArrowLeft");
    const copy = new KeyBindings();
    copy.restore(JSON.parse(JSON.stringify(b.toSaved())));
    assert.deepEqual(copy.get(), b.get());
  });

  test("restore puts every action not in the save back to its defaults", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.restore({ general: { forward: ["KeyZ"] } });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), jump), ACTIONS.battle.jump.keys);
  });

  test("restore takes the defaults for anything unreadable, action by action", () => {
    const b = new KeyBindings();
    b.restore({
      general: {
        forward: "KeyW",
        back: [],
        left: ["KeyA", "KeyN", "KeyX", "KeyY"],
        right: ["KeyD", "KeyD"],
        character: ["Escape"],
        inventory: [5],
        menu: ["KeyP"],
        teleport: ["KeyT"],
      },
      overworld: { rest: ["MetaLeft", "KeyE"] },
      battle: { jump: ["KeyX"] },
      chat: { open: ["KeyM"] },
    });
    const expected = new KeyBindings();
    expected.bind(jump, "KeyX", "Space");
    assert.deepEqual(b.get(), expected.get());
  });

  test("a save from the keyboard bag (cursor keys, grab) loads: what's left of it is kept, the rest ignored", () => {
    const b = new KeyBindings();
    b.restore({
      field: { inventory: ["KeyN"] },
      bag: {
        up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], grab: ["KeyG", "Space"], move: ["KeyM"],
        turn: ["KeyT"],
      },
    });
    assert.deepEqual(keysOf(b.get(), turnItem), ["KeyT"]);
    assert.deepEqual(keysOf(b.get(), useItem), ACTIONS.overworld.useItem.keys);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyN"]);
    const saved = { general: { inventory: ["KeyN"] }, overworld: { turnItem: ["KeyT"] } };
    assert.deepEqual(b.toSaved(), saved, "the old ones aren't saved back");
  });

  test("a save with only removed bag actions gives the defaults", () => {
    const b = new KeyBindings();
    b.restore({ bag: { grab: ["KeyJ"], up: ["ArrowUp"] } });
    assert.equal(b.isDefault(), true);
    assert.deepEqual(b.toSaved(), {});
  });

  test("restore of a non-object or a group that isn't an object gives the defaults", () => {
    for (const saved of [null, undefined, "overworld", 42, [], { general: "forward", battle: null }]) {
      const b = new KeyBindings();
      b.bind(character, "KeyX", null);
      b.restore(saved);
      assert.deepEqual(b.get(), defaults(), JSON.stringify(saved));
    }
  });
});

describe("KeyBindings saved before the field was renamed the overworld", () => {
  test("restore loads keys saved under the old group name `field` where they are now", () => {
    const b = new KeyBindings();
    b.restore({ field: { up: ["KeyZ"], inventory: ["KeyN"], rest: ["KeyT"] }, battle: { jump: ["KeyX"] } });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyN"]);
    assert.deepEqual(keysOf(b.get(), rest), ["KeyT"]);
    assert.deepEqual(keysOf(b.get(), jump), ["KeyX"]);
  });

  test("the next save writes them where they are now, without `field`", () => {
    const b = new KeyBindings();
    b.restore({ field: { up: ["KeyZ"], rest: ["KeyT"] } });
    assert.deepEqual(b.toSaved(), { general: { forward: ["KeyZ"] }, overworld: { rest: ["KeyT"] } });
  });

  test("a save with both goes by the newer place, action by action", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { up: ["KeyZ"] }, field: { up: ["KeyY"], inventory: ["KeyN"] } });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyN"]);
  });
});

describe("KeyBindings saved before the groups were general, the overworld's and the arena's", () => {
  test("movement saved for the arena is general's now, ahead of the overworld's walk", () => {
    const b = new KeyBindings();
    b.restore({ battle: { forward: ["KeyZ"] }, overworld: { up: ["KeyY"] } });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
    assert.deepEqual(b.toSaved(), { general: { forward: ["KeyZ"] } });
  });

  test("a walk saved only for the overworld is general's movement now", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { down: ["KeyX"] } });
    assert.deepEqual(keysOf(b.get(), back), ["KeyX"]);
  });

  test("the panels' keys are general's, the bag's the overworld's", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { character: ["KeyH"], rest: ["KeyT"] }, bag: { turn: ["KeyG"], use: ["KeyN"] } });
    assert.deepEqual(keysOf(b.get(), character), ["KeyH"]);
    assert.deepEqual(keysOf(b.get(), rest), ["KeyT"]);
    assert.deepEqual(keysOf(b.get(), turnItem), ["KeyG"]);
    assert.deepEqual(keysOf(b.get(), useItem), ["KeyN"]);
  });

  test("a walk on the arrows (the arena's camera keys) clashes: general's defaults, the arena keeps its keys", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { up: ["KeyW", "ArrowUp", "KeyZ"] }, battle: { jump: ["KeyX"] } });
    assert.deepEqual(b.get().general, defaults().general);
    assert.deepEqual(keysOf(b.get(), jump), ["KeyX"]);
  });

  test("a rest saved with Enter (now the bag's use) clashes: the overworld's defaults", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { rest: ["KeyE", "Enter"], character: ["KeyH"] } });
    assert.deepEqual(b.get().overworld, defaults().overworld);
    assert.deepEqual(keysOf(b.get(), character), ["KeyH"], "general is kept");
  });

  test("an arena key that is now general's (B, the inventory) clashes: the arena's defaults", () => {
    const b = new KeyBindings();
    b.restore({ battle: { block: ["KeyB"] }, overworld: { rest: ["KeyT"] } });
    assert.deepEqual(b.get().battle, defaults().battle);
    assert.deepEqual(keysOf(b.get(), rest), ["KeyT"], "the overworld is kept");
  });
});

describe("KeyBindings reset", () => {
  test("reset brings back the defaults", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.unbind(turnLeft, "KeyQ");
    assert.equal(b.isDefault(), false);
    b.reset();
    assert.equal(b.isDefault(), true);
    assert.deepEqual(b.get(), defaults());
  });

  test("isDefault notices a reordering", () => {
    const b = new KeyBindings();
    b.restore({ battle: { turnLeft: ["ArrowLeft", "KeyQ"] } });
    assert.equal(b.isDefault(), false);
  });
});

describe("KeyBindings saved before the sword's ten actions", () => {
  test("a battle save whose keys now clash (K was dodge's, Shift too) goes back to the battle defaults", () => {
    const b = new KeyBindings();
    b.restore({ battle: { dodge: ["KeyK", "ShiftLeft"], turnLeft: ["KeyH"] }, overworld: { up: ["KeyZ"] } });
    assert.deepEqual(b.get().battle, defaults().battle);
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"], "other groups are kept");
  });

  test("an old save that clashes with nothing new is kept, and the old attack action is dropped", () => {
    const b = new KeyBindings();
    b.restore({ battle: { jump: ["KeyX"], attack: ["KeyJ"] } });
    assert.deepEqual(keysOf(b.get(), jump), ["KeyX"]);
    assert.deepEqual(b.toSaved(), { battle: { jump: ["KeyX"] } });
  });
});

describe("KeyBindings saved before one key per swing", () => {
  test("a dodge saved on Space (now the jump) clashes: the battle defaults", () => {
    const b = new KeyBindings();
    b.restore({ battle: { dodge: ["Space", "KeyX"] }, overworld: { up: ["KeyZ"] } });
    assert.deepEqual(b.get().battle, defaults().battle);
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"], "other groups are kept");
  });

  test("a block saved on I (now a swing) clashes too", () => {
    const b = new KeyBindings();
    b.restore({ battle: { block: ["KeyI", "KeyY"] } });
    assert.deepEqual(b.get().battle, defaults().battle);
  });

  test("a save that clashes with nothing new is kept, and the reverse action is dropped", () => {
    const b = new KeyBindings();
    b.restore({ battle: { stab: ["KeyY"], reverse: ["KeyR"] } });
    assert.deepEqual(keysOf(b.get(), { group: "battle", action: "stab" }), ["KeyY"]);
    assert.deepEqual(b.toSaved(), { battle: { stab: ["KeyY"] } });
  });
});

describe("KeyBindings saved before the swings were named as the fight names them", () => {
  test("a swing saved under its old name loads where it is now, and saves under the new one", () => {
    const b = new KeyBindings();
    b.restore({ battle: { swingLR: ["KeyY"], swingBRTL: ["KeyH"] } });
    assert.deepEqual(keysOf(b.get(), { group: "battle", action: "lr" }), ["KeyY"]);
    assert.deepEqual(keysOf(b.get(), { group: "battle", action: "brtl" }), ["KeyH"]);
    assert.deepEqual(b.toSaved(), { battle: { lr: ["KeyY"], brtl: ["KeyH"] } });
  });
});
