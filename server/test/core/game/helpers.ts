/** Builders for the game tests: a started session with fakes around it, and the overworld's boar. */
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import {
  addItem, distXZ, WORDS, emptyBag, FIXED_DT, Health, HEADING_WAY, hpRegenPerSec, IDLE_INPUT, type Bag,
  type DialogueOffer, type EnemyId, type Entity, type Heading, type ItemCounts, type ItemId, type NpcId, type Vec2,
} from "@infinite-tower/shared";
import { OverworldPos, Pile } from "../../../src/core/overworld/components.js";
import { EncounterOnTouch } from "../../../src/core/overworld/behaviors/touch.js";
import { LORE } from "../../../src/core/content/lore.js";
import { newPlayer, PLAYER_STATS } from "../../../src/core/content/player.js";
import { QUESTS, type QuestStep } from "../../../src/core/content/quests.js";
import { Chat } from "../../../src/core/game/chat.js";
import { Duels } from "../../../src/core/game/duels.js";
import { GameSession } from "../../../src/core/game/session.js";
import type { Story, When } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import type { Account, PlayerSave } from "../../../src/core/ports.js";
import { getLevel } from "../../../src/core/world/index.js";
import { FakeLink } from "../../fixtures/fakes.js";
import { armed } from "../../fixtures/fight.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";

export const ACCOUNT: Account = { id: "player-1", username: "tester" };

export const HOLLOW = "waking-hollow";

export function startSession(opts: { dev?: boolean; saved?: Partial<PlayerSave> } = {}) {
  const link = new FakeLink();
  const saves: PlayerSave[] = [];
  const saved: PlayerSave = {
    ...newPlayer(), character: TEST_CHARACTER, level: HOLLOW, equipment: armed(), knownWords: [...WORDS], ...opts.saved,
  };
  const overworlds = new Map<string, Overworld>();
  const overworldOf = (id: string) => {
    if (!overworlds.has(id)) overworlds.set(id, new Overworld(getLevel(id)));
    return overworlds.get(id)!;
  };
  const persist = (data: PlayerSave) => saves.push(structuredClone(data));
  const online = () => [session];
  const session = new GameSession(
    ACCOUNT, link, opts.dev ?? false, saved, persist, overworldOf,
    { online, duels: new Duels(online), chat: new Chat(online) },
  );
  session.start();
  return { session, link, saves, overworldOf };
}

export const regenOver = (ticks: number, stats = PLAYER_STATS): number => hpRegenPerSec(stats) * ticks * FIXED_DT;

export const near = (actual: number, expected: number, what = ""): void =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${what} ${actual} vs ${expected}`);

export function tick(session: GameSession, times = 1): void {
  for (let i = 0; i < times; i++) {
    session.overworld.step(FIXED_DT);
    session.tick();
  }
}

/** The overworld's touch-to-fight actor (the start level's boar) and where it stands. */
export function findBoar(session: GameSession) {
  const found = session.overworld.world.first(EncounterOnTouch, OverworldPos);
  if (!found) throw new Error("no boar on the overworld");
  const [boar, , pos] = found;
  return { boar, pos };
}

export function pileAt(overworld: Overworld, at: Vec2, rangeTiles = 0): Entity | null {
  for (const [pile, , pos] of overworld.world.query(Pile, OverworldPos)) if (distXZ(pos, at) <= rangeTiles) return pile;
  return null;
}

const BACK_TO: Record<Heading, Heading> = { north: "south", south: "north", east: "west", west: "east" };

export function talkTo(session: GameSession, link: FakeLink, npc: NpcId) {
  const shown = link.last("level").level.npcs.find((placed) => placed.npc === npc);
  assert.ok(shown, `${npc} stands on this level`);
  const way = HEADING_WAY[shown.heading];
  session.overworld.place(session.me, { x: shown.at.x + way.x, z: shown.at.z + way.z });
  session.overworld.playerData(session.me).heading = BACK_TO[shown.heading];
  session.talk();
  const said = link.last("dialogue");
  assert.equal(said.npc, npc);
  return said;
}

/** Needs a dev session: the fight starts through the encounter cheat. */
export function winFight(session: GameSession, enemy: EnemyId): void {
  session.cheat({ kind: "encounter", enemy });
  const fight = session.battle!.room.fight;
  fight.world.require(fight.enemies[0]!, Health).hp = 0;
  for (let i = 0; i < 5 && !session.battle!.over; i++) {
    const step = fight.steps + 1;
    session.battleInput(step, [{ step, ...IDLE_INPUT }]);
    session.tick();
  }
  assert.ok(session.battle!.over, "won");
  session.leaveBattle();
}

export const offeredQuest = (offer: DialogueOffer | null): string | undefined =>
  offer && "quest" in offer ? offer.quest : undefined;

export function bagWith(items: ItemCounts): Bag {
  let bag = emptyBag();
  for (const [item, count] of Object.entries(items) as [ItemId, number][]) bag = addItem(bag, item, count).bag;
  return bag;
}

export interface Played { session: GameSession; link: FakeLink; saves: PlayerSave[] }

export function goTo(p: Played, level: string): void {
  if (p.session.overworld.level.layout.id === level) return;
  p.session.save();
  Object.assign(p, startSession({ dev: true, saved: { ...p.saves.at(-1)!, level } }));
}

export const levelOf = (story: Story, npc: NpcId): string => stopFor(story, NPCS[npc])!.level;

export const linesFor = (story: Story, npc: NpcId, when: When) =>
  stopFor(story, NPCS[npc])!.talk.find((t) => isDeepStrictEqual(t.when, when))?.lines;

export function doStep(p: Played, id: string, step: QuestStep): void {
  const { task } = step;
  switch (task.kind) {
    case "gather":
      p.session.bag = bagWith({ [task.item]: task.count - 1 });
      tick(p.session);
      assert.equal(p.session.story.quests[id]!.step, step.id, "one short");
      p.session.bag = bagWith({ [task.item]: task.count });
      tick(p.session);
      break;
    case "deliver":
      goTo(p, levelOf(p.session.story, task.to));
      assert.equal(talkTo(p.session, p.link, task.to).offer?.kind, "deliver");
      p.session.deliver(id);
      break;
    case "reach":
      goTo(p, task.level);
      if (task.area) {
        tick(p.session);
        assert.equal(p.session.story.quests[id]!.step, step.id, "not there yet");
        const { area } = task;
        p.session.overworld.place(p.session.me, { x: area.x + area.w / 2, z: area.z + area.h / 2 });
      }
      tick(p.session);
      break;
    case "kill":
      for (let i = 0; i < task.count; i++) winFight(p.session, task.enemy);
      break;
    case "talk": {
      goTo(p, levelOf(p.session.story, task.to));
      const lines = linesFor(p.session.story, task.to, { quest: id, step: step.id });
      assert.ok(lines, `${task.to} has lines for it`);
      assert.deepEqual(talkTo(p.session, p.link, task.to).lines, lines);
      break;
    }
  }
  const quest = QUESTS[id]!, next = quest.steps[quest.steps.indexOf(step) + 1] ?? null;
  assert.equal(p.session.story.quests[id]!.step, next?.id ?? null, `${id}: ${step.id} done`);
  assert.deepEqual(p.link.last("questbook").news.at(-1), {
    kind: "advanced", quest: quest.title, next: next?.text ?? null, gained: step.reward?.items ?? {}, dropped: {},
    lore: (step.reward?.lore ?? []).map((l) => LORE[l].title),
  });
}
