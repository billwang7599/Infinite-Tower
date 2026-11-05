import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ENEMY_IDS, GODS, ITEM_IDS, ITEMS, MAX_GIVE_COUNT } from "@infinite-tower/shared";
import { COMMANDS, parseCommand, suggest, type CommandContext } from "../../../src/ui/chat/commands.js";
import { DAY_SPEEDS, DAY_TIMES } from "../../../src/ui/screens/admin/admin.js";

const OVERWORLD: CommandContext = {
  mode: "overworld", againstEnemies: false, invulnerable: false, keepInventory: true,
};
const FIGHTING: CommandContext = { ...OVERWORLD, mode: "battle", againstEnemies: true };
const ITEM = ITEM_IDS[0]!;

const actOf = (text: string, at = OVERWORLD) => {
  const parsed = parseCommand(text, at);
  assert.ok("act" in parsed, `${text}: ${JSON.stringify(parsed)}`);
  return parsed.act;
};
const errorOf = (text: string, at = OVERWORLD) => {
  const parsed = parseCommand(text, at);
  assert.ok("error" in parsed, `${text}: ${JSON.stringify(parsed)}`);
  return parsed.error;
};
const labels = (text: string) => suggest(text).options.map((o) => o.label);

describe("commands: what each runs", () => {
  test("/give <item> [count] gives the item, one unless counted, as the panel's give does", () => {
    assert.deepEqual(actOf(`/give ${ITEM} 5`), { cheat: { kind: "give", item: ITEM, count: 5 } });
    assert.deepEqual(actOf(`/give ${ITEM}`), { cheat: { kind: "give", item: ITEM, count: 1 } });
    assert.deepEqual(actOf(`/GIVE ${ITEM.toUpperCase()}  ${MAX_GIVE_COUNT}`),
      { cheat: { kind: "give", item: ITEM, count: MAX_GIVE_COUNT } });
  });

  test("a bad /give says what's wrong", () => {
    assert.equal(errorOf("/give foo"), "Unknown item: foo");
    assert.match(errorOf(`/give ${ITEM} 0`), /^Count must be 1 to 100: 0$/);
    assert.match(errorOf(`/give ${ITEM} ${MAX_GIVE_COUNT + 1}`), /Count must be/);
    assert.match(errorOf(`/give ${ITEM} lots`), /Count must be/);
    assert.equal(errorOf("/give"), "Usage: /give <item> [count]");
    assert.equal(errorOf(`/give ${ITEM} 1 2`), "Usage: /give <item> [count]");
  });

  test("an unknown command is refused", () => {
    assert.equal(errorOf("/fly"), "Unknown command: /fly. Try /help.");
    assert.equal(errorOf("/"), "Unknown command: /. Try /help.");
  });

  test("/god and /keepinventory set the toggle, or flip it with no word", () => {
    assert.deepEqual(actOf("/god on"), { cheat: { kind: "invulnerable", on: true } });
    assert.deepEqual(actOf("/god"), { cheat: { kind: "invulnerable", on: true } });
    assert.deepEqual(actOf("/god", { ...OVERWORLD, invulnerable: true }),
      { cheat: { kind: "invulnerable", on: false } });
    assert.deepEqual(actOf("/invulnerable off"), { cheat: { kind: "invulnerable", on: false } });
    assert.deepEqual(actOf("/keepinventory"), { cheat: { kind: "keepInventory", on: false } });
    assert.deepEqual(actOf("/keepinventory on"), { cheat: { kind: "keepInventory", on: true } });
    assert.equal(errorOf("/god maybe"), "Unknown on or off: maybe");
  });

  test("the rest map onto the panel's cheats and day clock", () => {
    assert.deepEqual(actOf("/heal"), { cheat: { kind: "heal" } });
    assert.deepEqual(actOf("/kill", FIGHTING), { cheat: { kind: "kill" } });
    assert.deepEqual(actOf("/core up"), { cheat: { kind: "coreStep", add: true } });
    assert.deepEqual(actOf("/core down"), { cheat: { kind: "coreStep", add: false } });
    assert.deepEqual(actOf("/quest"), { cheat: { kind: "completeQuest" } });
    assert.deepEqual(actOf("/resetsave"), { cheat: { kind: "resetSave" } });
    assert.deepEqual(actOf(`/faith ${GODS[1]}`), { cheat: { kind: "faith", god: GODS[1] } });
    assert.deepEqual(actOf(`/encounter ${ENEMY_IDS[1]}`), { cheat: { kind: "encounter", enemy: ENEMY_IDS[1] } });
    assert.deepEqual(actOf(`/fight ${ENEMY_IDS[0]}`), { cheat: { kind: "encounter", enemy: ENEMY_IDS[0] } });
    for (const { label, fraction } of DAY_TIMES) {
      assert.deepEqual(actOf(`/time ${label.toLowerCase()}`), { dayTime: fraction });
    }
    for (const speed of DAY_SPEEDS) assert.deepEqual(actOf(`/timespeed ${speed}`), { daySpeed: speed });
    assert.match(errorOf("/timespeed 7"), /Unknown speed: 7/);
  });

  test("what works only in the overworld, or only against enemies, is refused elsewhere", () => {
    for (const text of ["/quest", "/resetsave", `/faith ${GODS[0]}`, `/encounter ${ENEMY_IDS[0]}`]) {
      assert.equal(errorOf(text, FIGHTING), "Only in the overworld.", text);
    }
    assert.equal(errorOf("/kill"), "No enemy to kill here.");
    assert.equal(errorOf("/kill", { ...FIGHTING, againstEnemies: false }), "No enemy to kill here.");
    assert.deepEqual(actOf("/heal", FIGHTING), { cheat: { kind: "heal" } });
  });

  test("/help lists every command's usage; /help <command> just that one", () => {
    const all = parseCommand("/help", OVERWORLD);
    assert.ok("help" in all);
    assert.equal(all.help.length, COMMANDS.length);
    for (const name of ["/give <item> [count]", "/god [on|off]", "/time <dawn|noon|dusk|midnight>"]) {
      assert.ok(all.help.some((line) => line.startsWith(name)), name);
    }
    const one = parseCommand("/help give", OVERWORLD);
    assert.ok("help" in one);
    assert.equal(one.help.length, 1);
    assert.match(one.help[0]!, /^\/give <item> \[count\]/);
    assert.equal(errorOf("/help fly"), "Unknown command: fly");
  });

  test("a successful command says what it did", () => {
    const parsed = parseCommand(`/give ${ITEM} 3`, OVERWORLD);
    assert.ok("done" in parsed);
    assert.match(parsed.done, new RegExp(ITEMS[ITEM].name));
  });
});

describe("commands: suggestions as you type", () => {
  test("/ alone lists every command; each letter narrows it, prefix matches before the rest", () => {
    assert.equal(labels("/").length, COMMANDS.length);
    const t = labels("/t");
    assert.deepEqual(t.slice(0, 2).map((l) => l.split(" ")[0]), ["/time", "/timespeed"]);
    assert.ok(t.length > 2 && t.length < COMMANDS.length, t.join());
    assert.ok(t.slice(2).every((l) => !l.startsWith("/t") && l.split(" ")[0]!.includes("t")), t.join());
    assert.deepEqual(labels("/timesp").map((l) => l.split(" ")[0]), ["/timespeed"]);
    assert.deepEqual(labels("/zzz"), []);
  });

  test("an alias finds its command", () => {
    assert.deepEqual(labels("/invul").map((l) => l.split(" ")[0]), ["/god"]);
  });

  test("taking a command fills it in with a space after when it has arguments", () => {
    const give = suggest("/gi").options[0]!;
    assert.equal(give.text, "/give ");
    const heal = suggest("/hea").options[0]!;
    assert.equal(heal.text, "/heal");
  });

  test("after the command, its argument's options filter as the word is typed, with the usage as a hint", () => {
    assert.equal(suggest("/give ").usage, "/give <item> [count]");
    assert.equal(labels("/give ").length, ITEM_IDS.length);
    const boar = labels("/give boar");
    assert.ok(boar.length > 0 && boar.every((id) => id.startsWith("boar")), boar.join());
    const meat = labels("/give meat");
    assert.ok(meat.includes("boar-meat"), meat.join());
    assert.deepEqual(labels("/give boar-me"), ["boar-meat"]);
    assert.equal(suggest("/give boar-me").options[0]!.text, "/give boar-meat ");
    assert.equal(suggest("/give boar-me").options[0]!.detail, ITEMS["boar-meat"].name);
  });

  test("prefix matches come before matches inside the word", () => {
    const ids = labels("/encounter bo");
    assert.equal(ids[0], "bog-lurker");
    assert.ok(ids.indexOf("bog-lurker") < ids.indexOf("wild-boar"), ids.join());
  });

  test("each argument offers its own options", () => {
    assert.deepEqual(labels("/god "), ["on", "off"]);
    assert.deepEqual(labels("/core "), ["up", "down"]);
    assert.deepEqual(labels("/time "), DAY_TIMES.map((t) => t.label.toLowerCase()));
    assert.deepEqual(labels("/timespeed "), DAY_SPEEDS.map(String));
    assert.deepEqual(labels("/faith "), [...GODS]);
    assert.equal(labels("/encounter k").every((id) => id.includes("k")), true);
    assert.equal(suggest(`/give ${ITEM} `).usage, "/give <item> [count]");
    assert.equal(suggest("/heal ").options.length, 0);
  });

  test("nothing for chat, an unknown command or past the last argument", () => {
    assert.deepEqual(suggest("hello"), { usage: null, options: [] });
    assert.deepEqual(suggest("/fly "), { usage: null, options: [] });
    assert.deepEqual(suggest("/god on ").options, []);
  });
});
