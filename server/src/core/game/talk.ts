import { bagCounts, NPC_IDS, type Bag, type DialogueOffer, type NpcId, type PlacedNpc } from "@infinite-tower/shared";
import { QUESTS, type Quests } from "../content/quests.js";
import { NPCS, type Npc, type Stop, type Talk } from "../npcs/index.js";
import type { GameSession } from "./session.js";
import { holds, progressStory, stepOn, type Story } from "./story.js";

export const stopFor = (story: Story, npc: Npc, quests: Quests = QUESTS): Stop | null =>
  npc.stops.find((stop) => holds(stop.when, story, quests)) ?? null;

export function npcsOn(level: string, story: Story): PlacedNpc[] {
  return NPC_IDS.flatMap((npc) => {
    const stop = stopFor(story, NPCS[npc]);
    return stop?.level === level ? [{ npc, at: stop.at, heading: stop.heading }] : [];
  });
}

export function dialogueOf(
  npc: Npc, story: Story, bag: Bag, quests: Quests = QUESTS,
): { lines: readonly string[]; offer: DialogueOffer | null } | null {
  const talk = stopFor(story, npc, quests)?.talk.find((t) => holds(t.when, story, quests));
  return talk ? { lines: talk.lines, offer: offerOf(talk.offer, story, bag, quests) } : null;
}

function offerOf(offer: Talk["offer"], story: Story, bag: Bag, quests: Quests): DialogueOffer | null {
  if (!offer) return null;
  if ("start" in offer) {
    const quest = quests[offer.start], first = quest?.steps[0];
    if (!quest || !first || !holds({ canStart: offer.start }, story, quests)) return null;
    return { kind: "quest", quest: offer.start, title: quest.title, step: first.text };
  }
  const task = stepOn(story, offer.deliver, quests)?.task;
  if (task?.kind !== "deliver" || (bagCounts(bag)[task.item] ?? 0) < task.count) return null;
  return { kind: "deliver", quest: offer.deliver, item: task.item, count: task.count };
}

function npcInView(session: GameSession): NpcId | null {
  return session.overworld.npcInView(session.me, npcsOn(session.overworld.level.layout.id, session.story));
}

function offerInView(session: GameSession): DialogueOffer | null {
  const npc = session.inOverworld ? npcInView(session) : null;
  return npc === null ? null : dialogueOf(NPCS[npc], session.story, session.bag)?.offer ?? null;
}

export function talkTo(session: GameSession): void {
  const npc = session.inOverworld ? npcInView(session) : null;
  const said = npc === null ? null : dialogueOf(NPCS[npc], session.story, session.bag);
  if (npc === null || said === null) return;
  session.link.send({ t: "dialogue", npc, ...said });
  const talked = Object.keys(session.story.quests).filter((id) => {
    const task = stepOn(session.story, id)?.task;
    return task?.kind === "talk" && task.to === npc;
  });
  progressStory(session, talked.map((id) => ({ advance: id })));
}

export function takeQuest(session: GameSession, id: string): void {
  const offer = offerInView(session);
  if (offer?.kind === "quest" && offer.quest === id) progressStory(session, [{ start: id }]);
}

export function handOver(session: GameSession, id: string): void {
  const offer = offerInView(session);
  if (offer?.kind === "deliver" && offer.quest === id) progressStory(session, [{ advance: id }]);
}
