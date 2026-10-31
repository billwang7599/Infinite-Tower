import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT, type GuardSide, type Line, type Stance, type SwingDir } from "@infinite-tower/shared";
import { Actions, FLICK, type ActionName, type Layer } from "../../src/core/actions.js";
import { pickedGuard, pickedLine, pickedStance, pickedWay, readPlayerInput } from "../../src/modes/battle/input.js";
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
  const read = () => {
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(actions.poll(), 0, { guard: null, way: null, line: null, stance: null }, input);
    return input;
  };
  const attack = () => read().attack;
  const guard = (was: GuardSide = "top") => pickedGuard(actions.poll(), was);
  const guards = () => actions.poll().pressed.filter((a) => a.startsWith("guard"));
  let clockMs = 1000;
  let buttons = 0;
  const BIT = [1, 4, 2];
  const button = (b: number, down: boolean) => {
    const first = down && buttons === 0;
    buttons = down ? buttons | BIT[b]! : buttons & ~BIT[b]!;
    if (first) return send(canvas, "pointerdown", { button: b, buttons });
    return send(buttons === 0 ? win : doc, buttons === 0 ? "pointerup" : "pointermove", { button: b, buttons });
  };
  return {
    bindings, actions, mouseSettings, listen, read, attack, guard, guards, canvas, doc,
    move: (movementX: number, movementY: number, afterMs = 10) =>
      send(doc, "pointermove", { button: -1, buttons, movementX, movementY }, clockMs += afterMs),
    press: (code: string, repeat = false) => send(win, "keydown", { code, repeat }),
    /** A key typed in the chat's text field, whose Enter sends. */
    type: (code: string) => {
      const event = new Event("keydown", { cancelable: true });
      Object.assign(event, { code, repeat: false });
      Object.defineProperty(event, "target", { value: { tagName: "INPUT", enterKeyHint: "send" } });
      win.dispatchEvent(event);
      return event;
    },
    release: (code: string) => send(win, "keyup", { code }),
    click: (b: number) => button(b, true),
    unclick: (b: number) => button(b, false),
  };
}

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
    const interact = overworld.listen("interact");
    overworld.press("KeyE");
    assert.equal(interact.got.length, 1);
    overworld.actions.poll();
    overworld.press("KeyI");
    assert.deepEqual(overworld.actions.poll().pressed, []);

    const battle = setup("battle");
    battle.press("KeyQ");
    assert.equal(battle.actions.poll().held.has("lockOn"), true);
    battle.press("KeyT");
    assert.deepEqual(battle.actions.poll().pressed, []);
  });

  test("mouse buttons go by Mouse0, Mouse2…, the right one doing what its place gives it", () => {
    const battle = setup("battle");
    battle.click(0);
    battle.click(2);
    battle.click(1);
    assert.deepEqual(battle.actions.poll().pressed, ["lightAttack", "heavyAttack", "dragCamera"]);
    const overworld = setup("overworld");
    overworld.click(2);
    assert.deepEqual(overworld.actions.poll().pressed, ["turnItem"]);
  });

  test("a button pressed or let go while another is held counts too", () => {
    const { actions, click, unclick } = setup();
    click(1);
    click(0);
    unclick(1);
    const polled = actions.poll();
    assert.deepEqual(polled.pressed, ["dragCamera", "lightAttack"]);
    assert.deepEqual([...polled.held], ["lightAttack"]);
    unclick(0);
    assert.equal(actions.poll().held.size, 0);
  });

  test("with the mouse not captured, its buttons do nothing (a click captures it)", () => {
    const { actions, click, unclick } = setupWith({ autoLock: false, locked: false }, "battle");
    click(0);
    unclick(0);
    click(2);
    assert.deepEqual(actions.poll().pressed, []);
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
    bindings.bind({ group: "battle", action: "dodge" }, "KeyX", null);
    press("KeyF");
    press("KeyX");
    release("KeyF");
    assert.equal(actions.poll().held.has("dodge"), true);
    release("KeyX");
    assert.equal(actions.poll().held.has("dodge"), false);
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
    assert.deepEqual(actions.poll().pressed, ["dodge", "lightAttack", "jump"]);
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

  test("the middle mouse button is held as the camera drag, and doesn't dodge", () => {
    const { actions, click, unclick } = setup();
    click(1);
    const polled = actions.poll();
    assert.equal(polled.held.has("dragCamera"), true);
    assert.equal(polled.held.has("dodge"), false);
    unclick(1);
    assert.equal(actions.poll().held.has("dragCamera"), false);
  });

  test("Q is the lock toggle and right Shift locks the closest; E is Interact in the arena too", () => {
    const { actions, press } = setup();
    press("KeyQ");
    press("ShiftRight");
    press("KeyE");
    const polled = actions.poll();
    assert.deepEqual(polled.pressed, ["lockOn", "lockClosest", "interact"]);
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
      [["overworld", "bag"], "KeyE", "interact"], [["overworld", "bag"], "KeyW", "forward"],
      [["overworld", "settings"], "KeyB", "inventory"], [["overworld", "settings"], "KeyE", "interact"],
      [["battle", "battleBag"], "KeyE", "interact"], [["overworld"], "KeyS", "goBack"], [["overworld"], "KeyA", "menuLeft"],
      [["overworld"], "Enter", "confirm"], [["title"], "Escape", "goBack"],
      [["overworld", "creation"], "KeyB", "inventory"], [["overworld", "admin"], "KeyW", "forward"],
      [["battle", "admin"], "Escape", "menu"],
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
    const interact = listen("interact");
    press("KeyB");
    assert.equal(inventory.got.length, 1);
    assert.equal(interact.got.length, 0);
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
      ["overworld", "KeyE", "interact"], ["battle", "KeyQ", "lockOn"], ["bag", "KeyR", "turnItem"],
      ["bag", "Enter", "useItem"], ["bag", "KeyB", "inventory"], ["bag", "KeyC", "character"],
      ["bag", "Escape", "closeBag"], ["overworld", "Escape", "menu"], ["battle", "Escape", "menu"],
      ["settings", "Escape", "menu"], ["title", "Enter", "play"], ["creation", "Escape", "goBack"],
      ["overworld", "F1", "adminPanel"], ["battle", "F1", "adminPanel"], ["admin", "F1", "adminPanel"],
      ["admin", "Escape", "closeAdmin"],
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
    press("Space");
    actions.setLayers(["battle"]);
    assert.equal(actions.poll().held.has("jump"), true);
  });

  test("a press made before the layers change is never polled after", () => {
    const { actions, press, release, click, move } = setup("battle");
    press("KeyF");
    release("KeyF");
    click(0);
    move(FLICK.distancePx, 0);
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

describe("Actions: skills", () => {
  test("in the arena, 1 to 4 cast the skillbook's pages and R opens the chant", () => {
    const { actions, press, listen } = setup("battle");
    const chant = listen("chant");
    for (const code of ["Digit1", "Digit2", "Digit3", "Digit4"]) press(code);
    assert.deepEqual(actions.poll().pressed, ["skill1", "skill2", "skill3", "skill4"]);
    press("KeyR");
    assert.equal(chant.got.length, 1);
  });

  test("the chant has its own keys: the numbers pick a word (none casts a page), Backspace, Enter, Esc", () => {
    const cases: [string, ActionName][] = [
      ["Digit1", "pick1"], ["Digit4", "pick4"], ["Digit9", "pick9"], ["Backspace", "undoWord"],
      ["Tab", "findWord"], ["Enter", "releaseChant"], ["Escape", "closeChant"], ["KeyR", "chant"], ["KeyF", "dodge"],
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

  test("under the chant only a dodge and its way reach the fight: nothing guards, attacks or casts a page", () => {
    const { actions, press, move } = setup("battle", "chant");
    press("KeyW");
    press("KeyU");
    press("Digit1");
    press("Enter");
    press("KeyF");
    move(200, 0);
    const polled = actions.poll();
    assert.deepEqual([...polled.held].sort(), ["dodge", "forward"]);
    assert.deepEqual(polled.pressed, ["forward", "dodge"]);
    assert.deepEqual(polled.move, { x: 0, z: 1 });
  });

  test("the arena's bag: B and Esc close it, R turns, Enter uses; only a dodge and its way reach the fight", () => {
    const cases: [string, ActionName][] = [
      ["KeyB", "inventory"], ["Escape", "closeBag"], ["KeyR", "turnItem"], ["Enter", "useItem"],
    ];
    for (const [code, action] of cases) {
      const { press, listen } = setup("battle", "battleBag");
      const { got } = listen(action);
      const menu = listen("menu");
      press(code);
      assert.equal(got.length, 1, `${code} in the arena's bag`);
      assert.equal(menu.got.length, 0);
    }
    const { actions, press, move, click } = setup("battle", "battleBag");
    press("KeyW");
    press("KeyU");
    press("Digit1");
    press("KeyF");
    click(0);
    move(200, 0);
    const polled = actions.poll();
    assert.deepEqual([...polled.held].sort(), ["dodge", "forward"]);
    assert.deepEqual(polled.pressed, ["forward", "dodge"]);
  });

  test("the skillbook over the bag picks words with the same keys; Enter writes, Esc closes it alone", () => {
    const cases: [string, ActionName][] = [
      ["Digit2", "pick2"], ["Backspace", "undoWord"], ["Tab", "findWord"], ["Enter", "writePage"],
      ["Escape", "closeSkillbook"],
    ];
    for (const [code, action] of cases) {
      const { press, listen } = setup("overworld", "bag", "skillbook");
      const { got } = listen(action);
      const bag = listen("closeBag");
      press(code);
      assert.equal(got.length, 1, `${code} in the skillbook`);
      assert.equal(bag.got.length, 0);
    }
  });
});

describe("Actions: leaving the arena", () => {
  test("Enter leaves a finished fight", () => {
    const { actions, press } = setup();
    press("Enter");
    assert.deepEqual(actions.poll().pressed, ["leave"]);
  });

  test("asked whether to leave the drops: the leave key again leaves, Esc stays; the fight reads nothing", () => {
    const { actions, press, listen } = setup("battle", "leaveArena");
    const leave = listen("leave"), stay = listen("stayInArena"), menu = listen("menu");
    press("KeyW");
    press("KeyF");
    press("Enter");
    press("Escape");
    assert.equal(leave.got.length, 1);
    assert.equal(stay.got.length, 1);
    assert.equal(menu.got.length, 0);
    const polled = actions.poll();
    assert.deepEqual([polled.pressed, [...polled.held]], [[], []]);
  });
});

describe("Actions: talking", () => {
  test("Enter and the interact key go on, Esc closes and opens nothing else; the world reads nothing", () => {
    const { actions, press, listen } = setup("overworld", "dialogue");
    const next = listen("nextLine"), interact = listen("interact"), close = listen("closeDialogue");
    const menu = listen("menu"), use = listen("useItem");
    press("KeyW");
    press("Enter");
    press("KeyE");
    press("Escape");
    assert.deepEqual([next.got.length, interact.got.length, close.got.length], [1, 1, 1]);
    assert.deepEqual([menu.got.length, use.got.length], [0, 0]);
    const polled = actions.poll();
    assert.deepEqual([polled.pressed, [...polled.held]], [[], []]);
  });

  test("the same over the arena", () => {
    const { press, listen } = setup("battle", "dialogue");
    const interact = listen("interact"), leave = listen("leave");
    press("KeyE");
    press("Enter");
    assert.deepEqual([interact.got.length, leave.got.length], [1, 0]);
  });
});

describe("Actions: the questbook", () => {
  test("H opens it from the overworld and the arena", () => {
    for (const layer of ["overworld", "battle"] as const) {
      const { press, listen } = setup(layer);
      const questbook = listen("questbook");
      press("KeyH");
      assert.equal(questbook.got.length, 1, layer);
    }
  });

  test("over either, only H and Esc work, and close it (no Settings, bag or interact); the world reads nothing", () => {
    for (const mode of ["overworld", "battle"] as const) {
      const { actions, press, listen } = setup(mode, "questbook");
      const questbook = listen("questbook"), close = listen("closeQuestbook");
      const others = (["menu", "inventory", "interact", "openChat"] as const).map((a) => listen(a));
      press("KeyW");
      press("KeyH");
      press("Escape");
      for (const key of ["KeyB", "KeyE", "Slash"]) press(key);
      assert.deepEqual([questbook.got.length, close.got.length], [1, 1], mode);
      assert.deepEqual(others.map((o) => o.got.length), [0, 0, 0, 0], mode);
      const polled = actions.poll();
      assert.deepEqual([polled.pressed, [...polled.held]], [[], []], mode);
    }
  });
});

describe("Actions: chat", () => {
  test("/ opens the chat in the overworld and the arena, kept from the page so it isn't typed", () => {
    for (const layer of ["overworld", "battle"] as const) {
      const { press, listen } = setup(layer);
      const chat = listen("openChat");
      assert.equal(press("Slash").defaultPrevented, true, layer);
      assert.equal(chat.got.length, 1, layer);
    }
  });

  test("/ opens nothing from a screen, the bag or the chant", () => {
    const cases: Layer[][] = [
      ["title"], ["overworld", "bag"], ["overworld", "settings"], ["battle", "chant"], ["battle", "battleBag"],
      ["overworld", "creation"], ["overworld", "chat"],
    ];
    for (const layers of cases) {
      const { press, listen } = setup(...layers);
      const chat = listen("openChat");
      press("Slash");
      assert.equal(chat.got.length, 0, layers.join());
    }
  });

  test("the chat has only Enter (send) and Esc (close): not Settings, eating, a challenge, interacting or the bag", () => {
    for (const mode of ["overworld", "battle"] as const) {
      const { press, listen } = setup(mode, "chat");
      const send = listen("sendChat"), close = listen("closeChat");
      const others = (["menu", "useItem", "leave", "challenge", "interact", "inventory", "chant"] as const)
        .map((action) => listen(action).got);
      for (const code of ["Enter", "Escape", "KeyT", "KeyE", "KeyB", "KeyR"]) press(code);
      assert.equal(send.got.length, 1, mode);
      assert.equal(close.got.length, 1, mode);
      assert.deepEqual(others.map((got) => got.length), [0, 0, 0, 0, 0, 0, 0], mode);
    }
  });

  test("while chatting you stand still: the world reads nothing held or pressed, and the mouse flicks nothing", () => {
    for (const mode of ["overworld", "battle"] as const) {
      const { actions, press, click, move } = setup(mode, "chat");
      press("KeyW");
      press("KeyF");
      press("Space");
      press("Digit1");
      click(0);
      move(FLICK.distancePx * 2, 0);
      assert.deepEqual(actions.poll(), { held: new Set(), pressed: [], move: { x: 0, z: 0 }, turn: 0, look: 0 }, mode);
      assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 }, mode);
    }
  });

  test("in its text field Enter sends; letters, /, digits and Backspace are typed, heard by nobody", () => {
    const { type, listen } = setup("battle", "chat");
    const send = listen("sendChat");
    const others = (["challenge", "skill1", "openChat", "undoWord"] as const).map((action) => listen(action).got);
    for (const code of ["KeyT", "KeyW", "Slash", "Digit1", "Backspace", "Space"]) {
      assert.equal(type(code).defaultPrevented, false, code);
    }
    assert.equal(type("Enter").defaultPrevented, true);
    assert.equal(send.got.length, 1);
    assert.deepEqual(others.map((got) => got.length), [0, 0, 0, 0]);
  });

  test("keys held as the chat closes count again", () => {
    const { actions, press } = setup("overworld", "chat");
    press("KeyW");
    actions.setLayers(["overworld"]);
    assert.equal(actions.poll().held.has("forward"), true);
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

const FLICKS: [number, number, GuardSide | null][] = [[-1, 0, "left"], [0, -1, "top"], [1, 0, "right"], [0, 1, null]];
const FAR = FLICK.distancePx;

describe("Actions: the mouse moves the guard and attacks", () => {
  test("a quick move left, up or right moves the guard there; down does nothing; it snaps to the nearest", () => {
    for (const [x, y, side] of FLICKS) {
      const { guard, move } = setup();
      move(x * FAR / 2, y * FAR / 2);
      move(x * FAR / 2, y * FAR / 2);
      assert.equal(guard(), side ?? "top", `${x},${y}`);
    }
    const { guard, move } = setup();
    move(-FAR, -FAR * 0.8);
    assert.equal(guard(), "left", "39° above level is still left");
  });

  test("the guard keys do the same: U left, I top, O right", () => {
    for (const [key, side] of [["KeyU", "left"], ["KeyI", "top"], ["KeyO", "right"]] as const) {
      const { guard, press } = setup();
      press(key);
      assert.equal(guard(side === "top" ? "left" : "top"), side, key);
    }
  });

  test("a left click is a light attack, a right click a heavy one", () => {
    const { attack, click } = setup();
    click(0);
    assert.equal(attack(), "light");
    click(2);
    assert.equal(attack(), "heavy");
  });

  test("left Shift guard breaks, a tap shorter than a step too", () => {
    const { read, press, release } = setup();
    press("ShiftLeft");
    release("ShiftLeft");
    assert.equal(read().guardBreak, true);
    assert.equal(read().guardBreak, false);
    press("ShiftLeft");
    assert.equal(read().guardBreak, true, "held");
  });

  test("small or slow movement never flicks", () => {
    const { guards, move } = setup();
    move(FAR - 1, 0);
    for (let i = 0; i < 20; i++) move(FAR / 4, 0, i === 0 ? FLICK.windowMs : FLICK.windowMs / 3);
    assert.deepEqual(guards(), []);
  });

  test("one long sweep, however long, is one flick", () => {
    const { guards, move } = setup();
    for (let i = 0; i < 40; i++) move(FAR / 4, i % 3 === 0 ? 2 : 0, 8);
    assert.deepEqual(guards(), ["guardRight"]);
  });

  test("turning back at once flicks the other way, with no pause needed", () => {
    const { guards, move } = setup();
    move(FAR, 0);
    move(-FAR / 2, 0);
    move(-FAR / 2, 0);
    assert.deepEqual(guards(), ["guardRight", "guardLeft"]);
  });

  test("after a rest, a move the same way flicks again", () => {
    const { guards, move } = setup();
    move(FAR, 0);
    move(FAR, 0, FLICK.restMs + 1);
    assert.deepEqual(guards(), ["guardRight", "guardRight"]);
  });

  test("the sensitivity scales the distance", () => {
    const { guards, move, mouseSettings } = setup();
    mouseSettings.setFlickSensitivity(2);
    move(FAR / 2, 0);
    assert.deepEqual(guards(), ["guardRight"]);
    mouseSettings.setFlickSensitivity(0.5);
    move(0, -FAR, FLICK.restMs + 1);
    assert.deepEqual(guards(), []);
    move(0, -FAR);
    assert.deepEqual(guards(), ["guardTop"]);
  });

  test("a middle-button drag turns the camera and never flicks", () => {
    const { actions, guards, move, click, unclick } = setup();
    click(1);
    move(FAR, 0);
    unclick(1);
    assert.deepEqual(guards(), []);
    assert.deepEqual(actions.lookDelta(), { dx: FAR, dy: 0 });
  });

  test("only in the arena, with nothing over it", () => {
    for (const layers of [["overworld"], ["battle", "settings"], ["overworld", "bag"]] as Layer[][]) {
      const { actions, guards, move } = setup(...layers);
      move(FAR, 0);
      actions.setLayers(["battle"]);
      assert.deepEqual(guards(), [], layers.join());
    }
  });

  test("a flick and a key in one tick: the later of the two", () => {
    const { guard, press, move } = setup();
    move(FAR, 0);
    press("KeyU");
    assert.equal(guard(), "left");
    const other = setup();
    other.press("KeyU");
    other.move(FAR, 0);
    assert.equal(other.guard(), "right");
  });

  test("a flick is in one poll only", () => {
    const { guards, move } = setup();
    move(FAR, 0);
    assert.deepEqual(guards(), ["guardRight"]);
    assert.deepEqual(guards(), []);
  });
});

describe("Actions: a Posture fight", () => {
  const posture = () => {
    const s = setup();
    s.actions.setCombatStyle("posture");
    return s;
  };

  test("right click guards, held, a tap shorter than a step too; left click swings; it's never a heavy", () => {
    const { read, click, unclick } = posture();
    click(2);
    unclick(2);
    const tapped = read();
    assert.equal(tapped.block, true);
    assert.equal(tapped.attack, null);
    click(2);
    assert.equal(read().block, true, "held");
    unclick(2);
    assert.equal(read().block, false);
    click(0);
    assert.equal(read().attack, "light");
  });

  test("left Shift is a perilous thrust, G a perilous sweep, each a press", () => {
    const { read, press } = posture();
    press("ShiftLeft");
    const thrust = read();
    assert.equal(thrust.perilous, "thrust");
    assert.equal(thrust.guardBreak, false, "not For Honor's guard break");
    assert.equal(read().perilous, null);
    press("KeyG");
    const sweep = read();
    assert.equal(sweep.perilous, "sweep");
    assert.equal(sweep.kick, false, "not the hybrid's kick");
  });

  test("flicks and the guard keys do nothing", () => {
    const { actions, move, press } = posture();
    move(-FAR, 0);
    press("KeyU");
    assert.deepEqual(actions.poll().pressed, []);
  });

  test("in the other styles right click is still a heavy", () => {
    for (const style of ["for-honor", "hybrid"] as const) {
      const { actions, read, click } = setup();
      actions.setCombatStyle(style);
      click(2);
      assert.equal(read().attack, "heavy", style);
    }
  });
});

describe("Actions: a One Strike fight", () => {
  const oneStrike = () => {
    const s = setup();
    s.actions.setCombatStyle("one-strike");
    const line = (was: Line = "middle") => pickedLine(s.actions.poll(), was);
    return { ...s, line };
  };

  test("I raises the blade a line, K lowers it, one line a press, no further than high or low", () => {
    const { line, press } = oneStrike();
    const after = (key: string, was: Line) => {
      press(key);
      return line(was);
    };
    assert.equal(after("KeyI", "middle"), "high");
    assert.equal(after("KeyI", "low"), "middle");
    assert.equal(after("KeyI", "high"), "high");
    assert.equal(after("KeyK", "middle"), "low");
    assert.equal(after("KeyK", "low"), "low");
    press("KeyI");
    press("KeyK");
    assert.equal(line("middle"), "middle", "both in one step: up, then down");
  });

  test("a flick up raises it, a flick down lowers it; sideways does nothing", () => {
    for (const [x, y, want] of [[0, -1, "high"], [0, 1, "low"], [-1, 0, "middle"], [1, 0, "middle"]] as const) {
      const { line, move } = oneStrike();
      move(x * FAR, y * FAR);
      assert.equal(line(), want, `${x},${y}`);
    }
  });

  test("left click thrusts (a light attack), right click beats (a heavy one); no guard keys", () => {
    const { read, click, press, actions } = oneStrike();
    click(0);
    assert.equal(read().attack, "light");
    click(2);
    assert.equal(read().attack, "heavy");
    press("KeyU");
    press("ShiftLeft");
    const polled = actions.poll();
    assert.deepEqual(polled.pressed, []);
  });

  test("the line read into the input is the one picked", () => {
    const { actions } = oneStrike();
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(actions.poll(), 0, { guard: null, way: null, line: "low", stance: null }, input);
    assert.equal(input.line, "low");
  });
});

describe("Actions: a Master Cuts fight", () => {
  const cuts = () => {
    const s = setup();
    s.actions.setCombatStyle("master-cuts");
    const stance = (was: Stance = "vom-tag") => pickedStance(s.actions.poll(), was);
    return { ...s, stance };
  };

  test("U, I, O and K take Ochs, Vom Tag, Pflug and Alber", () => {
    for (const [key, want] of [["KeyU", "ochs"], ["KeyI", "vom-tag"], ["KeyO", "pflug"], ["KeyK", "alber"]] as const) {
      const { stance, press } = cuts();
      press(key);
      assert.equal(stance("alber" === want ? "vom-tag" : "alber"), want, key);
    }
  });

  test("so do flicks left, up, right and down", () => {
    const flicks = [[-1, 0, "ochs"], [0, -1, "vom-tag"], [1, 0, "pflug"], [0, 1, "alber"]] as const;
    for (const [x, y, want] of flicks) {
      const { stance, move } = cuts();
      move(x * FAR, y * FAR);
      assert.equal(stance(want === "alber" ? "ochs" : "alber"), want, `${x},${y}`);
    }
  });

  test("left click strikes (a light attack), right click throws the master cut (a heavy one), Shift wrestles", () => {
    const { read, click, press } = cuts();
    click(0);
    assert.equal(read().attack, "light");
    click(2);
    assert.equal(read().attack, "heavy");
    press("ShiftLeft");
    assert.equal(read().guardBreak, true);
  });

  test("the guard read into the input is the one picked", () => {
    const { actions } = cuts();
    const input = copyInput(IDLE_INPUT);
    readPlayerInput(actions.poll(), 0, { guard: null, way: null, line: null, stance: "pflug" }, input);
    assert.equal(input.stance, "pflug");
  });
});

describe("Actions: a hybrid fight", () => {
  const hybrid = () => {
    const s = setup();
    s.actions.setCombatStyle("hybrid");
    const aim = (was: SwingDir = "tb") => pickedWay(s.actions.poll(), was);
    const readHybrid = () => {
      const input = copyInput(IDLE_INPUT);
      readPlayerInput(s.actions.poll(), 0, { guard: null, way: "lr", line: null, stance: null }, input);
      return input;
    };
    return { ...s, aim, readHybrid };
  };

  test("U I O / J L / M , . aim from their side of the grid: the swing goes from there across", () => {
    const grid = [
      ["KeyU", "tlbr"], ["KeyI", "tb"], ["KeyO", "trbl"], ["KeyJ", "lr"], ["KeyL", "rl"], ["KeyM", "bltr"],
      ["Comma", "bt"], ["Period", "brtl"],
    ] as const;
    for (const [key, way] of grid) {
      const { aim, press } = hybrid();
      press(key);
      assert.equal(aim(way === "tb" ? "lr" : "tb"), way, key);
    }
  });

  test("a flick aims eight ways: the side it moves toward, the nearest of them", () => {
    const flicks = [
      [-1, 0, "lr"], [1, 0, "rl"], [0, -1, "tb"], [0, 1, "bt"], [-1, -1, "tlbr"], [1, -1, "trbl"], [-1, 1, "bltr"],
      [1, 1, "brtl"],
    ] as const;
    for (const [x, y, way] of flicks) {
      const { aim, move } = hybrid();
      move(x * FAR, y * FAR);
      assert.equal(aim(way === "tb" ? "lr" : "tb"), way, `${x},${y}`);
    }
  });

  test("K stabs, the clicks attack, left Shift blocks (a tap shorter than a step too), G kicks", () => {
    const { readHybrid, press, release, click } = hybrid();
    press("KeyK");
    assert.equal(readHybrid().attack, "stab");
    click(0);
    assert.equal(readHybrid().attack, "light");
    press("ShiftLeft");
    release("ShiftLeft");
    const tapped = readHybrid();
    assert.equal(tapped.block, true);
    assert.equal(tapped.guardBreak, false, "not For Honor's guard break");
    press("ShiftLeft");
    assert.equal(readHybrid().block, true, "held");
    release("ShiftLeft");
    assert.equal(readHybrid().block, false);
    press("KeyG");
    assert.equal(readHybrid().kick, true);
    assert.equal(readHybrid().way, "lr");
  });

  test("the scroll wheel stabs, once per turn of it however many events it sends", () => {
    const { readHybrid, canvas } = hybrid();
    const wheel = (atMs: number) => {
      const event = Object.assign(new Event("wheel", { cancelable: true }), { deltaY: 40 });
      Object.defineProperty(event, "timeStamp", { value: atMs });
      canvas.dispatchEvent(event);
    };
    wheel(1000);
    wheel(1020);
    wheel(1040);
    assert.equal(readHybrid().attack, "stab");
    assert.equal(readHybrid().attack, null);
    wheel(1060);
    assert.equal(readHybrid().attack, null, "still the same turn");
    wheel(2000);
    assert.equal(readHybrid().attack, "stab");
  });

  test("For Honor's keys don't aim, and the hybrid's don't guard", () => {
    const { actions, aim, press } = hybrid();
    press("KeyU");
    assert.equal(aim("tb"), "tlbr");
    actions.setCombatStyle("for-honor");
    press("KeyJ");
    assert.equal(aim("tb"), "tb", "J does nothing in a For Honor fight");
  });
});
