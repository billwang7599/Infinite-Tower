import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT, SWING_DIRS, type AttackKind, type SwingDir } from "@infinite-tower/shared";
import { Actions, SWIPE, type ActionName, type Layer } from "../../src/core/actions.js";
import { readPlayerInput } from "../../src/modes/battle/player/input.js";
import { Keyboard } from "../../src/core/keyboard.js";
import { Mouse } from "../../src/core/mouse.js";
import { KeyBindings, type ActionRef } from "../../src/settings/bindings.js";
import { MouseSettings } from "../../src/settings/mouse.js";

/** The real Keyboard and Mouse on stand-ins for window, document and canvas, fed plain Events; the mouse captured. */
function setup(...layers: Layer[]) {
  return setupWith({ autoLock: true, locked: true }, ...layers);
}

function setupWith({ autoLock, locked }: { autoLock: boolean; locked: boolean }, ...layers: Layer[]) {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    exits: 0,
    exitPointerLock() {
      doc.exits++;
    },
  });
  const canvas = Object.assign(new EventTarget(), {
    requests: 0,
    requestPointerLock(): Promise<void> {
      canvas.requests++;
      return Promise.resolve();
    },
  });
  const bindings = new KeyBindings();
  const mouseSettings = new MouseSettings();
  mouseSettings.setAutoLock(autoLock);
  const mouse = new Mouse(canvas as unknown as HTMLCanvasElement, doc as unknown as Document,
    win as unknown as Window);
  mouse.locked = locked;
  const actions = new Actions(bindings, new Keyboard(win as unknown as Window), mouse, mouseSettings);
  actions.setLayers(layers.length > 0 ? layers : ["battle"]);
  const send = (target: EventTarget, type: string, fields: object, timeStamp?: number) => {
    const event = Object.assign(new Event(type, { cancelable: true }), fields);
    if (timeStamp !== undefined) Object.defineProperty(event, "timeStamp", { value: timeStamp });
    target.dispatchEvent(event);
    return event;
  };
  const listen = (action: ActionName, use?: () => boolean) => {
    const got: boolean[] = [];
    const stop = actions.on(action, (repeat) => {
      got.push(repeat);
      return use?.();
    });
    return { got, stop };
  };
  const attack = () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(actions.poll(), 0, input);
    return input.attack;
  };
  const attacks = () => actions.poll().pressed.filter((a) => (ATTACKS as readonly string[]).includes(a));
  let clockMs = 1000;
  return {
    bindings, actions, mouseSettings, listen, attack, attacks, canvas, doc,
    move: (movementX: number, movementY: number, afterMs = 10) =>
      send(doc, "mousemove", { movementX, movementY }, clockMs += afterMs),
    press: (code: string, repeat = false) => send(win, "keydown", { code, repeat }),
    release: (code: string) => send(win, "keyup", { code }),
    click: (button: number) => send(canvas, "mousedown", { button }),
    unclick: (button: number) => send(win, "mouseup", { button }),
  };
}

const ATTACKS: readonly AttackKind[] = [...SWING_DIRS, "stab"];
const jump: ActionRef = { group: "battle", action: "jump" };

describe("Actions: key to action", () => {
  test("general's keys work in the overworld and in the arena; each one's own keys only there", () => {
    for (const layer of ["overworld", "battle"] as const) {
      const { actions, press, listen } = setup(layer);
      const inventory = listen("inventory");
      const menu = listen("menu");
      press("KeyW");
      press("KeyB");
      press("Escape");
      assert.equal(actions.poll().held.has("forward"), true, layer);
      assert.equal(inventory.got.length, 1, layer);
      assert.equal(menu.got.length, 1, layer);
    }
    const overworld = setup("overworld");
    const rest = overworld.listen("rest");
    overworld.press("KeyE");
    assert.equal(rest.got.length, 1);
    overworld.actions.poll();
    overworld.press("KeyI");
    assert.deepEqual(overworld.actions.poll().pressed, []);

    const battle = setup("battle");
    battle.press("KeyQ");
    assert.equal(battle.actions.poll().held.has("lockOn"), true);
    battle.press("KeyI");
    battle.press("KeyE");
    assert.deepEqual(battle.actions.poll().pressed, []);
  });

  test("mouse buttons go by Mouse0, Mouse2…, the right one doing what its place gives it", () => {
    const battle = setup("battle");
    battle.click(0);
    battle.click(2);
    assert.deepEqual(battle.actions.poll().pressed, ["stab", "dragCamera"]);
    const overworld = setup("overworld");
    overworld.click(2);
    assert.deepEqual(overworld.actions.poll().pressed, ["turnItem"]);
  });

  test("a key rebound counts at once", () => {
    const { actions, bindings, press, release } = setup("battle");
    press("Space");
    release("Space");
    assert.deepEqual(actions.poll().pressed, ["jump"]);
    bindings.bind(jump, "KeyX", "Space");
    press("KeyX");
    press("Space");
    assert.deepEqual(actions.poll().pressed, ["jump"]);
  });
});

describe("Actions: poll", () => {
  test("an action is held while any of its keys is", () => {
    const { actions, bindings, press, release } = setup();
    bindings.bind({ group: "battle", action: "block" }, "KeyX", null);
    press("ShiftLeft");
    press("KeyX");
    release("ShiftLeft");
    assert.equal(actions.poll().held.has("block"), true);
    release("KeyX");
    assert.equal(actions.poll().held.has("block"), false);
  });

  test("move.x gives -1, 0 or 1, from the same keys in both places", () => {
    const { actions, press, release } = setup();
    for (const layer of ["overworld", "battle"] as const) {
      actions.setLayers([layer]);
      const x = () => actions.poll().move.x;
      assert.equal(x(), 0);
      press("KeyD");
      assert.equal(x(), 1);
      press("KeyA");
      assert.equal(x(), 0);
      release("KeyD");
      assert.equal(x(), -1);
      release("KeyA");
    }
  });

  test("poll resolves forward/back, the camera's turn and its tilt", () => {
    const { actions, press, release } = setup();
    const axes = () => {
      const { move, turn, look } = actions.poll();
      return { z: move.z, turn, look };
    };
    assert.deepEqual(axes(), { z: 0, turn: 0, look: 0 });
    press("KeyW");
    press("ArrowLeft");
    press("ArrowDown");
    assert.deepEqual(axes(), { z: 1, turn: -1, look: 1 });
    release("KeyW");
    release("ArrowLeft");
    release("ArrowDown");
    press("KeyS");
    press("ArrowRight");
    press("ArrowUp");
    assert.deepEqual(axes(), { z: -1, turn: 1, look: -1 });
    press("KeyW");
    press("ArrowLeft");
    press("ArrowDown");
    assert.deepEqual(axes(), { z: 0, turn: 0, look: 0 });
  });

  test("presses come in the order they were made, keys and clicks together", () => {
    const { actions, press, click } = setup();
    press("KeyF");
    click(0);
    press("Space");
    assert.deepEqual(actions.poll().pressed, ["dodge", "stab", "jump"]);
  });

  test("a press is in one poll only, even a tap shorter than a tick", () => {
    const { actions, press, release } = setup();
    press("KeyF");
    release("KeyF");
    assert.deepEqual(actions.poll().pressed, ["dodge"]);
    assert.deepEqual(actions.poll().pressed, []);
  });

  test("a held key isn't pressed again; auto-repeat isn't a press", () => {
    const { actions, press } = setup();
    press("KeyF");
    actions.poll();
    press("KeyF", true);
    const polled = actions.poll();
    assert.deepEqual(polled.pressed, []);
    assert.equal(polled.held.has("dodge"), true);
  });

  test("the right mouse button is held as the camera drag, and doesn't dodge", () => {
    const { actions, click, unclick } = setup();
    click(2);
    const polled = actions.poll();
    assert.equal(polled.held.has("dragCamera"), true);
    assert.equal(polled.held.has("dodge"), false);
    unclick(2);
    assert.equal(actions.poll().held.has("dragCamera"), false);
  });

  test("Q is the lock toggle and right Shift locks the closest; E does nothing in the arena", () => {
    const { actions, press } = setup();
    press("KeyQ");
    press("ShiftRight");
    press("KeyE");
    const polled = actions.poll();
    assert.deepEqual(polled.pressed, ["lockOn", "lockClosest"]);
    assert.equal(polled.held.has("block"), false);
    assert.equal(polled.turn, 0);
  });

  test("a rebound key does its new action, and the old key nothing", () => {
    const { actions, bindings, press } = setup();
    bindings.bind(jump, "KeyX", "Space");
    press("Space");
    assert.equal(actions.poll().held.has("jump"), false);
    press("KeyX");
    assert.equal(actions.poll().held.has("jump"), true);
  });
});

describe("Actions: the layers", () => {
  test("the title has the keys before anything else is decided", () => {
    const win = new EventTarget();
    const actions = new Actions(new KeyBindings(), new Keyboard(win as unknown as Window),
      new Mouse(new EventTarget() as unknown as HTMLCanvasElement, new EventTarget() as unknown as Document,
        win as unknown as Window), new MouseSettings());
    let played = false;
    actions.on("play", () => void (played = true));
    win.dispatchEvent(Object.assign(new Event("keydown"), { code: "Enter", repeat: false }));
    assert.equal(played, true);
  });

  test("a handler for an action the layer on top doesn't have never fires", () => {
    const cases: [Layer[], string, ActionName][] = [
      [["overworld", "bag"], "KeyE", "rest"], [["overworld", "bag"], "KeyW", "forward"],
      [["overworld", "settings"], "KeyB", "inventory"], [["overworld", "settings"], "KeyE", "rest"],
      [["battle"], "KeyE", "rest"], [["overworld"], "KeyS", "goBack"], [["overworld"], "KeyA", "menuLeft"],
      [["overworld"], "Enter", "confirm"], [["title"], "Escape", "goBack"],
      [["overworld", "creation"], "KeyB", "inventory"],
    ];
    for (const [layers, code, action] of cases) {
      const { press, listen } = setup(...layers);
      const { got } = listen(action);
      press(code);
      assert.equal(got.length, 0, `${code} in ${layers.join()} isn't ${action}`);
    }
  });

  test("a listener hears only its own action", () => {
    const { press, listen } = setup("overworld");
    const inventory = listen("inventory");
    const rest = listen("rest");
    press("KeyB");
    assert.equal(inventory.got.length, 1);
    assert.equal(rest.got.length, 0);
  });

  test("Esc in the bag closes it and nothing else; the next Esc opens Settings", () => {
    const { actions, press, listen } = setup("overworld", "bag");
    const settings = listen("menu");
    const bag = listen("closeBag", () => {
      actions.setLayers(["overworld"]);
      return true;
    });
    assert.equal(press("Escape").defaultPrevented, true);
    assert.equal(bag.got.length, 1);
    assert.equal(settings.got.length, 0);
    press("Escape");
    assert.equal(settings.got.length, 1, "the next Esc, with the bag closed");
    assert.equal(bag.got.length, 1);
  });

  test("each layer reads its own keys", () => {
    const cases: [Layer, string, ActionName][] = [
      ["overworld", "KeyE", "rest"], ["battle", "KeyQ", "lockOn"], ["bag", "KeyR", "turnItem"],
      ["bag", "Enter", "useItem"], ["bag", "KeyB", "inventory"], ["bag", "KeyC", "character"],
      ["bag", "Escape", "closeBag"], ["overworld", "Escape", "menu"], ["battle", "Escape", "menu"],
      ["settings", "Escape", "menu"], ["title", "Enter", "play"], ["creation", "Escape", "goBack"],
    ];
    for (const [layer, code, action] of cases) {
      const { press, listen } = setup(layer);
      const { got } = listen(action);
      press(code);
      assert.equal(got.length, 1, `${code} in ${layer}`);
    }
  });

  test("on the title, Enter, Space and J play, and nothing confirms", () => {
    const { press, listen } = setup("title");
    const play = listen("play");
    const confirm = listen("confirm");
    for (const code of ["Enter", "Space", "KeyJ", "Escape"]) press(code);
    assert.equal(play.got.length, 3);
    assert.equal(confirm.got.length, 0);
  });

  test("creation has the fixed menu keys: Enter confirms, Space and J go on, Esc goes back; none plays", () => {
    const { press, listen } = setup("overworld", "creation");
    const heard = (["confirm", "goOn", "goBack", "play"] as const).map((action) => listen(action).got);
    for (const code of ["Enter", "Space", "KeyJ", "Escape"]) press(code);
    assert.deepEqual(heard.map((got) => got.length), [1, 2, 1, 0]);
  });

  test("the menus' directions are the arrows and WASD", () => {
    const { press, listen } = setup("creation");
    const heard = (["menuUp", "menuDown", "menuLeft", "menuRight"] as const).map((action) => listen(action).got);
    for (const code of ["ArrowUp", "KeyW", "ArrowDown", "KeyS", "ArrowLeft", "KeyA", "ArrowRight", "KeyD"]) {
      press(code);
    }
    assert.deepEqual(heard.map((got) => got.length), [2, 2, 2, 2]);
  });

  test("rebinding never moves a menu key; a rebound key counts at once where it's bound", () => {
    const { actions, bindings, press, listen } = setup("overworld");
    bindings.bind({ group: "general", action: "forward" }, "ArrowUp", "KeyW");
    press("ArrowUp");
    assert.equal(actions.poll().held.has("forward"), true);
    actions.setLayers(["creation"]);
    const up = listen("menuUp");
    press("KeyW");
    press("ArrowUp");
    assert.equal(up.got.length, 2);
  });

  test("a key a listener uses is kept from the page; one it turns down, or nobody hears, is left to it", () => {
    const { press, listen } = setup("creation");
    listen("confirm");
    listen("goOn", () => false);
    assert.equal(press("Enter").defaultPrevented, true);
    assert.equal(press("Space").defaultPrevented, false);
    assert.equal(press("Escape").defaultPrevented, false);
  });

  test("keys the browser would scroll or move focus with are swallowed in the world; letters are not", () => {
    for (const layer of ["overworld", "battle"] as const) {
      const { press } = setup(layer);
      for (const code of ["Space", "ArrowUp", "Tab"]) assert.equal(press(code).defaultPrevented, true, code);
      assert.equal(press("KeyW").defaultPrevented, false);
    }
    const { press } = setup("battle", "settings");
    assert.equal(press("Space").defaultPrevented, false, "a screen over the world leaves them to the page");
  });

  test("listeners are told about auto-repeat", () => {
    const { press, listen } = setup("settings");
    const { got } = listen("menu");
    press("Escape");
    press("Escape", true);
    assert.deepEqual(got, [false, true]);
  });

  test("a listener that stopped listening gets nothing", () => {
    const { press, listen } = setup("title");
    const { got, stop } = listen("play");
    stop();
    press("Enter");
    assert.deepEqual(got, []);
  });

  test("with a screen or the bag on top, the world reads nothing held or pressed", () => {
    for (const top of ["bag", "settings", "creation"] as const) {
      const { actions, press } = setup("overworld", top);
      press("KeyW");
      press("KeyF");
      assert.deepEqual(actions.poll(), { held: new Set(), pressed: [], move: { x: 0, z: 0 }, turn: 0, look: 0 }, top);
    }
  });

  test("held keys count again once the screen over the world is gone", () => {
    const { actions, press } = setup("battle", "settings");
    press("ShiftLeft");
    actions.setLayers(["battle"]);
    assert.equal(actions.poll().held.has("block"), true);
  });

  test("a press made before the layers change is never polled after", () => {
    const { actions, press, release, click, move } = setup("battle");
    press("KeyF");
    release("KeyF");
    click(0);
    move(SWIPE.distancePx, 0);
    actions.setLayers(["battle", "settings"]);
    actions.setLayers(["battle"]);
    assert.deepEqual(actions.poll().pressed, []);
  });

  test("setting the same layers again keeps the presses", () => {
    const { actions, press } = setup("battle");
    press("KeyF");
    actions.setLayers(["battle"]);
    assert.deepEqual(actions.poll().pressed, ["dodge"]);
  });

  test("from the overworld into the arena, held keys stay held", () => {
    const { actions, press } = setup("overworld");
    press("KeyW");
    actions.setLayers(["battle"]);
    assert.equal(actions.poll().held.has("forward"), true);
  });
});

describe("Actions: spells", () => {
  test("in the arena, 1 to 4 cast the spellbook's pages and R opens the chant", () => {
    const { actions, press, listen } = setup("battle");
    const chant = listen("chant");
    for (const code of ["Digit1", "Digit2", "Digit3", "Digit4"]) press(code);
    assert.deepEqual(actions.poll().pressed, ["spell1", "spell2", "spell3", "spell4"]);
    press("KeyR");
    assert.equal(chant.got.length, 1);
  });

  test("the chant has its own keys: the numbers pick a word (none casts a page), Backspace, Enter, Esc", () => {
    const cases: [string, ActionName][] = [
      ["Digit1", "pick1"], ["Digit4", "pick4"], ["Digit9", "pick9"], ["Backspace", "undoWord"],
      ["Tab", "findWord"], ["Enter", "castChant"], ["Escape", "closeChant"], ["KeyR", "chant"], ["KeyF", "dodge"],
    ];
    for (const [code, action] of cases) {
      const { press, listen } = setup("battle", "chant");
      const { got } = listen(action);
      press(code);
      assert.equal(got.length, 1, `${code} in the chant`);
    }
    const { press, listen } = setup("battle", "chant");
    const settings = listen("menu");
    press("Escape");
    assert.equal(settings.got.length, 0);
  });

  test("under the chant only a dodge and its way reach the fight: nothing swings, blocks or casts a page", () => {
    const { actions, press, move } = setup("battle", "chant");
    press("KeyW");
    press("ShiftLeft");
    press("Digit1");
    press("Enter");
    press("KeyF");
    move(200, 0);
    const polled = actions.poll();
    assert.deepEqual([...polled.held].sort(), ["dodge", "forward"]);
    assert.deepEqual(polled.pressed, ["forward", "dodge"]);
    assert.deepEqual(polled.move, { x: 0, z: 1 });
  });

  test("the spellbook over the bag picks words with the same keys; Enter writes, Esc closes it alone", () => {
    const cases: [string, ActionName][] = [
      ["Digit2", "pick2"], ["Backspace", "undoWord"], ["Tab", "findWord"], ["Enter", "writePage"],
      ["Escape", "closeSpellbook"],
    ];
    for (const [code, action] of cases) {
      const { press, listen } = setup("overworld", "bag", "spellbook");
      const { got } = listen(action);
      const bag = listen("closeBag");
      press(code);
      assert.equal(got.length, 1, `${code} in the spellbook`);
      assert.equal(bag.got.length, 0);
    }
  });
});

describe("Actions: the mouse", () => {
  test("with the arena on top, lookDelta is what the mouse moved since the last call", () => {
    const { actions, move } = setup("battle");
    move(3, -2);
    move(4, 1);
    assert.deepEqual(actions.lookDelta(), { dx: 7, dy: -1 });
    assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 });
  });

  test("under a screen, lookDelta is zero and what moved meanwhile is dropped", () => {
    const { actions, move } = setup("battle", "settings");
    move(5, 5);
    assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 });
    actions.setLayers(["battle"]);
    assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 });
  });

  test("the arena coming on top captures the mouse when Auto mouse lock is on", () => {
    const { actions, canvas } = setupWith({ autoLock: true, locked: false }, "overworld");
    assert.equal(canvas.requests, 0);
    actions.setLayers(["battle"]);
    assert.equal(canvas.requests, 1);
  });

  test("with Auto mouse lock off, only a click in the arena captures it", () => {
    const { actions, canvas } = setupWith({ autoLock: false, locked: false }, "overworld");
    canvas.dispatchEvent(new Event("click"));
    actions.setLayers(["battle"]);
    assert.equal(canvas.requests, 0);
    canvas.dispatchEvent(new Event("click"));
    assert.equal(canvas.requests, 1);
  });

  test("a screen over the arena lets go of the mouse", () => {
    const { actions, doc } = setup("battle");
    actions.setLayers(["battle", "settings"]);
    assert.equal(doc.exits, 1);
  });
});

/** Each swing is named by its way across the screen; screen y grows downwards. */
const SWIPES: [number, number, SwingDir][] = [
  [1, 0, "lr"], [-1, 0, "rl"], [0, 1, "tb"], [0, -1, "bt"],
  [1, 1, "tlbr"], [-1, -1, "brtl"], [-1, 1, "trbl"], [1, -1, "bltr"],
];
const FAR = SWIPE.distancePx;

describe("Actions: the mouse swings the sword", () => {
  test("a quick move swings the way it went, all eight; it snaps to the nearest", () => {
    assert.deepEqual(SWIPES.map(([, , dir]) => dir).sort(), [...SWING_DIRS].sort());
    for (const [x, y, dir] of SWIPES) {
      const { attack, move } = setup();
      const step = FAR / 2 / Math.hypot(x, y);
      move(x * step, y * step);
      move(x * step, y * step);
      assert.equal(attack(), dir, `${x},${y}`);
    }
    const { attack, move } = setup();
    move(FAR, FAR * 0.3);
    assert.equal(attack(), "lr", "17° below level is still left to right");
  });

  test("a left click stabs", () => {
    const { attack, click } = setup();
    click(0);
    assert.equal(attack(), "stab");
  });

  test("the keys that used to swing do nothing in the arena", () => {
    const { attack, press } = setup();
    for (const key of ["KeyU", "KeyI", "KeyO", "KeyJ", "KeyK", "KeyL", "KeyM", "Comma", "Period"]) press(key);
    assert.equal(attack(), null);
  });

  test("small or slow movement never swings", () => {
    const { attacks, move } = setup();
    move(FAR - 1, 0);
    for (let i = 0; i < 20; i++) move(FAR / 4, 0, i === 0 ? SWIPE.windowMs : SWIPE.windowMs / 3);
    assert.deepEqual(attacks(), []);
  });

  test("one long sweep, however long, is one swing", () => {
    const { attacks, move } = setup();
    for (let i = 0; i < 40; i++) move(FAR / 4, i % 3 === 0 ? 2 : 0, 8);
    assert.deepEqual(attacks(), ["lr"]);
  });

  test("turning back at once swings the reverse, with no pause needed", () => {
    const { attacks, move } = setup();
    move(FAR, 0);
    move(-FAR / 2, 0);
    move(-FAR / 2, 0);
    assert.deepEqual(attacks(), ["lr", "rl"]);
  });

  test("after a rest, a move the same way swings again", () => {
    const { attacks, move } = setup();
    move(FAR, 0);
    move(FAR, 0, SWIPE.restMs + 1);
    assert.deepEqual(attacks(), ["lr", "lr"]);
  });

  test("the sensitivity scales the distance", () => {
    const { attacks, move, mouseSettings } = setup();
    mouseSettings.setSwingSensitivity(2);
    move(FAR / 2, 0);
    assert.deepEqual(attacks(), ["lr"]);
    mouseSettings.setSwingSensitivity(0.5);
    move(0, FAR, SWIPE.restMs + 1);
    assert.deepEqual(attacks(), []);
    move(0, FAR);
    assert.deepEqual(attacks(), ["tb"]);
  });

  test("while blocking (left Shift) movement doesn't swing, nor count once the block is let go", () => {
    const { attacks, move, press, release } = setup();
    press("ShiftLeft");
    move(FAR, 0);
    move(FAR / 2, 0);
    release("ShiftLeft");
    assert.deepEqual(attacks(), []);
    move(FAR / 2, 0);
    assert.deepEqual(attacks(), []);
  });

  test("a right-button drag turns the camera and never swings", () => {
    const { actions, attacks, move, click, unclick } = setup();
    click(2);
    move(FAR, 0);
    unclick(2);
    assert.deepEqual(attacks(), []);
    assert.deepEqual(actions.lookDelta(), { dx: FAR, dy: 0 });
  });

  test("only in the arena, with nothing over it", () => {
    for (const layers of [["overworld"], ["battle", "settings"], ["overworld", "bag"]] as Layer[][]) {
      const { actions, attacks, move } = setup(...layers);
      move(FAR, 0);
      actions.setLayers(["battle"]);
      assert.deepEqual(attacks(), [], layers.join());
    }
  });

  test("a swipe and a click in one tick: the later of the two", () => {
    const { attack, click, move } = setup();
    move(FAR, 0);
    click(0);
    assert.equal(attack(), "stab");
    const other = setup();
    other.click(0);
    other.move(FAR, 0);
    assert.equal(other.attack(), "lr");
  });

  test("a swing is in one poll only", () => {
    const { attack, move } = setup();
    move(FAR, 0);
    assert.equal(attack(), "lr");
    assert.equal(attack(), null);
  });
});
