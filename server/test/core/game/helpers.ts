/** Builders for the game tests: a started session with fakes around it, and the overworld's boar. */
import assert from "node:assert/strict";
import {
  addItem, distXZ, emptyBag, FIXED_DT, Health, HEADING_WAY, hpRegenPerSec, IDLE_INPUT, type Bag, type EnemyId,
  type Entity, type Heading, type ItemCounts, type ItemId, type NpcId, type Vec2,
} from "@infinite-tower/shared";
import { OverworldPos, Pile } from "../../../src/core/overworld/components.js";
import { EncounterOnTouch } from "../../../src/core/overworld/behaviors/touch.js";
import { newPlayer, PLAYER_STATS } from "../../../src/core/content/player.js";
import { Chat } from "../../../src/core/game/chat.js";
import { Duels } from "../../../src/core/game/duels.js";
import { GameSession } from "../../../src/core/game/session.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import type { Account, PlayerSave } from "../../../src/core/ports.js";
import { getLevel } from "../../../src/core/world/index.js";
import { FakeLink } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";

export const ACCOUNT: Account = { id: "player-1", username: "tester" };

/** A session that has sent `welcome` and, since it has a character, entered the start level. */
export function startSession(opts: { dev?: boolean; saved?: Partial<PlayerSave> } = {}) {
  const link = new FakeLink();
  const saves: PlayerSave[] = [];
  const saved: PlayerSave = { ...newPlayer(), character: TEST_CHARACTER, ...opts.saved };
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

export function bagWith(items: ItemCounts): Bag {
  let bag = emptyBag();
  for (const [item, count] of Object.entries(items) as [ItemId, number][]) bag = addItem(bag, item, count).bag;
  return bag;
}
