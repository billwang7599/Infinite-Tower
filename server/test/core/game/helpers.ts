/** Builders for the game tests: a started session with fakes around it, and the overworld's boar. */
import { distXZ, FIXED_DT, type Entity, type Vec2 } from "@infinite-tower/shared";
import { OverworldPos, Pile } from "../../../src/core/overworld/components.js";
import { EncounterOnTouch } from "../../../src/core/overworld/behaviors/touch.js";
import { newPlayer } from "../../../src/core/content/player.js";
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
