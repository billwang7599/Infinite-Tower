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
const challenge: ActionRef = { group: "overworld", action: "challenge" };
const acceptChallenge: ActionRef = { group: "overworld", action: "acceptChallenge" };
const jump: ActionRef = { group: "battle", action: "jump" };
const dodge: ActionRef = { group: "battle", action: "dodge" };
const block: ActionRef = { group: "battle", action: "block" };
const turnLeft: ActionRef = { group: "battle", action: "turnLeft" };
const lookUp: ActionRef = { group: "battle", action: "lookUp" };

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
    b.bind(turnLeft, "KeyZ", "ArrowLeft");
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
        left: ["KeyA", "KeyL", "KeyX", "KeyU"],
        right: ["KeyD", "KeyD"],
        character: ["Escape"],
        inventory: [5],
        menu: ["KeyP"],
        teleport: ["KeyV"],
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
      field: { inventory: ["KeyL"] },
      bag: {
        up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], grab: ["KeyG", "Space"], move: ["KeyM"],
        turn: ["KeyV"],
      },
    });
    assert.deepEqual(keysOf(b.get(), turnItem), ["KeyV"]);
    assert.deepEqual(keysOf(b.get(), useItem), ACTIONS.overworld.useItem.keys);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyL"]);
    const saved = { general: { inventory: ["KeyL"] }, overworld: { turnItem: ["KeyV"] } };
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

describe("KeyBindings saved before a new default key", () => {
  test("a general key saved on a new overworld default keeps it: that action is unbound, nothing else changes", () => {
    const b = new KeyBindings();
    b.restore({ general: { inventory: ["KeyT"], forward: ["KeyZ"] }, overworld: { rest: ["KeyV"] } });
    const expected = { ...defaults(), general: { ...defaults().general, inventory: ["KeyT"], forward: ["KeyZ"] } };
    assert.deepEqual(b.get(), { ...expected, overworld: { ...expected.overworld, rest: ["KeyV"], challenge: [] } });
  });

  test("an overworld key saved on a new overworld default keeps it, and the group's other keys are kept", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { rest: ["KeyY"], turnItem: ["KeyG"] } });
    assert.deepEqual(keysOf(b.get(), rest), ["KeyY"]);
    assert.deepEqual(keysOf(b.get(), turnItem), ["KeyG"]);
    assert.deepEqual(keysOf(b.get(), acceptChallenge), []);
    assert.deepEqual(keysOf(b.get(), challenge), ACTIONS.overworld.challenge.keys);
  });

  test("an action left unbound isn't saved, can be bound, and gets its default back once its key is free", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { rest: ["KeyY"] } });
    assert.deepEqual(b.toSaved(), { overworld: { rest: ["KeyY"] } });

    const bound = new KeyBindings();
    bound.restore(b.toSaved());
    assert.deepEqual(bound.bind(acceptChallenge, "KeyH", null), { ok: true, takenFrom: [], gave: null });
    assert.deepEqual(keysOf(bound.get(), acceptChallenge), ["KeyH"]);

    b.bind(rest, "KeyV", "KeyY");
    b.restore(b.toSaved());
    assert.deepEqual(keysOf(b.get(), acceptChallenge), ACTIONS.overworld.acceptChallenge.keys);
  });

  test("saved keys that clash with each other send the place's group back to its defaults; general is kept", () => {
    const b = new KeyBindings();
    b.restore({ general: { inventory: ["KeyL"] }, overworld: { rest: ["KeyL"], turnItem: ["KeyG"] } });
    assert.deepEqual(b.get().overworld, defaults().overworld);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyL"]);
  });

  test("saved general keys that clash with each other send general back to its defaults", () => {
    const b = new KeyBindings();
    b.restore({ battle: { forward: ["KeyZ"] }, overworld: { character: ["KeyZ"], rest: ["KeyV"] } });
    assert.deepEqual(b.get().general, defaults().general);
    assert.deepEqual(keysOf(b.get(), rest), ["KeyV"]);
  });
});

describe("KeyBindings saved before the field was renamed the overworld", () => {
  test("restore loads keys saved under the old group name `field` where they are now", () => {
    const b = new KeyBindings();
    b.restore({ field: { up: ["KeyZ"], inventory: ["KeyL"], rest: ["KeyV"] }, battle: { jump: ["KeyX"] } });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyL"]);
    assert.deepEqual(keysOf(b.get(), rest), ["KeyV"]);
    assert.deepEqual(keysOf(b.get(), jump), ["KeyX"]);
  });

  test("the next save writes them where they are now, without `field`", () => {
    const b = new KeyBindings();
    b.restore({ field: { up: ["KeyZ"], rest: ["KeyV"] } });
    assert.deepEqual(b.toSaved(), { general: { forward: ["KeyZ"] }, overworld: { rest: ["KeyV"] } });
  });

  test("a save with both goes by the newer place, action by action", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { up: ["KeyZ"] }, field: { up: ["KeyU"], inventory: ["KeyL"] } });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyL"]);
  });
});

describe("KeyBindings saved before the groups were general, the overworld's and the arena's", () => {
  test("movement saved for the arena is general's now, ahead of the overworld's walk", () => {
    const b = new KeyBindings();
    b.restore({ battle: { forward: ["KeyZ"] }, overworld: { up: ["KeyU"] } });
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
    b.restore({ overworld: { character: ["KeyH"], rest: ["KeyV"] }, bag: { turn: ["KeyG"], use: ["KeyL"] } });
    assert.deepEqual(keysOf(b.get(), character), ["KeyH"]);
    assert.deepEqual(keysOf(b.get(), rest), ["KeyV"]);
    assert.deepEqual(keysOf(b.get(), turnItem), ["KeyG"]);
    assert.deepEqual(keysOf(b.get(), useItem), ["KeyL"]);
  });

  test("a walk on the arrows keeps them: the arena's tilt up (on ↑) is unbound, the arena keeps its keys", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { up: ["KeyW", "ArrowUp", "KeyZ"] }, battle: { jump: ["KeyX"] } });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyW", "ArrowUp", "KeyZ"]);
    assert.deepEqual(keysOf(b.get(), lookUp), []);
    assert.deepEqual(keysOf(b.get(), jump), ["KeyX"]);
  });

  test("a rest saved with Enter (now the bag's use) keeps it: use is unbound, general is kept", () => {
    const b = new KeyBindings();
    b.restore({ overworld: { rest: ["KeyE", "Enter"], character: ["KeyH"] } });
    assert.deepEqual(keysOf(b.get(), rest), ["KeyE", "Enter"]);
    assert.deepEqual(keysOf(b.get(), useItem), []);
    assert.deepEqual(keysOf(b.get(), character), ["KeyH"]);
  });

  test("an arena key that is now general's (B, the inventory) keeps it: the inventory is unbound", () => {
    const b = new KeyBindings();
    b.restore({ battle: { block: ["KeyB"] }, overworld: { rest: ["KeyV"] } });
    assert.deepEqual(keysOf(b.get(), block), ["KeyB"]);
    assert.deepEqual(keysOf(b.get(), inventory), []);
    assert.deepEqual(keysOf(b.get(), rest), ["KeyV"]);
  });
});

describe("KeyBindings reset", () => {
  test("reset brings back the defaults", () => {
    const b = new KeyBindings();
    b.bind(jump, "KeyX", null);
    b.bind(turnLeft, "KeyZ", null);
    assert.equal(b.isDefault(), false);
    b.reset();
    assert.equal(b.isDefault(), true);
    assert.deepEqual(b.get(), defaults());
  });
});

describe("KeyBindings saved before the sword's ten actions", () => {
  test("a dodge saved on left Shift (the block's now) keeps it: the block is unbound, the rest kept", () => {
    const b = new KeyBindings();
    b.restore({ battle: { dodge: ["KeyK", "ShiftLeft"], turnLeft: ["KeyH"] }, overworld: { up: ["KeyZ"] } });
    assert.deepEqual(keysOf(b.get(), dodge), ["KeyK", "ShiftLeft"]);
    assert.deepEqual(keysOf(b.get(), block), []);
    assert.deepEqual(keysOf(b.get(), turnLeft), ["KeyH"]);
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
  });

  test("an old save that clashes with nothing new is kept, and the old attack action is dropped", () => {
    const b = new KeyBindings();
    b.restore({ battle: { jump: ["KeyX"], attack: ["KeyJ"] } });
    assert.deepEqual(keysOf(b.get(), jump), ["KeyX"]);
    assert.deepEqual(b.toSaved(), { battle: { jump: ["KeyX"] } });
  });
});

describe("KeyBindings saved before one key per swing", () => {
  test("a dodge saved on Space (now the jump) keeps it: the jump is unbound", () => {
    const b = new KeyBindings();
    b.restore({ battle: { dodge: ["Space", "KeyX"] }, overworld: { up: ["KeyZ"] } });
    assert.deepEqual(b.get().battle, { ...defaults().battle, dodge: ["Space", "KeyX"], jump: [] });
    assert.deepEqual(keysOf(b.get(), forward), ["KeyZ"]);
  });

  test("a save that clashes with nothing new is kept, and the reverse action is dropped", () => {
    const b = new KeyBindings();
    b.restore({ battle: { jump: ["KeyU"], reverse: ["KeyR"] } });
    assert.deepEqual(keysOf(b.get(), jump), ["KeyU"]);
    assert.deepEqual(b.toSaved(), { battle: { jump: ["KeyU"] } });
  });
});

describe("KeyBindings saved before the mouse swung the sword", () => {
  test("saved swing and stab keys are dropped, under old names too; the rest is kept", () => {
    const b = new KeyBindings();
    b.restore({ battle: { tlbr: ["KeyU"], lr: ["KeyJ"], swingLR: ["KeyH"], stab: ["KeyK"], jump: ["KeyX"] } });
    assert.deepEqual(b.get().battle, { ...defaults().battle, jump: ["KeyX"] });
    assert.deepEqual(b.toSaved(), { battle: { jump: ["KeyX"] } });
  });

  test("a key that was a swing's is free: a block saved on I is kept", () => {
    const b = new KeyBindings();
    b.restore({ battle: { block: ["KeyI", "ShiftLeft"] } });
    assert.deepEqual(keysOf(b.get(), { group: "battle", action: "block" }), ["KeyI", "ShiftLeft"]);
  });
});

describe("KeyBindings saved before lock-on", () => {
  test("a turn saved on Q (the lock now) or a block on right Shift (lock closest now) keeps it: the lock's unbound", () => {
    const b = new KeyBindings();
    b.restore({ battle: { turnLeft: ["KeyQ", "KeyH"] }, general: { inventory: ["KeyL"] } });
    assert.deepEqual(b.get().battle, { ...defaults().battle, turnLeft: ["KeyQ", "KeyH"], lockOn: [] });
    assert.deepEqual(keysOf(b.get(), inventory), ["KeyL"]);
    b.restore({ battle: { block: ["ShiftRight", "KeyH"] } });
    assert.deepEqual(b.get().battle, { ...defaults().battle, block: ["ShiftRight", "KeyH"], lockClosest: [] });
  });

  test("a turn saved on E is kept: E is free in the arena now", () => {
    const b = new KeyBindings();
    b.restore({ battle: { turnRight: ["KeyE", "ArrowRight"] } });
    assert.deepEqual(keysOf(b.get(), { group: "battle", action: "turnRight" }), ["KeyE", "ArrowRight"]);
  });
});

describe("KeyBindings saved before spells were skills", () => {
  test("keys saved on the old spell actions load on the skill ones", () => {
    const b = new KeyBindings();
    b.restore({ battle: { spell1: ["KeyZ"], spell4: ["KeyX"] } });
    assert.deepEqual(keysOf(b.get(), { group: "battle", action: "skill1" }), ["KeyZ"]);
    assert.deepEqual(keysOf(b.get(), { group: "battle", action: "skill4" }), ["KeyX"]);
    assert.deepEqual(b.toSaved(), { battle: { skill1: ["KeyZ"], skill4: ["KeyX"] } });
  });
});
