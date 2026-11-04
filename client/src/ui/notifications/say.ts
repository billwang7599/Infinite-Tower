import {
  coreName, exchangeRate, formatPrice, itemDef, MAX_CHAT_CHARS, sigilOf, WEAPONS, type BlessingGod,
  type ChallengeNews, type CoinId, type CoreState, type Faith, type God, type ItemCounts, type ItemId,
  type QuestNews, type ServerMsgOf, type TradeNews, type WeaponId,
} from "@infinite-tower/shared";
import { BLESSING_TEXT, GOD_NAMES } from "../hud/blessings.js";
import { battleResultLines, describeItems, type BattleOutcome } from "./battleResult.js";
import type { Notifications } from "./state.js";

export type GameEvent =
  | { kind: "fightStarted" }
  | { kind: "joinedYou"; who: string }
  | { kind: "joinRefused"; reason: ServerMsgOf<"joinRefused">["reason"] }
  | { kind: "challenge"; news: ChallengeNews }
  | { kind: "rested" }
  | { kind: "padBound"; already: boolean }
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
  | { kind: "faith"; gained: Faith; blessed: BlessingGod[] }
  | { kind: "trade"; news: TradeNews };

type EventKind = GameEvent["kind"];
type EventOf<K extends EventKind> = Extract<GameEvent, { kind: K }>;

// A corner notice per line; an event can say nothing (and is still heard, for its sound).
type EventMessage<E extends GameEvent> = (event: E) => string[];

/** One entry per event: a new kind of event without one doesn't compile. */
export const EVENT_MESSAGES: { readonly [K in EventKind]: EventMessage<EventOf<K>> } = {
  fightStarted: () => [],
  joinedYou:    ({ who }) => [`${who} joins the fight.`],
  joinRefused:  ({ reason }) => [JOIN_REFUSED[reason]],
  challenge:    ({ news }) => challengeLines(news),
  rested:       () => ["You rest by the fire. HP and stamina are restored."],
  padBound:     ({ already }) => [already ? PAD_ALREADY : PAD_BOUND],
  itemUsed:     ({ item }) => [itemUsedLine(item)],
  tooWeak:      ({ item }) => [tooWeakLine(item)],
  leftOnCloth:  ({ items }) => [`You leave ${describeItems(items)} behind on the cloth.`],
  given:        givenLines,
  healed:       () => ["HP and stamina are restored."],
  noQuest:      () => ["There's no quest left to complete."],
  chatRefused:  ({ reason }) => [CHAT_REFUSED[reason]],
  battleResult: ({ outcome }) => battleResultLines(outcome),
  quest:        ({ news }) => questLines(news),
  breakthrough: ({ core }) => [`Your core breaks through: ${coreName(core)}.`],
  faith:        faithLines,
  trade:        ({ news }) => tradeLines(news),
};

export function say(to: Notifications, event: GameEvent): void {
  // TypeScript can't tie `event` to its own kind's entry, so the entry is read as taking any event.
  const lines = EVENT_MESSAGES[event.kind] as EventMessage<GameEvent>;
  to.said.set({ event });
  for (const line of lines(event)) to.notify(line);
}

const PAD_BOUND = "You're bound to this summoning pad: you'll wake here when you die or come back.";
const PAD_ALREADY = "You're already bound to this summoning pad.";

const JOIN_REFUSED: Record<ServerMsgOf<"joinRefused">["reason"], string> = {
  nobodyNear: "Nobody close by is fighting.",
  full: "That fight is full.",
  duel: "A duel can't be joined.",
  spar: "A spar can't be joined.",
};

const CHAT_REFUSED: Record<ServerMsgOf<"chatRefused">["reason"], string> = {
  tooFast: "You're sending messages too fast. Wait a moment.",
  tooLong: `A message is ${MAX_CHAT_CHARS} characters at most.`,
};

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
  noEssence: "You don't have the essence for that.",
  noSlot: "Your core has no room for another ring: it holds more as it grows.",
  carved: "That ring is carved into your core already.",
  notCarved: "That isn't carved into your core.",
};

function tradeLines(news: TradeNews): string[] {
  if (news.kind === "refused") return [TRADE_REFUSED[news.reason]];
  if (news.kind === "carved" || news.kind === "uncarved") {
    const name = itemDef(sigilOf(news.inscription)).name.replace("Sigil of ", "");
    const paid = `${formatPrice(news.price.copper)} and ${news.price.essence} essence`;
    return [news.kind === "carved"
      ? `${name} is carved into your core, for ${paid}.`
      : `${name} is unmade from your core, for ${paid}. It's gone.`];
  }
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

function faithLines({ gained, blessed }: EventOf<"faith">): string[] {
  const grew = (Object.keys(gained) as God[]).map((god) => `Your faith with ${GOD_NAMES[god]} grows.`);
  return [...grew, ...blessed.map((god) => `${GOD_NAMES[god]} blesses you: ${BLESSING_TEXT[god]}`)];
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
