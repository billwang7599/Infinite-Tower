/** Builders for the game tests: a started session with fakes around it, and the overworld's boar. */
import { FIXED_DT } from "@infinite-tower/shared";
import { OverworldPos } from "../../../src/core/overworld/components.js";
import { EncounterOnTouch } from "../../../src/core/overworld/behaviors/touch.js";
import { newPlayer } from "../../../src/core/content/player.js";
import { GameSession } from "../../../src/core/game/session.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import type { Account, PlayerSave } from "../../../src/core/ports.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { FakeLink } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";

export const ACCOUNT: Account = { id: "player-1", username: "tester" };

/** A session that has sent `welcome` and, since it has a character, entered the start level. */
export function startSession(opts: { dev?: boolean; saved?: Partial<PlayerSave> } = {}) {
  const link = new FakeLink();
  const saves: PlayerSave[] = [];
  const saved: PlayerSave = { ...newPlayer(), character: TEST_CHARACTER, ...opts.saved };
  const overworld = new Overworld(getLevel(START_LEVEL));
  const persist = (data: PlayerSave) => saves.push(structuredClone(data));
  const session = new GameSession(ACCOUNT, link, opts.dev ?? false, saved, persist, () => overworld);
  session.start();
  return { session, link, saves };
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
