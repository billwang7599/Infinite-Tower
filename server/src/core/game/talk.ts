import {
  bagCounts, type Bag, type DialogueOffer, type EnemyId, type NpcId, type WorldLayout,
} from "@infinite-tower/shared";
import { QUESTS, type Quests } from "../content/quests.js";
import { SHOPS, type ShopId } from "../content/shops.js";
import { ENEMIES } from "../enemies/index.js";
import { NPCS, type Npc, type Stop, type Talk, type Trace } from "../npcs/index.js";
import type { GameSession } from "./session.js";
import { holds, progressStory, stepOn, type Story } from "./story.js";

export interface Placed {
  npcs: { npc: NpcId; stop: Stop }[];
  traces: { npc: NpcId; trace: Trace }[];
}

export const stopFor = (story: Story, npc: Npc, quests: Quests = QUESTS): Stop | null =>
  npc.stops.find((stop) => holds(stop.when, story, quests)) ?? null;

export function placedOn(story: Story, npcs: Partial<Record<NpcId, Npc>> = NPCS, quests: Quests = QUESTS): Placed {
  const placed: Placed = { npcs: [], traces: [] };
  for (const [npc, def] of Object.entries(npcs) as [NpcId, Npc][]) {
    const stop = stopFor(story, def, quests);
    if (!stop) continue;
    placed.npcs.push({ npc, stop });
    for (const left of def.stops.slice(def.stops.indexOf(stop) + 1)) {
      if (left.trace) placed.traces.push({ npc, trace: left.trace });
    }
  }
  return placed;
}

/** Kept until they next walk into another region, so an NPC who moves on mid-visit is still there to say goodbye. */
export function placeFor(session: GameSession): Pick<WorldLayout, "npcs" | "traces"> {
  session.placed = placedOn(session.story);
  return {
    npcs: session.placed.npcs.map(({ npc, stop }) => ({ npc, at: stop.at, heading: stop.heading })),
    traces: session.placed.traces.map(({ trace }) => trace.at),
  };
}

export function dialogueOf(
  talk: readonly Talk[], story: Story, bag: Bag, quests: Quests = QUESTS,
): { lines: readonly string[]; offer: DialogueOffer | null } | null {
  const said = talk.find((t) => holds(t.when, story, quests));
  return said ? { lines: said.lines, offer: offerOf(said.offer, story, bag, quests) } : null;
}

function offerOf(offer: Talk["offer"], story: Story, bag: Bag, quests: Quests): DialogueOffer | null {
  if (!offer) return null;
  if ("shop" in offer) return { kind: "shop", name: SHOPS[offer.shop].name };
  if ("train" in offer) return { kind: "train", foe: ENEMIES[offer.train].def.name };
  if ("start" in offer) {
    const quest = quests[offer.start], first = quest?.steps[0];
    if (!quest || !first || !holds({ canStart: offer.start }, story, quests)) return null;
    return { kind: "quest", quest: offer.start, title: quest.title, step: first.text };
  }
  const task = stepOn(story, offer.deliver, quests)?.task;
  if (task?.kind !== "deliver" || (bagCounts(bag)[task.item] ?? 0) < task.count) return null;
  return { kind: "deliver", quest: offer.deliver, item: task.item, count: task.count };
}

type Faced = { npc: NpcId; stop: Stop } | { npc: NpcId; trace: Trace };

function facing(session: GameSession): Faced | null {
  if (!session.inOverworld) return null;
  const { npcs, traces } = session.placed;
  const things: (Faced & { x: number; z: number })[] = [
    ...npcs.map((placed) => ({ ...placed, ...placed.stop.at })),
    ...traces.map((placed) => ({ ...placed, ...placed.trace.at })),
  ];
  return session.overworld.inView(session.me, things);
}

function rawOfferInView(session: GameSession): Talk["offer"] {
  const faced = facing(session);
  return faced && "stop" in faced ? faced.stop.talk.find((t) => holds(t.when, session.story))?.offer : undefined;
}

export function shopInView(session: GameSession): ShopId | null {
  const offer = rawOfferInView(session);
  return offer && "shop" in offer ? offer.shop : null;
}

export function trainingInView(session: GameSession): EnemyId | null {
  const offer = rawOfferInView(session);
  return offer && "train" in offer ? offer.train : null;
}

function offerInView(session: GameSession): DialogueOffer | null {
  const faced = facing(session);
  return faced && "stop" in faced ? dialogueOf(faced.stop.talk, session.story, session.bag)?.offer ?? null : null;
}

export function talkTo(session: GameSession): void {
  const faced = facing(session);
  if (faced && "trace" in faced) {
    session.link.send({ t: "dialogue", npc: faced.npc, trace: true, lines: faced.trace.lines, offer: null });
    return;
  }
  const said = faced && dialogueOf(faced.stop.talk, session.story, session.bag);
  if (!faced || !said) return;
  session.link.send({ t: "dialogue", npc: faced.npc, trace: false, ...said });
  const talked = Object.keys(session.story.quests).filter((id) => {
    const task = stepOn(session.story, id)?.task;
    return task?.kind === "talk" && task.to === faced.npc;
  });
  progressStory(session, talked.map((id) => ({ advance: id })));
}

/** Taken from the NPC its first step sends you to, that step is done there and then. */
export function takeQuest(session: GameSession, id: string): void {
  const offer = offerInView(session), faced = facing(session);
  if (offer?.kind !== "quest" || offer.quest !== id) return;
  const first = QUESTS[id]?.steps[0]?.task;
  const talked = first?.kind === "talk" && faced !== null && faced.npc === first.to;
  progressStory(session, talked ? [{ start: id }, { advance: id }] : [{ start: id }]);
}

export function handOver(session: GameSession, id: string): void {
  const offer = offerInView(session);
  if (offer?.kind === "deliver" && offer.quest === id) progressStory(session, [{ advance: id }]);
}
