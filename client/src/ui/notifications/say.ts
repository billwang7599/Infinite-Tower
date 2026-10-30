/**
 * Everything the game tells the player goes through `say`: game code says what happened, and EVENT_MESSAGES where it
 * shows and in what words. Small things are corner notices; the centre banner is only for big events.
 */
import {
  itemDef, MAX_CHAT_CHARS, type ChallengeNews, type EnemyDef, type ItemCounts, type ItemId, type ServerMsgOf,
} from "@infinite-tower/shared";
import { battleResultLines, describeItems, type BattleOutcome } from "./battleResult.js";
import type { Notifications } from "./state.js";

export type GameEvent =
  /** A fight starting. `source` is the actor that touched you, or null for tall grass. */
  | { kind: "encounter"; source: ServerMsgOf<"encounter">["source"]; enemy: Pick<EnemyDef, "name"> }
  | { kind: "duel"; with: string }
  | { kind: "joinedFight"; host: string }
  | { kind: "joinedYou"; who: string }
  | { kind: "joinRefused"; reason: ServerMsgOf<"joinRefused">["reason"] }
  | { kind: "challenge"; news: ChallengeNews }
  | { kind: "rested" }
  | { kind: "itemUsed"; item: ItemId }
  | { kind: "leftOnCloth"; items: ItemCounts }
  | { kind: "given"; item: ItemId; count: number; left: number }
  | { kind: "healed" }
  | { kind: "chatRefused"; reason: ServerMsgOf<"chatRefused">["reason"] }
  | { kind: "battleResult"; outcome: BattleOutcome };

type EventKind = GameEvent["kind"];
type EventOf<K extends EventKind> = Extract<GameEvent, { kind: K }>;

interface EventMessage<E extends GameEvent> {
  /** The centre banner (one at a time, no ×, fades on its own), or a notice in the bottom-right corner. */
  where: "centre" | "corner";
  /** A line each; an event can say nothing. */
  lines: (event: E) => string[];
}

/** One entry per event: a new kind of event without one doesn't compile. */
export const EVENT_MESSAGES: { readonly [K in EventKind]: EventMessage<EventOf<K>> } = {
  encounter:    { where: "centre", lines: (event) => [encounterLine(event)] },
  duel:         { where: "centre", lines: (event) => [`A duel with ${event.with}!`] },
  joinedFight:  { where: "centre", lines: ({ host }) => [`You join ${host}'s fight!`] },
  joinedYou:    { where: "corner", lines: ({ who }) => [`${who} joins the fight.`] },
  joinRefused:  { where: "corner", lines: ({ reason }) => [JOIN_REFUSED[reason]] },
  challenge:    { where: "corner", lines: ({ news }) => challengeLines(news) },
  rested:       { where: "corner", lines: () => ["You rest by the fire. HP and stamina are restored."] },
  itemUsed:     { where: "corner", lines: ({ item }) => [itemUsedLine(item)] },
  leftOnCloth:  { where: "corner", lines: ({ items }) => [`You leave ${describeItems(items)} behind on the cloth.`] },
  given:        { where: "corner", lines: givenLines },
  healed:       { where: "corner", lines: () => ["HP and stamina are restored."] },
  chatRefused:  { where: "corner", lines: ({ reason }) => [CHAT_REFUSED[reason]] },
  battleResult: { where: "corner", lines: ({ outcome }) => battleResultLines(outcome) },
};

/** Tells the player about `event` in its place: each line is a notice, or the banner (a new one replaces it). */
export function say(to: Notifications, event: GameEvent): void {
  // TypeScript can't tie `event` to its own kind's entry, so the entry is read as taking any event.
  const { where, lines } = EVENT_MESSAGES[event.kind] as EventMessage<GameEvent>;
  to.said.set({ event });
  for (const line of lines(event)) {
    if (where === "centre") to.announce(line);
    else to.notify(line);
  }
}

const JOIN_REFUSED: Record<ServerMsgOf<"joinRefused">["reason"], string> = {
  nobodyNear: "Nobody close by is fighting.",
  full: "That fight is full.",
  duel: "A duel can't be joined.",
};

const CHAT_REFUSED: Record<ServerMsgOf<"chatRefused">["reason"], string> = {
  tooFast: "You're sending messages too fast. Wait a moment.",
  tooLong: `A message is ${MAX_CHAT_CHARS} characters at most.`,
};

function encounterLine({ source, enemy }: EventOf<"encounter">): string {
  return source === null ? `A ${enemy.name} leaps out of the grass!` : `The ${enemy.name} attacks!`;
}

function challengeLines(news: ChallengeNews): string[] {
  switch (news.kind) {
    case "sent": return [`You challenge ${news.to} to a duel.`];
    case "received": return [];
    case "declined": return [`${news.by} declines your challenge.`];
    case "expired": return [`The challenge with ${news.with} has expired.`];
    case "cancelled": return [`The challenge with ${news.with} is called off.`];
    case "nobodyNear": return ["Nobody is close enough to challenge."];
    case "busy": return [news.who ? `${news.who} is already in a challenge.` : "You already have a challenge open."];
  }
}

function itemUsedLine(item: ItemId): string {
  const def = itemDef(item);
  return `You ${def.consumable?.verb.toLowerCase() ?? "use"} the ${def.name.toLowerCase()}.`;
}

function givenLines({ item, count, left }: EventOf<"given">): string[] {
  const lines = count > 0 ? [`You get ${describeItems({ [item]: count })}.`] : [];
  if (left > 0) lines.push(`The bag is full: ${describeItems({ [item]: left })} didn't fit.`);
  return lines;
}
