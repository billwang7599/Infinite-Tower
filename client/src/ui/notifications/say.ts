/**
 * Everything the game tells the player goes through `say`: game code says what happened, and EVENT_MESSAGES where it
 * shows and in what words. Small things are corner notices; the centre banner is only for big events.
 */
import {
  coreName, exchangeRate, formatPrice, itemDef, MAX_CHAT_CHARS, WEAPONS, type ChallengeNews, type CoinId,
  type CoreState, type EnemyDef, type ItemCounts, type ItemId, type QuestNews, type ServerMsgOf, type TradeNews, type WeaponId,
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
  | { kind: "tooWeak"; item: WeaponId }
  | { kind: "leftOnCloth"; items: ItemCounts }
  | { kind: "given"; item: ItemId; count: number; left: number }
  | { kind: "healed" }
  | { kind: "noQuest" }
  | { kind: "chatRefused"; reason: ServerMsgOf<"chatRefused">["reason"] }
  | { kind: "battleResult"; outcome: BattleOutcome }
  | { kind: "quest"; news: QuestNews }
  | { kind: "breakthrough"; core: CoreState }
  | { kind: "trade"; news: TradeNews };

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
  tooWeak:      { where: "corner", lines: ({ item }) => [tooWeakLine(item)] },
  leftOnCloth:  { where: "corner", lines: ({ items }) => [`You leave ${describeItems(items)} behind on the cloth.`] },
  given:        { where: "corner", lines: givenLines },
  healed:       { where: "corner", lines: () => ["HP and stamina are restored."] },
  noQuest:      { where: "corner", lines: () => ["There's no quest left to complete."] },
  chatRefused:  { where: "corner", lines: ({ reason }) => [CHAT_REFUSED[reason]] },
  battleResult: { where: "corner", lines: ({ outcome }) => battleResultLines(outcome) },
  quest:        { where: "corner", lines: ({ news }) => questLines(news) },
  breakthrough: { where: "corner", lines: ({ core }) => [`Your core breaks through: ${coreName(core)}.`] },
  trade:        { where: "corner", lines: ({ news }) => tradeLines(news) },
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

function tooWeakLine(item: WeaponId): string {
  const name = itemDef(item).name.toLowerCase();
  return `You aren't strong enough to wield the ${name}: it needs ${WEAPONS[item].minStrength} strength.`;
}

function givenLines({ item, count, left }: EventOf<"given">): string[] {
  const lines = count > 0 ? [`You get ${describeItems({ [item]: count })}.`] : [];
  if (left > 0) lines.push(`The bag is full: ${describeItems({ [item]: left })} didn't fit.`);
  return lines;
}

const TRADE_REFUSED: Record<Extract<TradeNews, { kind: "refused" }>["reason"], string> = {
  tooPoor: "You can't afford that.",
  noRoom: "There's no room for it in the bag or on the cloth.",
  notSold: "That isn't sold here.",
  notBought: "They don't buy that here.",
  noCoins: "You don't have the coins to change.",
};

function tradeLines(news: TradeNews): string[] {
  if (news.kind === "refused") return [TRADE_REFUSED[news.reason]];
  const onCloth = news.onCloth ? ["Not all of it fits in the bag: the rest is on the cloth."] : [];
  if (news.kind === "bought") {
    return [`You buy ${describeItems({ [news.item]: 1 })} for ${formatPrice(news.price)}.`, ...onCloth];
  }
  if (news.kind === "sold") {
    return [`You sell ${describeItems({ [news.item]: news.count })} for ${formatPrice(news.price)}.`, ...onCloth];
  }
  const { give, get } = exchangeRate(news.from, news.to) ?? { give: 0, get: 0 };
  const metal = (coin: CoinId) => itemDef(coin).name.split(" ")[0]!.toLowerCase();
  return [`You change ${give} ${metal(news.from)} for ${get} ${metal(news.to)}.`, ...onCloth];
}

function questLines(news: QuestNews): string[] {
  if (news.kind === "taken") return [`New quest: ${news.quest}. ${news.step}`];
  if (news.kind === "tally") return [`${news.quest}: ${news.have} / ${news.need}.`];
  const lines = [news.next === null ? `Quest complete: ${news.quest}.` : `${news.quest}: ${news.next}`];
  const gained = describeItems(news.gained), dropped = describeItems(news.dropped);
  if (gained) lines.push(`You get ${gained}.`);
  if (dropped) lines.push(`The bag is full: ${dropped} is left at your feet.`);
  return [...lines, ...news.lore.map((title) => `New in your questbook: ${title}.`)];
}
