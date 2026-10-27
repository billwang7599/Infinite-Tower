import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MAX_KEYS_PER_ACTION } from "@infinite-tower/shared";
import {
  ACTIONS, GROUPS, KeyBindings, actionsOf, isBindable, isFixed, keysOf, type ActionRef,
} from "../../src/settings/bindings.js";

const menu: ActionRef = { group: "general", action: "menu" };
const forward: ActionRef = { group: "general", action: "forward" };
const character: ActionRef = { group: "general", action: "character" };
const inventory: ActionRef = { group: "general", action: "inventory" };
const turnItem: ActionRef = { group: "overworld", action: "turnItem" };
const useItem: ActionRef = { group: "overworld", action: "useItem" };
const jump: ActionRef = { group: "battle", action: "jump" };
const dodge: ActionRef = { group: "battle", action: "dodge" };
const turnLeft: ActionRef = { group: "battle", action: "turnLeft" };
const block: ActionRef = { group: "battle", action: "block" };
const leave: ActionRef = { group: "battle", action: "leave" };

const keys = (b: KeyBindings, ref: ActionRef) => keysOf(b.get(), ref);
const unchanged = { ok: true, takenFrom: [], gave: null };

describe("ACTIONS and helpers", () => {
  test("three groups: general (everywhere), the overworld's and the arena's", () => {
    assert.deepEqual(GROUPS, ["general", "overworld", "battle"]);
  });

  test("every action lists at least one default key, within the limit, none reserved but the settings' Esc", () => {
    for (const group of GROUPS) {
      for (const ref of actionsOf(group)) {
        const defaults = keysOf(new KeyBindings().get(), ref);
        assert.ok(defaults.length >= 1 && defaults.length <= MAX_KEYS_PER_ACTION, `${group}.${ref.action}`);
        assert.equal(defaults.every(isBindable), !isFixed(ref), `${group}.${ref.action}`);
      }
    }
    assert.deepEqual(ACTIONS.general.menu.keys, ["Escape"]);
  });

  test("no default key is on two actions that work together; the overworld and the arena share some", () => {
    const map = new KeyBindings().get();
    for (const place of ["overworld", "battle"] as const) {
      const all = [...actionsOf("general"), ...actionsOf(place)].flatMap((ref) => keysOf(map, ref));
      assert.equal(new Set(all).size, all.length, place);
    }
    assert.deepEqual(map.overworld.rest, ["KeyE"]);
    assert.deepEqual(map.battle.turnRight, ["KeyE", "ArrowRight"]);
    assert.deepEqual(map.overworld.useItem, ["Enter"]);
    assert.deepEqual(map.battle.leave, ["Enter"]);
  });

  test("general: Esc, WASD to move, C the character panel, B the inventory", () => {
    const general = new KeyBindings().get().general;
    assert.deepEqual(general.menu, ["Escape"]);
    const { forward, left, back, right } = general;
    assert.deepEqual([forward, left, back, right], [["KeyW"], ["KeyA"], ["KeyS"], ["KeyD"]]);
    assert.deepEqual(general.character, ["KeyC"]);
    assert.deepEqual(general.inventory, ["KeyB"], "I is a swing");
  });

  test("the arena: u i o / j l / m , . swing from their key's side, k stabs, Shift blocks, F dodges, Space jumps", () => {
    const battle = new KeyBindings().get().battle;
    assert.deepEqual(battle.tlbr, ["KeyU"]);
    assert.deepEqual(battle.tb, ["KeyI"]);
    assert.deepEqual(battle.trbl, ["KeyO"]);
    assert.deepEqual(battle.lr, ["KeyJ"]);
    assert.deepEqual(battle.rl, ["KeyL"]);
    assert.deepEqual(battle.bltr, ["KeyM"]);
    assert.deepEqual(battle.bt, ["Comma"]);
    assert.deepEqual(battle.brtl, ["Period"]);
    assert.deepEqual(battle.stab, ["KeyK"]);
    assert.deepEqual(battle.block, ["ShiftLeft", "ShiftRight"]);
    assert.deepEqual(battle.dodge, ["KeyF"]);
    assert.deepEqual(battle.jump, ["Space"]);
    assert.equal("reverse" in battle, false);
    assert.deepEqual(battle.turnLeft, ["KeyQ", "ArrowLeft"]);
    assert.deepEqual(battle.turnRight, ["KeyE", "ArrowRight"]);
    assert.deepEqual(battle.leave, ["Enter"]);
    assert.deepEqual(ACTIONS.battle.lr.mouse, [0], "the left button: the default swing");
    assert.deepEqual(ACTIONS.battle.dodge.mouse, [2]);
  });

  test("the overworld's own: rest (E), and in the bag turn (R) and use (Enter); the mouse does the rest", () => {
    assert.deepEqual(Object.keys(ACTIONS.overworld), ["rest", "turnItem", "useItem"]);
    assert.deepEqual(ACTIONS.overworld.turnItem.keys, ["KeyR"]);
    assert.deepEqual(ACTIONS.overworld.useItem.keys, ["Enter"]);
  });

  test("a right click turns too, shown next to the turn keys (mouse buttons can't be rebound)", () => {
    assert.deepEqual(ACTIONS.overworld.turnItem.mouse, [2]);
  });

  test("actionsOf lists a group's actions in order, tagged with the group", () => {
    const expected = Object.keys(ACTIONS.general).map((action) => ({ group: "general", action }));
    assert.deepEqual(actionsOf("general"), expected);
  });

  test("Escape and the Meta keys can't be bound; ordinary keys can", () => {
    for (const key of ["Escape", "MetaLeft", "MetaRight"]) assert.equal(isBindable(key), false);
    for (const key of ["KeyW", "Space", "Enter", "ShiftLeft"]) assert.equal(isBindable(key), true);
  });

  test("only the settings (on Esc) are fixed", () => {
    assert.deepEqual(GROUPS.flatMap(actionsOf).filter(isFixed), [menu]);
  });
});

describe("KeyBindings.bind", () => {
  test("a new key starts with the defaults", () => {
    const b = new KeyBindings();
    assert.deepEqual(keys(b, forward), ACTIONS.general.forward.keys);
    assert.equal(b.isDefault(), true);
  });

  test("adding a free key puts it after the action's keys", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(character, "KeyX", null), unchanged);
    assert.deepEqual(keys(b, character), ["KeyC", "KeyX"]);
  });

  test("replacing a key keeps its place in the list", () => {
    const b = new KeyBindings();
    b.bind(turnLeft, "KeyZ", "KeyQ");
    assert.deepEqual(keys(b, turnLeft), ["KeyZ", "ArrowLeft"]);
  });

  test("adding to an action that already has the most keys is refused and changes nothing", () => {
    const b = new KeyBindings();
    b.bind(dodge, "KeyZ", null);
    b.bind(dodge, "KeyX", null);
    const before = b.get();
    assert.equal(keys(b, dodge).length, MAX_KEYS_PER_ACTION);
    assert.deepEqual(b.bind(dodge, "KeyY", null), { ok: false, full: true });
    assert.equal(b.get(), before);
  });

  test("replacing a key on an action with the most keys still works", () => {
    const b = new KeyBindings();
    b.bind(dodge, "KeyZ", null);
    b.bind(dodge, "KeyX", null);
    assert.deepEqual(b.bind(dodge, "KeyY", "KeyZ"), unchanged);
    assert.deepEqual(keys(b, dodge), ["KeyF", "KeyY", "KeyX"]);
  });

  test("a key held by another action with spare keys moves over", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(jump, "ArrowLeft", null), { ok: true, takenFrom: [turnLeft], gave: null });
    assert.deepEqual(keys(b, jump), ["Space", "ArrowLeft"]);
    assert.deepEqual(keys(b, turnLeft), ["KeyQ"]);
  });

  test("a key put on a general action comes off the arena's (it would work there too)", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(character, "KeyQ", null), { ok: true, takenFrom: [turnLeft], gave: null });
    assert.deepEqual(keys(b, turnLeft), ["ArrowLeft"]);
  });

  test("replacing with another action's only key swaps the two keys", () => {
    const b = new KeyBindings();
    const result = b.bind(inventory, "KeyC", "KeyB");
    assert.deepEqual(result, { ok: true, takenFrom: [character], gave: "KeyB" });
    assert.deepEqual(keys(b, inventory), ["KeyC"]);
    assert.deepEqual(keys(b, character), ["KeyB"]);
  });

  test("adding another action's only key is refused and changes nothing, across groups too", () => {
    const b = new KeyBindings();
    const before = b.get();
    assert.deepEqual(b.bind(inventory, "KeyC", null), { ok: false, onlyKeyOf: character });
    assert.deepEqual(b.bind(character, "KeyR", null), { ok: false, onlyKeyOf: turnItem });
    assert.deepEqual(b.bind(jump, "KeyC", null), { ok: false, onlyKeyOf: character });
    assert.equal(b.get(), before);
  });

  test("the same key can be used in the overworld and in the arena", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(jump, "KeyR", null), unchanged);
    assert.deepEqual(keys(b, jump), ["Space", "KeyR"]);
    assert.deepEqual(keys(b, turnItem), ["KeyR"]);
  });

  test("a key the overworld and the arena share, put on a general action, comes off both", () => {
    const b = new KeyBindings();
    const result = b.bind(inventory, "Enter", "KeyB");
    assert.deepEqual(result, { ok: true, takenFrom: [useItem, leave], gave: "KeyB" });
    assert.deepEqual(keys(b, inventory), ["Enter"]);
    assert.deepEqual(keys(b, useItem), ["KeyB"]);
    assert.deepEqual(keys(b, leave), ["KeyB"]);
  });

  test("a swap that would put the replaced key on two actions working together is refused", () => {
    const b = new KeyBindings();
    const before = b.get();
    // C would go to the character panel's Enter, which works in the arena too, where Enter leaves a fight.
    assert.deepEqual(b.bind(useItem, "KeyC", "Enter"), { ok: false, onlyKeyOf: character });
    assert.equal(b.get(), before);
  });

  test("a reserved key is ignored", () => {
    const b = new KeyBindings();
    let calls = 0;
    b.subscribe(() => calls++);
    for (const key of ["Escape", "MetaLeft", "MetaRight"]) {
      assert.deepEqual(b.bind(forward, key, "KeyW"), unchanged);
      b.bind(forward, key, null);
    }
    assert.deepEqual(keys(b, forward), ACTIONS.general.forward.keys);
    assert.equal(calls, 0);
  });

  test("the settings stay on Esc", () => {
    const b = new KeyBindings();
    const before = b.get();
    assert.deepEqual(b.bind(menu, "KeyP", "Escape"), unchanged);
    assert.deepEqual(b.bind(menu, "KeyP", null), unchanged);
    b.unbind(menu, "Escape");
    assert.equal(b.get(), before);
  });

  test("replacing a key with itself changes nothing", () => {
    const b = new KeyBindings();
    const before = b.get();
    b.bind(forward, "KeyW", "KeyW");
    assert.equal(b.get(), before);
  });

  test("replacing a key with another of the action's own keys leaves no duplicate", () => {
    const b = new KeyBindings();
    b.bind(turnLeft, "ArrowLeft", "KeyQ");
    assert.deepEqual(keys(b, turnLeft), ["ArrowLeft"]);
  });

  test("binding notifies listeners once, even when the key moves between groups", () => {
    const b = new KeyBindings();
    let calls = 0;
    b.subscribe(() => calls++);
    b.bind(character, "KeyX", null);
    assert.equal(calls, 1);
    b.bind(inventory, "Enter", "KeyB");
    assert.equal(calls, 2);
  });

  // It used to take the key off its action without adding it to the full one, leaving it bound to nothing.
  test("adding another action's key to a full action is refused and leaves the key where it was", () => {
    const b = new KeyBindings();
    b.bind(dodge, "KeyZ", null);
    b.bind(dodge, "KeyX", null);
    const before = b.get();
    assert.deepEqual(b.bind(dodge, "KeyQ", null), { ok: false, full: true });
    assert.equal(b.get(), before);
    const holders = actionsOf("battle").filter((ref) => keys(b, ref).includes("KeyQ"));
    assert.deepEqual(holders, [turnLeft]);
  });

  test("moving one of a full action's own keys to the end isn't refused", () => {
    const b = new KeyBindings();
    b.bind(dodge, "KeyZ", null);
    b.bind(dodge, "KeyX", null);
    assert.deepEqual(b.bind(dodge, "KeyF", null), unchanged);
    assert.deepEqual(keys(b, dodge), ["KeyZ", "KeyX", "KeyF"]);
  });

  test("Shift is the block's, so binding it to dodge takes it from there", () => {
    const b = new KeyBindings();
    assert.deepEqual(b.bind(dodge, "ShiftLeft", null), { ok: true, takenFrom: [block], gave: null });
    assert.deepEqual(keys(b, block), ["ShiftRight"]);
  });
});

describe("KeyBindings.unbind", () => {
  test("drops one key from an action that has others", () => {
    const b = new KeyBindings();
    b.unbind(turnLeft, "KeyQ");
    assert.deepEqual(keys(b, turnLeft), ["ArrowLeft"]);
  });

  test("never leaves an action with no key", () => {
    const b = new KeyBindings();
    b.unbind(character, "KeyC");
    assert.deepEqual(keys(b, character), ["KeyC"]);
    b.unbind(turnLeft, "KeyQ");
    b.unbind(turnLeft, "ArrowLeft");
    assert.deepEqual(keys(b, turnLeft), ["ArrowLeft"]);
  });
});
