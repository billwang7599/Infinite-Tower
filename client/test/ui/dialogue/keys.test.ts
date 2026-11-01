import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { KeyBindings } from "../../../src/settings/bindings.js";
import { withKeys } from "../../../src/ui/dialogue/keys.js";

describe("withKeys", () => {
  test("a line's {group.action} becomes the name of that action's first key", () => {
    const bindings = new KeyBindings();
    assert.equal(withKeys("Press {overworld.interact} to talk.", bindings.get()), "Press E to talk.");
    bindings.bind({ group: "overworld", action: "interact" }, "KeyG", "KeyE");
    assert.equal(withKeys("Press {overworld.interact} to talk.", bindings.get()), "Press G to talk.");
  });

  test("an action with no key says so, and a token naming no action is left as it is", () => {
    const keys = new KeyBindings().get();
    const unbound = { ...keys, general: { ...keys.general, questbook: [] } };
    assert.equal(withKeys("{general.questbook}", unbound), "(unbound)");
    assert.equal(withKeys("{general.nothing} {nowhere.at}", keys), "{general.nothing} {nowhere.at}");
  });
});
