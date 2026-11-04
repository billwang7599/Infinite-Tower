import {
  addFaith, inRect, stow, stowedCounts, unstow, type EnemyId, type Faith, type God, type ItemCounts,
  type ItemId, type QuestNews, type QuestView, type Stowed, type Tally, type Vec2,
} from "@infinite-tower/shared";
import { LORE } from "../content/lore.js";
import { QUESTS, type Quests, type QuestStep, type Task } from "../content/quests.js";
import type { GameSession } from "./session.js";

export interface Story {
  /** Each quest taken: the step it's on (null once done) and the kills counted toward a kill step. */
  quests: Record<string, { step: string | null; kills: number }>;
  flags: string[];
}

export const newStory = (): Story => ({ quests: {}, flags: [] });

export type When = { flag: string } | { quest: string; step: string } | { done: string } | { canStart: string };

export function holds(when: When | undefined, story: Story, quests: Quests = QUESTS): boolean {
  if (when === undefined) return true;
  if ("flag" in when) return story.flags.includes(when.flag);
  if ("quest" in when) return story.quests[when.quest]?.step === when.step;
  if ("done" in when) return story.quests[when.done]?.step === null;
  const quest = quests[when.canStart];
  return quest !== undefined && !story.quests[when.canStart] && holds(quest.when, story, quests);
}

export type Effect = { start: string } | { advance: string } | { finish: string };

export interface Seen {
  region: string;
  at: Vec2;
  killed?: readonly EnemyId[];
}

interface Unfolding extends Stowed {
  story: Story;
  dropped: ItemCounts;
  news: QuestNews[];
  faith: Faith;
}

export const stepOn = (story: Story, id: string, quests: Quests = QUESTS): QuestStep | undefined => {
  const on = story.quests[id]?.step;
  return quests[id]?.steps.find((s) => s.id === on);
};

const withStep = (story: Story, id: string, step: string | null, kills = 0): Story =>
  ({ ...story, quests: { ...story.quests, [id]: { step, kills } } });

export function unfold(
  from: Stowed & { story: Story }, effects: readonly Effect[], seen: Seen, quests: Quests = QUESTS,
): Unfolding {
  const out: Unfolding = { ...from, dropped: {}, news: [], faith: {} };
  for (const effect of effects) {
    if ("start" in effect) start(out, effect.start, quests);
    else if ("advance" in effect) advance(out, effect.advance, quests);
    else while (advance(out, effect.finish, quests, true));
  }
  for (const id of Object.keys(out.story.quests)) meetSteps(out, id, seen, quests);
  return out;
}

function start(out: Unfolding, id: string, quests: Quests): void {
  const quest = quests[id], first = quest?.steps[0];
  if (!quest || !first || !holds({ canStart: id }, out.story, quests)) return;
  out.story = withStep(out.story, id, first.id);
  out.news.push({ kind: "taken", quest: quest.title, step: first.text });
}

function advance(out: Unfolding, id: string, quests: Quests, forced = false): boolean {
  const quest = quests[id], step = stepOn(out.story, id, quests);
  if (!quest || !step) return false;
  const { task } = step;
  if (task.kind === "deliver") {
    const taken = unstow(out, task.item, task.count);
    if (!taken && !forced) return false;
    if (taken) Object.assign(out, { bag: taken.bag, pack: taken.pack, quiver: taken.quiver });
  }
  const next = quest.steps[quest.steps.indexOf(step) + 1] ?? null;
  out.story = withStep(out.story, id, next?.id ?? null);
  const { items = {}, flags = [], lore = [], faith = {} } = step.reward ?? {};
  for (const [god, amount] of Object.entries(faith) as [God, number][]) out.faith = addFaith(out.faith, god, amount);
  const gained: ItemCounts = {}, dropped: ItemCounts = {};
  for (const [item, count] of Object.entries(items) as [ItemId, number][]) {
    const packed = stow(out, item, count);
    Object.assign(out, { bag: packed.gear.bag, pack: packed.gear.pack, quiver: packed.gear.quiver });
    if (packed.left < count) gained[item] = count - packed.left;
    if (packed.left > 0) {
      dropped[item] = packed.left;
      out.dropped[item] = (out.dropped[item] ?? 0) + packed.left;
    }
  }
  const allFlags = [...new Set([...out.story.flags, ...flags])];
  if (allFlags.length > out.story.flags.length) out.story = { ...out.story, flags: allFlags };
  out.news.push({
    kind: "advanced", quest: quest.title, next: next?.text ?? null, gained, dropped,
    lore: lore.map((l) => LORE[l].title),
  });
  return true;
}

/** A fight's kills count only toward the step it began on. */
function meetSteps(out: Unfolding, id: string, seen: Seen, quests: Quests): void {
  let killed = seen.killed ?? [];
  for (;;) {
    const taken = out.story.quests[id]!, task = stepOn(out.story, id, quests)?.task;
    if (!task) return;
    const kills = task.kind === "kill" ? taken.kills + killed.filter((e) => e === task.enemy).length : 0;
    if (!met(task, out, seen, kills)) {
      if (task.kind === "kill" && kills > taken.kills) {
        out.story = withStep(out.story, id, taken.step, kills);
        out.news.push({ kind: "tally", quest: quests[id]!.title, have: kills, need: task.count });
      }
      return;
    }
    if (!advance(out, id, quests)) return;
    killed = [];
  }
}

function met(task: Task, stowed: Stowed, seen: Seen, kills: number): boolean {
  switch (task.kind) {
    case "gather": return (stowedCounts(stowed)[task.item] ?? 0) >= task.count;
    case "reach": return seen.region === task.region && (!task.area || inRect(task.area, seen.at.x, seen.at.z));
    case "kill": return kills >= task.count;
    case "deliver": case "talk": return false;
  }
}

function tallyOf(task: Task, kills: number): Tally | null {
  if (task.kind === "gather" || task.kind === "deliver") return { item: task.item, need: task.count };
  return task.kind === "kill" ? { kills, need: task.count } : null;
}

export function questbookOf(story: Story, quests: Quests = QUESTS): QuestView[] {
  const views = Object.entries(quests).flatMap(([id, quest]): QuestView[] => {
    const taken = story.quests[id];
    if (!taken) return [];
    const step = stepOn(story, id, quests), doneSteps = step ? quest.steps.indexOf(step) : quest.steps.length;
    return [{
      id, title: quest.title, half: quest.half,
      step: step ? { text: step.text, hint: step.hint, tally: tallyOf(step.task, taken.kills) } : null,
      lore: quest.steps.slice(0, doneSteps).flatMap((s) => s.reward?.lore ?? []).map((l) => LORE[l]),
    }];
  });
  return [...views.filter((v) => v.step !== null), ...views.filter((v) => v.step === null)];
}

export function keptStory(saved: Story, quests: Quests = QUESTS): Story {
  const kept = Object.entries(saved.quests).filter(([id, { step }]) =>
    step === null ? quests[id] !== undefined : stepOn(saved, id, quests) !== undefined);
  return { quests: Object.fromEntries(kept), flags: saved.flags };
}

export function progressStory(
  session: GameSession, effects: readonly Effect[] = [], killed: readonly EnemyId[] = [],
): void {
  const { overworld, me } = session, at = overworld.playerPos(me), was = session.gear;
  const { story, bag, pack, quiver, dropped, news, faith } = unfold(
    { story: session.story, bag: was.bag, pack: was.pack, quiver: was.quiver }, effects,
    { region: session.region, at, killed },
  );
  if (news.length === 0) return;
  session.story = story;
  if (Object.keys(dropped).length > 0) overworld.dropPile(at, dropped);
  if (bag !== was.bag || pack !== was.pack || quiver !== was.quiver) {
    session.gear = { ...session.gear, bag, pack, quiver };
    session.link.send({ t: "gear", gear: session.gear });
  }
  if (Object.keys(faith).length > 0) session.gainFaith(faith);
  session.save();
  session.link.send({ t: "questbook", quests: questbookOf(story), news });
}
