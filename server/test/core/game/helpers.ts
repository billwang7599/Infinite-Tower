/** Builders for the game tests: a started session with fakes around it, and a clock the battle code reads. */
import type { TestContext } from "node:test";
import { OverworldPos } from "../../../src/core/overworld/components.js";
import { EncounterOnTouch } from "../../../src/core/overworld/behaviors/touch.js";
import { newPlayer } from "../../../src/core/content/player.js";
import { GameSession } from "../../../src/core/game/session.js";
import type { Account, PlayerSave } from "../../../src/core/ports.js";
import { FakeLink } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";

export const ACCOUNT: Account = { id: "player-1", username: "tester" };

/** A session that has sent `welcome` and, since it has a character, entered the start level. */
export function startSession(opts: { dev?: boolean; saved?: Partial<PlayerSave> } = {}) {
  const link = new FakeLink();
  const saves: PlayerSave[] = [];
  const saved: PlayerSave = { ...newPlayer(), character: TEST_CHARACTER, ...opts.saved };
  const session = new GameSession(ACCOUNT, link, opts.dev ?? false, saved, (data) => saves.push(structuredClone(data)));
  session.start();
  return { session, link, saves };
}

/** Makes `performance.now()` return the returned clock's `ms`, which the test advances. */
export function fakeNow(t: TestContext): { ms: number } {
  const clock = { ms: 0 };
  t.mock.method(performance, "now", () => clock.ms);
  return clock;
}

export const HOUR_MS = 60 * 60 * 1000;

/** The overworld's touch-to-fight actor (the start level's boar) and where it stands. */
export function findBoar(session: GameSession) {
  const found = session.overworld.world.first(EncounterOnTouch, OverworldPos);
  if (!found) throw new Error("no boar on the overworld");
  const [boar, , pos] = found;
  return { boar, pos };
}
