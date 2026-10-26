/**
 * Everything the game tells the player goes through `say`: game code says what happened (a `GameEvent`), and
 * EVENT_MESSAGES says where that shows and in what words. The rule (AGENTS.md): small things are notices in the
 * bottom-right corner; the centre banner is only for big events, which so far is only a fight starting.
 */
import { itemDef, type EnemyDef, type ItemId, type ServerMsgOf } from "@infinite-tower/shared";
import { battleResultLines, type BattleOutcome } from "./battleResult.js";
import type { Notifications } from "./state.js";

/** Something that happened that the player is told about. */
export type GameEvent =
  /** A fight starting. `source` is the actor that touched you, or null for tall grass. */
  | { kind: "encounter"; source: ServerMsgOf<"encounter">["source"]; enemy: Pick<EnemyDef, "name"> }
  | { kind: "rested" }
  | { kind: "itemUsed"; item: ItemId }
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
  rested:       { where: "corner", lines: () => ["You rest by the fire. HP and stamina are restored."] },
  itemUsed:     { where: "corner", lines: ({ item }) => [itemUsedLine(item)] },
  battleResult: { where: "corner", lines: ({ outcome }) => battleResultLines(outcome) },
};

/** Tells the player about `event` in its place: each line is a notice, or the banner (a new one replaces it). */
export function say(to: Notifications, event: GameEvent): void {
  // TypeScript can't tie `event` to its own kind's entry, so the entry is read as taking any event.
  const { where, lines } = EVENT_MESSAGES[event.kind] as EventMessage<GameEvent>;
  for (const line of lines(event)) {
    if (where === "centre") to.announce(line);
    else to.notify(line);
  }
}

function encounterLine({ source, enemy }: EventOf<"encounter">): string {
  return source === null ? `A ${enemy.name} leaps out of the grass!` : `The ${enemy.name} attacks!`;
}

function itemUsedLine(item: ItemId): string {
  const def = itemDef(item);
  return `${def.verb === "Eat" ? "You eat the" : "You use the"} ${def.name.toLowerCase()}.`;
}
