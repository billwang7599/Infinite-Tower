import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SWING_DIRS, type AttackKind } from "@infinite-tower/shared";
import { Actions, actionOf } from "../../src/core/actions.js";
import { Keyboard } from "../../src/core/keyboard.js";
import { Mouse } from "../../src/core/mouse.js";
import { KeyBindings, type ActionRef } from "../../src/settings/bindings.js";

/** The real Keyboard and Mouse on stand-ins for window, document and canvas, fed plain Events; the mouse captured. */
function setup() {
  const win = new EventTarget(), canvas = new EventTarget();
  const keyboard = new Keyboard(win as unknown as Window);
  keyboard.enabled = true;
  const mouse = new Mouse(canvas as unknown as HTMLCanvasElement, new EventTarget() as unknown as Document,
    win as unknown as Window);
  mouse.locked = true;
  const bindings = new KeyBindings();
  const send = (target: EventTarget, type: string, fields: object) =>
    target.dispatchEvent(Object.assign(new Event(type), fields));
  return {
    bindings,
    actions: new Actions(keyboard, mouse, bindings),
    press: (code: string) => send(win, "keydown", { code, repeat: false }),
    release: (code: string) => send(win, "keyup", { code }),
    click: (button: number) => send(canvas, "mousedown", { button }),
    unclick: (button: number) => send(win, "mouseup", { button }),
  };
}

const jump: ActionRef = { group: "battle", action: "jump" };
const swingTB: ActionRef = { group: "battle", action: "swingTB" };

describe("actionOf", () => {
  const map = new KeyBindings().get();

  test("general's keys work in the overworld and in the arena; each one's own keys only there", () => {
    for (const group of ["overworld", "battle"] as const) {
      assert.equal(actionOf(map, group, "KeyW"), "forward");
      assert.equal(actionOf(map, group, "KeyB"), "inventory");
      assert.equal(actionOf(map, group, "Escape"), "menu");
    }
    assert.equal(actionOf(map, "overworld", "KeyE"), "rest");
    assert.equal(actionOf(map, "battle", "KeyE"), "turnRight");
    assert.equal(actionOf(map, "overworld", "KeyI"), undefined);
    assert.equal(actionOf(map, "battle", "KeyR"), undefined);
    assert.equal(actionOf(map, "general", "KeyE"), undefined);
  });

  test("mouse buttons go by Mouse0, Mouse2…, the right one doing what its place gives it", () => {
    assert.equal(actionOf(map, "battle", "Mouse0"), "swingLR");
    assert.equal(actionOf(map, "battle", "Mouse2"), "dodge");
    assert.equal(actionOf(map, "overworld", "Mouse2"), "turnItem");
  });

  test("a key rebound counts at once", () => {
    const bindings = new KeyBindings();
    bindings.bind(jump, "KeyX", "Space");
    assert.equal(actionOf(bindings.get(), "battle", "KeyX"), "jump");
    assert.equal(actionOf(bindings.get(), "battle", "Space"), undefined);
  });
});

describe("Actions", () => {
  test("an action is held while any of its keys is", () => {
    const { actions, press, release } = setup();
    press("ShiftLeft");
    press("ShiftRight");
    release("ShiftLeft");
    assert.equal(actions.isDown("battle", "block"), true);
    release("ShiftRight");
    assert.equal(actions.isDown("battle", "block"), false);
  });

  test("axis gives -1, 0 or 1, from the same keys in both places", () => {
    const { actions, press, release } = setup();
    for (const group of ["overworld", "battle"] as const) {
      const axis = () => actions.axis(group, "left", "right");
      assert.equal(axis(), 0);
      press("KeyD");
      assert.equal(axis(), 1);
      press("KeyA");
      assert.equal(axis(), 0);
      release("KeyD");
      assert.equal(axis(), -1);
      release("KeyA");
    }
  });

  test("a press counts once, even a tap shorter than a step", () => {
    const { actions, press, release } = setup();
    press("KeyE");
    release("KeyE");
    assert.equal(actions.consumePressed("overworld", "rest"), true);
    assert.equal(actions.consumePressed("overworld", "rest"), false);
  });

  test("the right mouse button dodges, once per click", () => {
    const { actions, click } = setup();
    click(2);
    assert.equal(actions.isDown("battle", "dodge"), true);
    assert.equal(actions.consumePressed("battle", "dodge"), true);
    assert.equal(actions.consumePressed("battle", "dodge"), false);
  });

  test("a key and a click for the same action in one step are one press", () => {
    const { actions, press, click } = setup();
    press("KeyF");
    click(2);
    assert.equal(actions.consumePressed("battle", "dodge"), true);
    assert.equal(actions.consumePressed("battle", "dodge"), false);
  });

  test("a rebound key does its new action, and the old key nothing", () => {
    const { actions, bindings, press } = setup();
    bindings.bind(jump, "KeyX", "Space");
    press("Space");
    assert.equal(actions.isDown("battle", "jump"), false);
    press("KeyX");
    assert.equal(actions.isDown("battle", "jump"), true);
  });
});

/** The default keys, a 3 x 3 grid: each swing starts at its key's place and ends on the opposite side; K stabs. */
const DEFAULT_KEYS: [string, AttackKind][] = [
  ["KeyU", "tlbr"], ["KeyI", "tb"], ["KeyO", "trbl"],
  ["KeyJ", "lr"], ["KeyK", "stab"], ["KeyL", "rl"],
  ["KeyM", "bltr"], ["Comma", "bt"], ["Period", "brtl"],
];

describe("the attack keys", () => {
  test("u i o / j k l / m , . : each swing starts at its key, the middle one stabs", () => {
    for (const [key, attack] of DEFAULT_KEYS) {
      const { actions, press } = setup();
      press(key);
      assert.equal(actions.attack(), attack, key);
    }
  });

  test("every swing direction has a key", () => {
    const swings = DEFAULT_KEYS.map(([, attack]) => attack).filter((a) => a !== "stab");
    assert.deepEqual([...swings].sort(), [...SWING_DIRS].sort());
  });

  test("holding Shift (the block) changes no swing", () => {
    for (const [key, attack] of DEFAULT_KEYS) {
      const { actions, press } = setup();
      press("ShiftLeft");
      press(key);
      assert.equal(actions.attack(), attack, key);
    }
  });

  test("a held key keeps its swing while held, and lets go when released", () => {
    const { actions, press, release } = setup();
    press("KeyJ");
    assert.equal(actions.attack(), "lr");
    assert.equal(actions.attack(), "lr", "still the same press");
    release("KeyJ");
    assert.equal(actions.attack(), null);
  });

  test("a new key pressed while another is held is a new attack", () => {
    const { actions, press, release } = setup();
    press("KeyJ");
    assert.equal(actions.attack(), "lr");
    press("KeyI");
    assert.equal(actions.attack(), "tb");
    release("KeyI");
    assert.equal(actions.attack(), null, "letting go of the newer one ends it; the older one isn't pressed again");
  });

  test("of two pressed in one step, the later wins, and the earlier is dropped", () => {
    const { actions, press, release } = setup();
    press("KeyI");
    press("KeyJ");
    assert.equal(actions.attack(), "lr");
    release("KeyJ");
    assert.equal(actions.attack(), null);
  });

  test("a key and a click in one step: the later of the two", () => {
    const { actions, press, click } = setup();
    press("KeyI");
    click(0);
    assert.equal(actions.attack(), "lr");
    const other = setup();
    other.click(0);
    other.press("KeyI");
    assert.equal(other.actions.attack(), "tb");
  });

  test("a tap shorter than a frame still counts", () => {
    const { actions, press, release } = setup();
    press("KeyU");
    release("KeyU");
    assert.equal(actions.attack(), "tlbr");
    assert.equal(actions.attack(), null);
  });

  test("the left mouse button swings left to right, like J", () => {
    const { actions, click, unclick } = setup();
    click(0);
    assert.equal(actions.attack(), "lr");
    unclick(0);
    assert.equal(actions.attack(), null);
  });

  test("an attack moved to another key swings from that key only", () => {
    const { actions, bindings, press } = setup();
    bindings.bind(swingTB, "KeyY", "KeyI");
    press("KeyI");
    assert.equal(actions.attack(), null);
    press("KeyY");
    assert.equal(actions.attack(), "tb");
  });

  test("keys that aren't attacks are left for their own actions", () => {
    const { actions, press } = setup();
    press("KeyF");
    assert.equal(actions.attack(), null);
    assert.equal(actions.consumePressed("battle", "dodge"), true);
  });
});
