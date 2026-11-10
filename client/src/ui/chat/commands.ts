import {
  ENEMY_IDS, GODS, USERNAME_RULES, ITEM_IDS, ITEMS, MAX_ENCOUNTER_FOES, MAX_GIVE_COUNT, type Cheat, type EnemyId, type God, type ItemId,
} from "@infinite-tower/shared";
import { GOD_NAMES } from "../hud/blessings.js";
import {
  DAY_SPEEDS, DAY_TIMES, FOE_COUNTS, GIVE_COUNTS, whyNot, type AdminAct, type CheatPlace, type DaySpeed,
} from "../screens/admin/admin.js";

export interface CommandContext extends CheatPlace {
  invulnerable: boolean;
  keepInventory: boolean;
}

interface Option {
  value: string;
  detail?: string;
}

interface Arg {
  name: string;
  options: readonly Option[];
  optional?: boolean;
  /** Set for an open argument (any count), which then takes more than its options. */
  valid?: (word: string) => boolean;
  invalid?: string;
}

type Ran = { act: AdminAct; done: string } | { help: string[] };
export type Parsed = Ran | { error: string };

interface Command {
  name: string;
  aliases?: readonly string[];
  args: readonly Arg[];
  about: string;
  run(words: readonly string[], at: CommandContext): Ran;
}

export interface Suggestion {
  text: string;
  label: string;
  detail?: string;
}

export interface Suggestions {
  usage: string | null;
  options: readonly Suggestion[];
}

const ON_OFF: Arg = { name: "on or off", options: [{ value: "on" }, { value: "off" }], optional: true };
const ITEM: Arg = { name: "item", options: ITEM_IDS.map((id) => ({ value: id, detail: ITEMS[id].name })) };
const countArg = (name: string, options: readonly number[], max: number): Arg => ({
  name, options: options.map((n) => ({ value: String(n) })), optional: true,
  valid: (word) => /^\d+$/.test(word) && Number(word) >= 1 && Number(word) <= max,
  invalid: `${name[0]!.toUpperCase()}${name.slice(1)} must be 1 to ${max}`,
});
const COUNT = countArg("count", GIVE_COUNTS, MAX_GIVE_COUNT);
const FOES = countArg("foes", FOE_COUNTS, MAX_ENCOUNTER_FOES);
/** Open (the client doesn't know who's online), so it takes any word a username could be; the server checks it. */
const USERNAME: Arg = {
  name: "username", options: [], optional: true, valid: (word) => new RegExp(USERNAME_RULES.pattern).test(word),
};
const ENEMY: Arg = { name: "enemy", options: ENEMY_IDS.map((id) => ({ value: id })) };
const GOD: Arg = { name: "god", options: GODS.map((god) => ({ value: god })) };
const CORE_WAY: Arg = { name: "up or down", options: [{ value: "up" }, { value: "down" }] };
const DAY_TIME: Arg = { name: "time", options: DAY_TIMES.map((t) => ({ value: t.label.toLowerCase() })) };
const DAY_SPEED: Arg = { name: "speed", options: DAY_SPEEDS.map((s) => ({ value: String(s) })) };

const cheat = (c: Cheat, done: string): Ran => ({ act: { cheat: c }, done });
const onOff = (word: string | undefined, now: boolean) => word === undefined ? !now : word === "on";

export const COMMANDS: readonly Command[] = [
  {
    name: "give", args: [ITEM, COUNT, USERNAME], about: "put items in your bag, or a player's",
    run: ([item, count, to]) => {
      const id = item as ItemId, n = count ? Number(count) : 1, what = `${n} × ${ITEMS[id].name}`;
      return to
        ? cheat({ kind: "give", item: id, count: n, to }, `Giving ${what} to ${to}.`)
        : cheat({ kind: "give", item: id, count: n }, `Giving ${what}.`);
    },
  },
  {
    name: "god", aliases: ["invulnerable"], args: [ON_OFF], about: "take no damage",
    run: ([word], at) => {
      const on = onOff(word, at.invulnerable);
      return cheat({ kind: "invulnerable", on }, `Invulnerable ${on ? "on" : "off"}.`);
    },
  },
  {
    name: "keepinventory", aliases: ["keepinv"], args: [ON_OFF], about: "keep what you carry when you die",
    run: ([word], at) => {
      const on = onOff(word, at.keepInventory);
      return cheat({ kind: "keepInventory", on }, `Keep inventory ${on ? "on" : "off"}.`);
    },
  },
  { name: "heal", args: [], about: "fill HP and stamina", run: () => cheat({ kind: "heal" }, "Healing.") },
  {
    name: "kill", args: [], about: "kill the enemies you're fighting",
    run: () => cheat({ kind: "kill" }, "Killing the enemies."),
  },
  {
    name: "encounter", aliases: ["fight"], args: [ENEMY, FOES], about: "fight one or more of an enemy (overworld)",
    run: ([enemy, count]) => count
      ? cheat({ kind: "encounter", enemy: enemy as EnemyId, count: Number(count) }, `Fighting ${count} × ${enemy}.`)
      : cheat({ kind: "encounter", enemy: enemy as EnemyId }, `Fighting ${enemy}.`),
  },
  {
    name: "core", args: [CORE_WAY], about: "move your core a step",
    run: ([way]) => cheat({ kind: "coreStep", add: way === "up" }, `Core a step ${way}.`),
  },
  {
    name: "quest", args: [], about: "complete the current quest (overworld)",
    run: () => cheat({ kind: "completeQuest" }, "Completing the current quest."),
  },
  {
    name: "faith", args: [GOD], about: "gain faith with a god (overworld)",
    run: ([god]) => cheat({ kind: "faith", god: god as God }, `Faith with ${GOD_NAMES[god as God]}.`),
  },
  {
    name: "time", args: [DAY_TIME], about: "set the time of day",
    run: ([time]) => {
      const { fraction } = DAY_TIMES.find((t) => t.label.toLowerCase() === time)!;
      return { act: { dayTime: fraction }, done: `Time set to ${time}.` };
    },
  },
  {
    name: "timespeed", args: [DAY_SPEED], about: "how fast the day runs",
    run: ([speed]) => ({ act: { daySpeed: Number(speed) as DaySpeed }, done: `Day speed ${speed}×.` }),
  },
  {
    name: "resetsave", args: [], about: "start your save over (overworld)",
    run: () => cheat({ kind: "resetSave" }, "Resetting your save."),
  },
  {
    name: "help", about: "list the commands",
    args: [{ name: "command", optional: true, get options() { return COMMANDS.map((c) => ({ value: c.name })); } }],
    run: ([name]) => ({ help: COMMANDS.filter((c) => !name || c.name === name).map((c) => `${usage(c)}: ${c.about}`) }),
  },
];

function usage(command: Command): string {
  const args = command.args.map((arg) => {
    const shown = arg.valid || arg.options.length > 4 || arg.options.length === 0
      ? arg.name : arg.options.map((o) => o.value).join("|");
    return arg.optional ? `[${shown}]` : `<${shown}>`;
  });
  return [`/${command.name}`, ...args].join(" ");
}

const find = (name: string) => COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));

function words(text: string): string[] {
  return text.slice(1).trimStart().split(/\s+/);
}

export function parseCommand(text: string, at: CommandContext): Parsed {
  const [name = "", ...given] = words(text.trim().toLowerCase());
  const command = find(name);
  if (!command) return { error: `Unknown command: /${name}. Try /help.` };
  const required = command.args.filter((a) => !a.optional).length;
  if (given.length < required || given.length > command.args.length) return { error: `Usage: ${usage(command)}` };
  for (const [i, word] of given.entries()) {
    const arg = command.args[i]!;
    const ok = arg.valid ? arg.valid(word) : arg.options.some((o) => o.value === word);
    if (!ok) return { error: `${arg.invalid ?? `Unknown ${arg.name}`}: ${word}` };
  }
  const ran = command.run(given, at);
  const refused = "act" in ran && "cheat" in ran.act ? whyNot(ran.act.cheat.kind, at) : null;
  return refused ? { error: refused } : ran;
}

function ranked<T>(all: readonly T[], typed: string, keys: (t: T) => readonly string[]): T[] {
  const lower = typed.toLowerCase();
  const prefix = all.filter((t) => keys(t).some((k) => k.toLowerCase().startsWith(lower)));
  return [...prefix, ...all.filter((t) => !prefix.includes(t) && keys(t).some((k) => k.toLowerCase().includes(lower)))];
}

export function suggest(text: string): Suggestions {
  if (!text.startsWith("/")) return { usage: null, options: [] };
  const typed = words(text), last = typed.at(-1)!, before = text.slice(0, text.length - last.length);
  if (typed.length === 1) {
    const options = ranked(COMMANDS, last, (c) => [c.name, ...(c.aliases ?? [])]).map((c) => ({
      text: `${before}${c.name}${c.args.length > 0 ? " " : ""}`, label: usage(c), detail: c.about,
    }));
    return { usage: null, options };
  }
  const command = find(typed[0]!.toLowerCase());
  if (!command) return { usage: null, options: [] };
  const index = typed.length - 2, arg = command.args[index];
  const options = arg ? ranked(arg.options, last, (o) => [o.value, o.detail ?? ""]).map((o) => ({
    text: `${before}${o.value}${index + 1 < command.args.length ? " " : ""}`, label: o.value, detail: o.detail,
  })) : [];
  return { usage: usage(command), options };
}
