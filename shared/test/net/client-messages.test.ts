import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_LOOK, HIDDEN_STATS, MAX_INPUTS_PER_MESSAGE, MAX_KEYS_PER_ACTION,
  OVERWORLD_CAMERA_ANGLES, SHOWN_STATS, SKILLBOOK_PAGES, STRIKES, SWING_DIRS, type StepInput,
} from "@infinite-tower/shared";
import { MAX_GIVE_COUNT, MAX_QUEST_ID_CHARS, parseClientMsg } from "@infinite-tower/shared/net/client-messages";

const parse = (msg: unknown) => parseClientMsg(JSON.stringify(msg));
const character = (name: string, look: object = DEFAULT_LOOK, gender: unknown = "boy") =>
  parse({ t: "character", character: { name, gender, look } });

/** One step's input: walking forward-right, aiming ahead, nothing pressed. */
const STEP: StepInput = {
  step: 1, moveX: 0.707, moveZ: 0.707, aimX: 0, aimZ: 1, jump: false, attack: null, dodge: false, way: null,
  block: false, cast: null, castHeld: false, chant: false, chantWords: null, write: null, locked: null,
  bag: false, gear: null, use: null,
};
const segment = (form: string, elements: string[] = [], modifiers: string[] = []) => ({ form, elements, modifiers });
const casting = (...segments: unknown[]) => ({ ...STEP, cast: { segments } });
/** A battleInput up to the last input's step (or step 1). */
const battleInput = (...inputs: unknown[]) => {
  const last = inputs.at(-1) as { step?: unknown } | undefined;
  return parse({ t: "battleInput", upTo: typeof last?.step === "number" ? last.step : 1, inputs });
};

describe("parseClientMsg", () => {
  test("accepts every kind of message", () => {
    const messages = [
      { t: "input", seq: 1, moveX: 0.5, moveZ: -1 },
      { t: "battleInput", upTo: 3, inputs: [STEP, { ...STEP, step: 2, attack: "heavy", way: "lr" }] },
      { t: "battleInput", upTo: 2, inputs: [{ ...STEP, step: 2, block: true }] },
      { t: "battleInput", upTo: 7, inputs: [] },
      { t: "battleResync" },
      { t: "leaveBattle" },
      { t: "settings", settings: { bindings: { overworld: { up: ["KeyW"] } }, camera: { sensitivity: 1.5 } } },
      { t: "settings", settings: {} },
      { t: "settings", settings: { mouse: { autoLock: false } } },
      {
        t: "battleInput", upTo: 2, inputs: [{ ...STEP, step: 2, attack: "stab", way: "tlbr", block: true }],
      },
      { t: "character", character: { name: "Kirito", gender: "boy", look: DEFAULT_LOOK } },
      { t: "rest" },
      { t: "useItem", at: { in: "bag", x: 2, y: 1 } },
      { t: "useItem", at: { in: "cloth", x: 0, y: 3 } },
      { t: "moveItem", from: { in: "bag", x: 0, y: 0 }, to: { in: "cloth", x: 3, y: 2 }, turned: true },
      { t: "moveItem", from: { in: "slot", slot: "rightHand" }, to: { in: "slot", slot: "leftHand" }, turned: false },
      { t: "moveItem", from: { in: "pile", x: 1, y: 2 }, to: { in: "bag", x: 0, y: 0 }, turned: false },
      { t: "openPile" },
      { t: "talk" },
      { t: "acceptQuest", quest: "hollis-hides" },
      { t: "deliver", quest: "hollis-hides" },
      { t: "closeBag" },
      { t: "saveSkill", page: 3, skill: { segments: [{ form: "bolt", elements: ["fire"], modifiers: ["swift"] }] } },
      { t: "cheat", cheat: { kind: "encounter", enemy: "kobold-swordsman" } },
      { t: "cheat", cheat: { kind: "invulnerable", on: true } },
      { t: "cheat", cheat: { kind: "give", item: "boar-meat", count: 5 } },
      { t: "cheat", cheat: { kind: "heal" } },
      { t: "cheat", cheat: { kind: "coreStep", add: false } },
      { t: "statPoint", stat: "specialDefense", add: true },
      { t: "ping", id: 0 },
      { t: "chat", text: "hello there" },
    ];
    for (const msg of messages) assert.deepEqual(parse(msg), msg, JSON.stringify(msg));
  });

  test("drops anything that isn't JSON, or isn't a known message", () => {
    assert.equal(parseClientMsg("{not json"), null);
    assert.equal(parse(null), null);
    assert.equal(parse({ t: "teleport", x: 0 }), null);
    assert.equal(parse({ seq: 1, moveX: 0, moveZ: 0 }), null);
  });

  test("there's no way to tell the server how a fight ended: the server decides it", () => {
    assert.equal(parse({ t: "battleEnd", won: true, vitals: { hp: 40, stamina: 12 } }), null);
  });

  test("battleInput: up to MAX_INPUTS_PER_MESSAGE changes, or none (just how far the player has got)", () => {
    assert.deepEqual(battleInput(), { t: "battleInput", upTo: 1, inputs: [] });
    const most = Array.from({ length: MAX_INPUTS_PER_MESSAGE }, (_, i) => ({ ...STEP, step: i + 1 }));
    assert.deepEqual(battleInput(...most), { t: "battleInput", upTo: MAX_INPUTS_PER_MESSAGE, inputs: most });
    assert.equal(battleInput(...most, { ...STEP, step: MAX_INPUTS_PER_MESSAGE + 1 }), null);
    assert.equal(parse({ t: "battleInput", upTo: 1, inputs: STEP }), null, "not a list");
    assert.equal(parse({ t: "battleInput", inputs: [STEP] }), null, "no upTo");
  });

  test("battleInput: steps and upTo are whole numbers from 1", () => {
    for (const step of [0, -1, 1.5, "2", null]) assert.equal(battleInput({ ...STEP, step }), null, `step ${step}`);
    for (const upTo of [0, -1, 1.5, "2", null]) {
      assert.equal(parse({ t: "battleInput", upTo, inputs: [] }), null, `upTo ${upTo}`);
    }
  });

  test("battleInput: the changes come in step order, none after upTo", () => {
    assert.equal(parse({ t: "battleInput", upTo: 5, inputs: [{ ...STEP, step: 3 }, { ...STEP, step: 3 }] }), null);
    assert.equal(parse({ t: "battleInput", upTo: 5, inputs: [{ ...STEP, step: 4 }, { ...STEP, step: 2 }] }), null);
    assert.equal(parse({ t: "battleInput", upTo: 5, inputs: [{ ...STEP, step: 6 }] }), null);
  });

  test("battleInput: a cast carries the whole skill, made of known kinds of word", () => {
    const chain = casting(segment("bolt", ["water"], ["swift"]), segment("nova", ["lightning", "fire"]));
    assert.deepEqual(battleInput(chain), { t: "battleInput", upTo: 1, inputs: [chain] });
    assert.equal(battleInput(casting()), null, "no segment");
    assert.equal(battleInput(casting(segment("summon", ["earth"]))), null, "not a Form");
    assert.equal(battleInput(casting(segment("bolt", ["plasma"]))), null, "not an element");
    assert.equal(battleInput(casting(segment("bolt", [], ["fire"]))), null, "an element in the modifiers");
    assert.ok(battleInput(casting(...Array.from({ length: 100 }, () => segment("bolt")))), "no cap on segments");
    assert.ok(battleInput(casting(segment("bolt", [], Array.from({ length: 100 }, () => "split")))), "nor modifiers");
  });

  test("battleInput: every field is there, with the right type", () => {
    for (const key of Object.keys(STEP)) {
      const { [key]: _, ...missing } = STEP as unknown as Record<string, unknown>;
      assert.equal(battleInput(missing), null, `without ${key}`);
    }
    assert.equal(battleInput({ ...STEP, attack: "yes" }), null);
    assert.equal(battleInput({ ...STEP, attack: true }), null, "the old single attack");
    assert.equal(battleInput({ ...STEP, dodge: 1 }), null);
    assert.equal(battleInput({ ...STEP, moveX: "1" }), null);
    assert.equal(battleInput({ ...STEP, aimZ: null }), null);
  });

  test("battleInput: the attack is light, heavy, a stab or none; the aim a swing", () => {
    for (const attack of [...STRIKES, null]) {
      assert.deepEqual(battleInput({ ...STEP, attack }), { t: "battleInput", upTo: 1, inputs: [{ ...STEP, attack }] });
    }
    for (const way of [...SWING_DIRS, null]) {
      assert.deepEqual(battleInput({ ...STEP, way }), { t: "battleInput", upTo: 1, inputs: [{ ...STEP, way }] });
    }
    assert.equal(battleInput({ ...STEP, attack: "lr" }), null, "a swing is aimed, not an attack");
    assert.equal(battleInput({ ...STEP, way: "stab" }), null, "the stab is an attack, not an aim");
    assert.equal(battleInput({ ...STEP, way: "bt" }), null, "no straight upward swing");
    assert.equal(battleInput({ ...STEP, block: "yes" }), null);
  });

  test("battleInput: the bag is open or not, and a gear move goes between two spots", () => {
    const gear = { from: { in: "slot", slot: "rightHand" }, to: { in: "bag", x: 2, y: 1 }, turned: true };
    const moving = { ...STEP, bag: true, gear };
    assert.deepEqual(battleInput(moving), { t: "battleInput", upTo: 1, inputs: [moving] });
    assert.equal(battleInput({ ...STEP, bag: "open" }), null);
    assert.equal(battleInput({ ...STEP, gear: { ...gear, turned: undefined } }), null, "no turned");
    assert.equal(battleInput({ ...STEP, gear: { ...gear, to: { in: "bag", x: -1, y: 0 } } }), null);
    assert.equal(battleInput({ ...STEP, gear: { ...gear, from: { in: "slot", slot: "tail" } } }), null);
  });

  test("battleInput: using what's in a cell of the bag or the cloth, not a pile's or a slot", () => {
    const using = { ...STEP, bag: true, use: { in: "bag", x: 2, y: 1 } };
    assert.deepEqual(battleInput(using), { t: "battleInput", upTo: 1, inputs: [using] });
    assert.notEqual(battleInput({ ...STEP, use: { in: "cloth", x: 0, y: 0 } }), null);
    assert.equal(battleInput({ ...STEP, use: { in: "pile", x: 0, y: 0 } }), null);
    assert.equal(battleInput({ ...STEP, use: { in: "slot", slot: "rightHand" } }), null);
    assert.equal(battleInput({ ...STEP, use: { in: "bag", x: -1, y: 0 } }), null);
    assert.equal(battleInput({ ...STEP, use: undefined }), null, "no use");
  });

  test("battleInput: the locked enemy is a whole index, or none", () => {
    const locked = { ...STEP, locked: 2 };
    assert.deepEqual(battleInput(locked), { t: "battleInput", upTo: 1, inputs: [locked] });
    assert.equal(battleInput({ ...STEP, locked: -1 }), null);
    assert.equal(battleInput({ ...STEP, locked: 0.5 }), null);
  });

  test("battleInput: the aim is a direction (length 1), the move no longer than the keys can make", () => {
    assert.equal(battleInput({ ...STEP, aimX: 0, aimZ: 0 }), null, "no direction");
    assert.equal(battleInput({ ...STEP, aimX: 1, aimZ: 1 }), null, "longer than 1: a wider slash");
    assert.equal(battleInput({ ...STEP, aimX: 0.5, aimZ: 0 }), null);
    assert.equal(battleInput({ ...STEP, moveX: 2, moveZ: 0 }), null, "faster than walking");
    assert.equal(battleInput({ ...STEP, moveX: 1.2, moveZ: 1.2 }), null);
    // Two walk keys at once, turned by the camera: up to √2, rounded to 3 decimals.
    const diagonal = { ...STEP, moveX: 1.414, moveZ: 0 };
    assert.deepEqual(battleInput(diagonal), { t: "battleInput", upTo: 1, inputs: [diagonal] });
  });

  test("input: seq is a whole number, not negative", () => {
    assert.equal(parse({ t: "input", seq: -1, moveX: 0, moveZ: 0 }), null);
    assert.equal(parse({ t: "input", seq: 1.5, moveX: 0, moveZ: 0 }), null);
    assert.equal(parse({ t: "input", seq: 1, moveX: "1", moveZ: 0 }), null);
  });

  test("character: the name follows the rules and is trimmed", () => {
    assert.deepEqual(
      character("  Asuna  ", DEFAULT_LOOK, "girl"),
      { t: "character", character: { name: "Asuna", gender: "girl", look: DEFAULT_LOOK } },
    );
    assert.equal(character("A"), null, "too short");
    assert.equal(character("A".repeat(17)), null, "too long");
    assert.equal(character("<script>"), null, "characters outside the rules");
  });

  test("character: every look part must be one of the options", () => {
    assert.equal(character("Asuna", { ...DEFAULT_LOOK, hairColor: "rainbow" }), null);
    const { mouth: _, ...noMouth } = DEFAULT_LOOK;
    assert.equal(character("Asuna", noMouth), null, "a part missing");
    assert.equal(character("Asuna", { cloak: "red", skin: "light", legs: "navy" }), null, "the old look");
  });

  test("character: gender is boy or girl, and required", () => {
    assert.equal(character("Asuna", DEFAULT_LOOK, "other"), null);
    assert.equal(parse({ t: "character", character: { name: "Asuna", look: DEFAULT_LOOK } }), null, "no gender");
  });

  test("settings: limits on bindings", () => {
    const keys = Array.from({ length: MAX_KEYS_PER_ACTION + 1 }, (_, i) => `Key${i}`);
    assert.equal(parse({ t: "settings", settings: { bindings: { overworld: { up: keys } } } }), null);
    assert.equal(parse({ t: "settings", settings: { bindings: { overworld: { up: ["K".repeat(33)] } } } }), null);
  });

  test("settings: the mouse auto lock is kept as saved, may be left out (on), and must be true or false", () => {
    const settings = (saved: object) => parse({ t: "settings", settings: saved });
    for (const autoLock of [false, true]) {
      const saved = { camera: { sensitivity: 2 }, mouse: { autoLock } };
      assert.deepEqual(settings(saved), { t: "settings", settings: saved });
    }
    // Saved before the setting existed: still valid, and the client reads the missing field as on.
    assert.deepEqual(settings({ mouse: {} }), { t: "settings", settings: { mouse: {} } });
    for (const autoLock of ["false", 0, null]) assert.equal(settings({ mouse: { autoLock } }), null);
  });

  test("settings: the flick sensitivity is kept as saved, and must be a number", () => {
    const settings = (mouse: object) => parse({ t: "settings", settings: { mouse } });
    const mouse = { autoLock: true, flickSensitivity: 1.5 };
    assert.deepEqual(settings(mouse), { t: "settings", settings: { mouse } });
    for (const flickSensitivity of ["1", null]) assert.equal(settings({ flickSensitivity }), null);
  });

  test("settings: the overworld camera's turns are kept as saved, a whole number of quarter turns", () => {
    const settings = (camera: object) => parse({ t: "settings", settings: { camera } });
    for (const overworldTurns of [0, OVERWORLD_CAMERA_ANGLES - 1]) {
      const camera = { sensitivity: 1, overworldTurns };
      assert.deepEqual(settings(camera), { t: "settings", settings: { camera } });
    }
    for (const overworldTurns of [-1, OVERWORLD_CAMERA_ANGLES, 1.5, "1", null]) {
      assert.equal(settings({ overworldTurns }), null, `turns ${overworldTurns}`);
    }
  });

  test("settings: show ping may be left out (on), and must be true or false", () => {
    const settings = (hud: object) => parse({ t: "settings", settings: { hud } });
    for (const hud of [{ showPing: false }, {}]) assert.deepEqual(settings(hud), { t: "settings", settings: { hud } });
    for (const showPing of ["true", 1, null]) assert.equal(settings({ showPing }), null);
  });

  test("settings: the volumes may be left out, and each is a number from 0 to 1", () => {
    const settings = (audio: object) => parse({ t: "settings", settings: { audio } });
    for (const audio of [{}, { master: 0 }, { master: 1, effects: 0.5, ambient: 0.25, music: 0.75 }]) {
      assert.deepEqual(settings(audio), { t: "settings", settings: { audio } });
    }
    for (const master of ["1", null, -0.1, 1.5]) assert.equal(settings({ master }), null, JSON.stringify(master));
    for (const music of ["1", null, -0.1, 1.5]) assert.equal(settings({ music }), null, JSON.stringify(music));
  });

  test("chat: only the text, trimmed; nothing but spaces is dropped", () => {
    assert.deepEqual(parse({ t: "chat", text: "  hi all " }), { t: "chat", text: "hi all" });
    for (const text of ["", "   ", 5, null]) assert.equal(parse({ t: "chat", text }), null, JSON.stringify(text));
    assert.equal(parse({ t: "chat" }), null);
    assert.deepEqual(parse({ t: "chat", text: "hi", from: "Admin" }), { t: "chat", text: "hi" }, "no name of its own");
  });

  test("acceptQuest and deliver: a quest's id, a short string (the server checks it's a quest)", () => {
    for (const t of ["acceptQuest", "deliver"]) {
      assert.equal(parse({ t }), null, t);
      assert.equal(parse({ t, quest: "" }), null, t);
      assert.equal(parse({ t, quest: 3 }), null, t);
      assert.equal(parse({ t, quest: "x".repeat(MAX_QUEST_ID_CHARS + 1) }), null, t);
      assert.ok(parse({ t, quest: "x".repeat(MAX_QUEST_ID_CHARS) }), t);
    }
  });

  test("ping: its id is a whole number from 0", () => {
    for (const id of [-1, 1.5, "3", null, undefined, Number.MAX_SAFE_INTEGER + 2]) {
      assert.equal(parse({ t: "ping", id }), null, `id ${id}`);
    }
  });

  test("useItem and moveItem: cells are whole, non-negative numbers in the bag or the cloth, slots are named", () => {
    const bag = (x: unknown, y: unknown) => ({ in: "bag", x, y });
    assert.equal(parse({ t: "useItem", item: "boar-meat" }), null);
    assert.equal(parse({ t: "useItem", at: bag(-1, 0) }), null);
    assert.equal(parse({ t: "useItem", at: bag(0.5, 0) }), null);
    assert.equal(parse({ t: "useItem", at: { x: 0, y: 0 } }), null);
    assert.equal(parse({ t: "useItem", at: { in: "slot", slot: "rightHand" } }), null);
    assert.equal(parse({ t: "moveItem", from: bag(0, 0), to: bag(1, "1"), turned: false }), null);
    assert.equal(parse({ t: "moveItem", from: bag(0, 0), to: bag(1, 1) }), null);
    assert.equal(parse({ t: "moveItem", from: bag(0, 0), to: { in: "stash", x: 1, y: 1 }, turned: false }), null);
    assert.equal(parse({ t: "moveItem", from: bag(0, 0), to: { in: "slot", slot: "tail" }, turned: false }), null);
  });

  test("nothing is eaten straight from a pile: it's taken into the bag first", () => {
    assert.equal(parse({ t: "useItem", at: { in: "pile", x: 0, y: 0 } }), null);
  });

  test("saveSkill: a page of the book, and a whole skill", () => {
    const save = (page: unknown, segments: unknown[] = [segment("nova", ["fire"])]) =>
      parse({ t: "saveSkill", page, skill: { segments } });
    assert.notEqual(save(0), null);
    assert.notEqual(save(SKILLBOOK_PAGES - 1), null);
    assert.equal(save(SKILLBOOK_PAGES), null);
    assert.equal(save(-1), null);
    assert.equal(save(1.5), null);
    assert.equal(save(0, []), null, "no segment");
    assert.equal(save(0, [segment("summon")]), null, "not a Form");
  });

  test("battleInput: a page written in a fight is a page of the book, and a whole skill", () => {
    const write = (page: unknown, segments: unknown[] = [segment("nova", ["fire"])]) =>
      battleInput({ ...STEP, chant: true, write: { page, skill: { segments } } });
    assert.notEqual(write(SKILLBOOK_PAGES - 1), null);
    assert.equal(write(SKILLBOOK_PAGES), null);
    assert.equal(write(0, []), null, "no segment");
    assert.equal(battleInput({ ...STEP, chant: "yes" }), null);
  });

  test("cheat: only known cheats, enemies and items, and a sane count", () => {
    const cheat = (c: unknown) => parse({ t: "cheat", cheat: c });
    assert.equal(cheat({ kind: "godmode" }), null);
    assert.equal(cheat({ kind: "encounter", enemy: "dragon" }), null);
    assert.equal(cheat({ kind: "encounter" }), null);
    assert.equal(cheat({ kind: "invulnerable", on: "yes" }), null);
    assert.equal(cheat({ kind: "give", item: "gold", count: 1 }), null);
    assert.equal(cheat({ kind: "give", item: "boar-meat", count: 0 }), null);
    assert.equal(cheat({ kind: "give", item: "boar-meat", count: 1.5 }), null);
    assert.equal(cheat({ kind: "give", item: "boar-meat", count: MAX_GIVE_COUNT + 1 }), null);
    assert.notEqual(cheat({ kind: "give", item: "boar-meat", count: MAX_GIVE_COUNT }), null);
    assert.equal(cheat({ kind: "coreStep" }), null);
  });

  test("statPoint: a shown stat only, placed or taken back", () => {
    const point = (stat: unknown, add: unknown) => parse({ t: "statPoint", stat, add });
    for (const stat of SHOWN_STATS) assert.notEqual(point(stat, true), null, stat);
    for (const stat of HIDDEN_STATS) assert.equal(point(stat, true), null, stat);
    assert.equal(point("luck", true), null);
    assert.equal(point("strength", 1), null);
  });
});
