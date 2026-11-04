import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { copyInput, IDLE_INPUT, type SwingDir } from "@infinite-tower/shared";
import { Actions, DRAG, FLICK, type ActionName, type Layer } from "../../src/core/actions.js";
import { pickedWay, readPlayerInput } from "../../src/modes/battle/input.js";
import { steerLock } from "../../src/modes/battle/lock.js";
import { Keyboard } from "../../src/core/keyboard.js";
import { Mouse, WHEEL } from "../../src/core/mouse.js";
import { KeyBindings, type ActionRef } from "../../src/settings/bindings.js";
import { MouseSettings } from "../../src/settings/mouse.js";
import { fakePointerLock, settle, type LockAnswer } from "../fixtures/pointer-lock.js";

/** The real Keyboard and Mouse on stand-ins for window, document and canvas, fed plain Events; the mouse captured. */
function setup(...layers: Layer[]) {
  return setupWith({ autoLock: true, locked: true }, ...layers);
}

function setupWith(
  { autoLock, locked, answer }: { autoLock: boolean; locked: boolean; answer?: LockAnswer }, ...layers: Layer[]
) {
  const { win, doc, canvas, grant, escape } = fakePointerLock(answer);
  const bindings = new KeyBindings();
  const mouseSettings = new MouseSettings();
  mouseSettings.setAutoLock(autoLock);
  const mouse = new Mouse(canvas as unknown as HTMLCanvasElement, doc as unknown as Document, win);
  mouse.locked = locked;
  const actions = new Actions(bindings, new Keyboard(win), mouse, mouseSettings);
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
    readPlayerInput(actions.poll(), 0, "lr", input);
    return input;
  };
  const attack = () => read().attack;
  const aim = (was: SwingDir = "tb") => pickedWay(actions.poll(), was);
  const aims = () => actions.poll().flicks;
  let clockMs = 1000;
  let buttons = 0;
  const BIT = [1, 4, 2, 8, 16];
  const button = (b: number, down: boolean) => {
    const first = down && buttons === 0;
    buttons = down ? buttons | BIT[b]! : buttons & ~BIT[b]!;
    if (first) return send(canvas, "pointerdown", { button: b, buttons });
    return send(buttons === 0 ? win : doc, buttons === 0 ? "pointerup" : "pointermove", { button: b, buttons });
  };
  return {
    bindings, actions, mouseSettings, listen, read, attack, aim, aims, canvas, doc, mouse, grant, escape,
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
    wheel: (deltaY: number, afterMs = 10, deltaMode = 0) =>
      send(canvas, "wheel", { deltaY, deltaMode }, clockMs += afterMs),
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

  test("mouse buttons go by Mouse0, Mouse2…, the right one doing what its place gives it as it's let go", () => {
    const battle = setup("battle");
    battle.click(0);
    battle.click(2);
    battle.click(1);
    assert.deepEqual(battle.actions.poll().pressed, ["lightAttack", "dragCamera"]);
    battle.unclick(2);
    assert.deepEqual(battle.actions.poll().pressed, ["heavyAttack"]);
    const overworld = setup("overworld");
    overworld.click(2);
    assert.deepEqual(overworld.actions.poll().pressed, []);
    overworld.unclick(2);
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

  test("in the overworld, the arrows turn and tilt the camera on the same axes", () => {
    const { actions, press, release } = setup("overworld");
    press("ArrowUp");
    press("ArrowLeft");
    assert.deepEqual([actions.poll().look, actions.poll().turn], [-1, -1]);
    release("ArrowUp");
    release("ArrowLeft");
    press("ArrowDown");
    press("ArrowRight");
    assert.deepEqual([actions.poll().look, actions.poll().turn], [1, 1]);
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
      [["battle", "admin"], "Escape", "menu"], [["overworld"], "F2", "killEnemy"],
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
      ["admin", "Escape", "closeAdmin"], ["battle", "F2", "killEnemy"],
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
      assert.deepEqual(actions.poll(), {
        held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragged: false, zoom: 0,
      }, top);
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

  test("under the chant only a dodge and its way reach the fight: nothing aims, attacks or casts a page", () => {
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
      assert.deepEqual(actions.poll(), {
        held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragged: false, zoom: 0,
      }, mode);
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
  test("a drag past DRAG.startPx with the middle or right button held turns the camera; short of it, nothing", () => {
    for (const layer of ["battle", "overworld"] as const) {
      for (const b of [1, 2]) {
        const { actions, move, click, unclick } = setupWith(
          { autoLock: true, locked: layer === "battle", answer: "later" }, layer,
        );
        click(b);
        move(DRAG.startPx - 1, 0);
        assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 }, `${layer} ${b}: short`);
        assert.equal(actions.poll().dragged, false, `${layer} ${b}: not dragged`);
        move(3, -2);
        move(4, 1);
        assert.deepEqual(actions.lookDelta(), { dx: 7, dy: -1 }, `${layer} ${b}: turning`);
        assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 });
        assert.equal(actions.poll().dragged, true, `${layer} ${b}: dragged`);
        assert.equal(actions.poll().dragged, false, "once per poll");
        unclick(b);
        move(10, 10);
        assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 }, `${layer} ${b}: let go`);
      }
    }
  });

  test("with no button held the mouse never turns the camera", () => {
    for (const layer of ["battle", "overworld"] as const) {
      const { actions, move } = setup(layer);
      move(30, -20);
      assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 }, layer);
      assert.equal(actions.poll().dragged, false, layer);
    }
  });

  test("a right click is a heavy attack as it's let go; a right drag is none, lets go of the lock and turns", () => {
    const clicked = setup("battle");
    clicked.click(2);
    clicked.move(DRAG.startPx - 1, 0);
    assert.equal(clicked.attack(), null, "not on the press");
    clicked.unclick(2);
    assert.equal(clicked.attack(), "heavy", "on the release");
    assert.equal(clicked.attack(), null, "once");

    const { actions, move, click, unclick } = setup("battle");
    click(2);
    move(FLICK.distancePx, 0);
    move(FLICK.distancePx, 0);
    const turned = actions.lookDelta();
    unclick(2);
    const polled = actions.poll();
    assert.deepEqual(polled.pressed, []);
    assert.deepEqual(polled.flicks, []);
    assert.equal(polled.dragged, true);
    assert.deepEqual(turned, { dx: 2 * FLICK.distancePx, dy: 0 });
    const foes = [{ e: 7, pos: { x: 0, y: 0, z: 5 } }], aim = { eye: { x: 0, y: 1, z: -3 }, at: { x: 0, y: 1, z: 0 } };
    assert.equal(steerLock(7, polled, foes, aim, { x: 0, y: 0, z: 0 }), null, "the lock let go");
    assert.deepEqual(actions.poll().pressed, [], "no heavy later either");
  });

  test("a right click shorter than a tick still counts, once", () => {
    const { actions, click, unclick } = setup("battle");
    click(2);
    unclick(2);
    assert.deepEqual(actions.poll().pressed, ["heavyAttack"]);
    assert.deepEqual(actions.poll().pressed, []);
  });

  test("the overworld doesn't capture the mouse by itself; there, a right click turns an item, a right drag the camera", () => {
    const { actions, move, click, unclick, canvas } = setupWith({ autoLock: true, locked: false }, "overworld");
    assert.equal(canvas.requests.length, 0);
    click(2);
    move(DRAG.startPx + 4, 0);
    assert.deepEqual(actions.lookDelta(), { dx: DRAG.startPx + 4, dy: 0 });
    unclick(2);
    assert.deepEqual(actions.poll().pressed, []);
    click(2);
    unclick(2);
    assert.deepEqual(actions.poll().pressed, ["turnItem"]);
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
    assert.equal(canvas.requests.length, 0);
    actions.setLayers(["battle"]);
    assert.equal(canvas.requests.length, 1);
  });

  test("with Auto mouse lock off, only a click in the arena captures it", () => {
    const { actions, canvas } = setupWith({ autoLock: false, locked: false }, "overworld");
    canvas.dispatchEvent(new Event("click"));
    actions.setLayers(["battle"]);
    assert.equal(canvas.requests.length, 0);
    canvas.dispatchEvent(new Event("click"));
    assert.equal(canvas.requests.length, 1);
  });

  test("a screen over the arena lets go of the mouse", () => {
    const { actions, doc } = setup("battle");
    actions.setLayers(["battle", "settings"]);
    assert.equal(doc.exits, 1);
  });
});

describe("Actions: a camera drag captures the pointer", () => {
  const overworld = (answer?: LockAnswer) => setupWith({ autoLock: true, locked: false, answer }, "overworld");

  test("past DRAG.startPx the pointer locks, asking for raw movement; a click or a shorter drag doesn't", () => {
    for (const b of [1, 2]) {
      const { actions, move, click, unclick, canvas, mouse } = overworld();
      click(b);
      move(DRAG.startPx - 1, 0);
      unclick(b);
      actions.poll();
      assert.equal(canvas.requests.length, 0, `${b}: a click`);
      click(b);
      move(DRAG.startPx - 1, 0);
      assert.equal(canvas.requests.length, 0, `${b}: short`);
      move(1, 0);
      assert.deepEqual(canvas.requests, [{ unadjustedMovement: true }], `${b}: dragged`);
      assert.equal(mouse.locked, true);
      move(20, 0);
      assert.equal(canvas.requests.length, 1, `${b}: asked once`);
    }
  });

  test("locked, the movement turns the camera px for px as before, but the jump a browser may report as it locks", () => {
    const { actions, move, click } = overworld();
    click(2);
    move(DRAG.startPx, 0);
    assert.deepEqual(actions.lookDelta(), { dx: DRAG.startPx, dy: 0 });
    move(500, -300);
    assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 }, "the first move after the lock");
    move(3, -2);
    move(4, 1);
    assert.deepEqual(actions.lookDelta(), { dx: 7, dy: -1 });
    assert.equal(actions.poll().dragged, true);
  });

  test("letting go of the button lets go of the lock, with no item turned", () => {
    const { actions, move, click, unclick, doc, mouse } = overworld();
    click(2);
    move(DRAG.startPx, 0);
    actions.lookDelta();
    unclick(2);
    assert.equal(doc.exits, 1);
    assert.equal(mouse.locked, false);
    move(5, 5);
    assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 });
    assert.deepEqual(actions.poll().pressed, []);
  });

  test("refused, the drag turns the camera as it did, with the pointer free", async () => {
    const { actions, move, click, unclick, canvas, doc, mouse } = overworld("refuse");
    click(2);
    move(DRAG.startPx, 0);
    await settle();
    move(5, 0);
    assert.equal(mouse.locked, false);
    assert.equal(canvas.requests.length, 1, "not asked again on every move");
    assert.deepEqual(actions.lookDelta(), { dx: DRAG.startPx + 5, dy: 0 });
    unclick(2);
    assert.equal(doc.exits, 0);
    assert.deepEqual(actions.poll().pressed, []);
  });

  test("where raw movement isn't supported, the plain lock", async () => {
    const { move, click, canvas, mouse } = overworld("noRaw");
    click(2);
    move(DRAG.startPx, 0);
    await settle();
    assert.equal(canvas.requests.length, 2);
    assert.notEqual(canvas.requests[1]?.unadjustedMovement, true);
    assert.equal(mouse.locked, true);
  });

  test("Esc or leaving the tab mid-drag ends the drag, nothing fires as the button comes up, the next drag locks again", () => {
    const { actions, move, click, unclick, escape, canvas, mouse } = overworld();
    click(2);
    move(DRAG.startPx, 0);
    actions.lookDelta();
    escape();
    assert.equal(mouse.locked, false);
    move(5, 0);
    move(5, 0);
    assert.deepEqual(actions.lookDelta(), { dx: 0, dy: 0 });
    unclick(2);
    assert.deepEqual(actions.poll().pressed, []);
    click(2);
    move(DRAG.startPx, 0);
    assert.equal(canvas.requests.length, 2);
    assert.equal(mouse.locked, true);
  });

  test("a lock granted after the button came up, or a screen opened, is let go at once", () => {
    const { actions, move, click, unclick, grant, doc, mouse } = overworld("later");
    click(2);
    move(DRAG.startPx, 0);
    unclick(2);
    grant();
    assert.equal(doc.exits, 1);
    assert.equal(mouse.locked, false);
    assert.deepEqual(actions.poll().pressed, []);
    click(2);
    move(DRAG.startPx, 0);
    actions.setLayers(["overworld", "bag"]);
    grant();
    assert.equal(doc.exits, 2);
    assert.equal(mouse.locked, false);
  });

  test("in the arena, captured already, a drag neither asks for the lock nor lets go of it", () => {
    const { actions, move, click, unclick, canvas, doc } = setup("battle");
    click(2);
    move(DRAG.startPx + 1, 0);
    unclick(2);
    assert.equal(canvas.requests.length, 0);
    assert.equal(doc.exits, 0);
    assert.deepEqual(actions.poll().pressed, []);
  });

  test("a drag still held as a fight starts leaves the lock to the arena", () => {
    const { actions, move, click, unclick, canvas, doc, mouse } = overworld();
    click(2);
    move(DRAG.startPx, 0);
    actions.setLayers(["battle"]);
    unclick(2);
    assert.equal(canvas.requests.length, 1);
    assert.equal(doc.exits, 0);
    assert.equal(mouse.locked, true);
  });

  test("a right drag let go, the mouse moving on before the next poll, is still no heavy attack", () => {
    const { actions, move, click, unclick } = setup("battle");
    click(2);
    move(DRAG.startPx, 0);
    actions.poll();
    unclick(2);
    move(3, 0);
    assert.deepEqual(actions.poll().pressed, []);
  });
});

const FAR = FLICK.distancePx;

describe("Actions: the mouse aims and attacks", () => {
  test("a flick aims seven ways: the side it moves toward, the nearest of them; straight down aims nothing", () => {
    const flicks = [
      [-1, 0, "lr"], [1, 0, "rl"], [0, -1, "tb"], [-1, -1, "tlbr"], [1, -1, "trbl"], [-1, 1, "bltr"], [1, 1, "brtl"],
    ] as const;
    for (const [x, y, way] of flicks) {
      const { aim, move } = setup();
      move(x * FAR / 2, y * FAR / 2);
      move(x * FAR / 2, y * FAR / 2);
      assert.equal(aim(way === "tb" ? "lr" : "tb"), way, `${x},${y}`);
    }
    const { aim, move } = setup();
    move(0, FAR);
    assert.equal(aim("lr"), "lr");
  });

  test("no key aims: the old grid keys are free", () => {
    for (const key of ["KeyU", "KeyI", "KeyO", "KeyJ", "KeyL", "KeyM", "Comma", "Period"]) {
      const { aim, press } = setup();
      press(key);
      assert.equal(aim("lr"), "lr", key);
    }
  });

  test("a left click is a light attack, a right click a heavy one", () => {
    const { attack, click, unclick } = setup();
    click(0);
    assert.equal(attack(), "light");
    unclick(0);
    click(2);
    unclick(2);
    assert.equal(attack(), "heavy");
  });

  test("K stabs, left Shift blocks (a tap shorter than a step too)", () => {
    const { read, press, release } = setup();
    press("KeyK");
    assert.equal(read().attack, "stab");
    press("ShiftLeft");
    release("ShiftLeft");
    assert.equal(read().block, true);
    press("ShiftLeft");
    assert.equal(read().block, true, "held");
    release("ShiftLeft");
    assert.equal(read().block, false);
  });

  test("the back side button stabs (K too); the scroll wheel doesn't", () => {
    const { read, click, wheel } = setup();
    click(3);
    assert.equal(read().attack, "stab");
    wheel(WHEEL.notchPx);
    wheel(-WHEEL.notchPx, WHEEL.restMs);
    assert.equal(read().attack, null);
  });

  test("small or slow movement never flicks", () => {
    const { aims, move } = setup();
    move(FAR - 1, 0);
    for (let i = 0; i < 20; i++) move(FAR / 4, 0, i === 0 ? FLICK.windowMs : FLICK.windowMs / 3);
    assert.deepEqual(aims(), []);
  });

  test("one long sweep, however long, is one flick", () => {
    const { aims, move } = setup();
    for (let i = 0; i < 40; i++) move(FAR / 4, i % 3 === 0 ? 2 : 0, 8);
    assert.deepEqual(aims(), ["right"]);
  });

  test("turning back at once flicks the other way, with no pause needed", () => {
    const { aims, move } = setup();
    move(FAR, 0);
    move(-FAR / 2, 0);
    move(-FAR / 2, 0);
    assert.deepEqual(aims(), ["right", "left"]);
  });

  test("after a rest, a move the same way flicks again", () => {
    const { aims, move } = setup();
    move(FAR, 0);
    move(FAR, 0, FLICK.restMs + 1);
    assert.deepEqual(aims(), ["right", "right"]);
  });

  test("the sensitivity scales the distance", () => {
    const { aims, move, mouseSettings } = setup();
    mouseSettings.setFlickSensitivity(2);
    move(FAR / 2, 0);
    assert.deepEqual(aims(), ["right"]);
    mouseSettings.setFlickSensitivity(0.5);
    move(0, -FAR, FLICK.restMs + 1);
    assert.deepEqual(aims(), []);
    move(0, -FAR);
    assert.deepEqual(aims(), ["up"]);
  });

  test("a middle-button drag turns the camera and never flicks", () => {
    const { actions, aims, move, click, unclick } = setup();
    click(1);
    move(FAR, 0);
    unclick(1);
    assert.deepEqual(aims(), []);
    assert.deepEqual(actions.lookDelta(), { dx: FAR, dy: 0 });
  });

  test("only in the arena, with nothing over it", () => {
    for (const layers of [["overworld"], ["battle", "settings"], ["overworld", "bag"]] as Layer[][]) {
      const { actions, aims, move } = setup(...layers);
      move(FAR, 0);
      actions.setLayers(["battle"]);
      assert.deepEqual(aims(), [], layers.join());
    }
  });

  test("two flicks in one tick: the later; a downward one after another keeps the first", () => {
    const { aim, move } = setup();
    move(FAR, 0);
    move(-FAR, 0);
    assert.equal(aim(), "lr");
    move(FAR, 0, FLICK.restMs + 1);
    move(0, FAR);
    assert.equal(aim(), "rl");
  });

  test("a flick is in one poll only", () => {
    const { aims, move } = setup();
    move(FAR, 0);
    assert.deepEqual(aims(), ["right"]);
    assert.deepEqual(aims(), []);
  });
});

describe("Actions: the scroll wheel zooms", () => {
  test("a mouse wheel's notch is one notch of zoom: down (toward you) out, up in", () => {
    for (const layer of ["battle", "overworld"] as const) {
      const { actions, wheel } = setup(layer);
      wheel(WHEEL.notchPx);
      assert.equal(actions.poll().zoom, 1, layer);
      assert.equal(actions.poll().zoom, 0, `${layer}: once`);
      wheel(-WHEEL.notchPx, WHEEL.restMs);
      wheel(-WHEEL.notchPx);
      assert.equal(actions.poll().zoom, -2, layer);
    }
  });

  test("one event is a notch at most; a wheel counting in lines is a notch to three", () => {
    const { actions, wheel } = setup();
    wheel(5 * WHEEL.notchPx);
    assert.equal(actions.poll().zoom, 1);
    wheel(3, 16, 1);
    assert.ok(Math.abs(actions.poll().zoom - 1) < 1e-9, "three lines, straight after: a notch");
  });

  test("a trackpad's stream counts by its pixels, but the first after a rest is a whole notch (a slow wheel's)", () => {
    const { actions, wheel } = setup();
    wheel(4, WHEEL.restMs);
    assert.equal(actions.poll().zoom, 1, "a lone small event: a notch");
    for (let i = 0; i < 10; i++) wheel(10, 16);
    assert.ok(Math.abs(actions.poll().zoom - 1) < 1e-9, "a stream: its pixels' share");
  });

  test("under a screen the wheel does nothing", () => {
    const { actions, wheel } = setup("battle", "settings");
    wheel(WHEEL.notchPx);
    actions.setLayers(["battle"]);
    assert.equal(actions.poll().zoom, 0);
  });
});
