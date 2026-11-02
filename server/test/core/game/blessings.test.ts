import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { BLESSING_FAITH, BLESSINGS, Statuses, timeLeft, type God } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { FAITH_CHEAT } from "../../../src/core/game/cheats.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import { startSession } from "./helpers.js";

before(() => initPhysics());

const YARD = "bram-yard";
const faithFrom = (quest: string, god: God) =>
  QUESTS[quest]!.steps.reduce((sum, step) => sum + (step.reward?.faith?.[god] ?? 0), 0);

describe("faith", () => {
  test("comes with the welcome", () => {
    const { link } = startSession({ saved: { faith: { kaelith: 30 } } });
    assert.deepEqual(link.last("welcome").faith, { kaelith: 30 });
  });

  test("a quest's reward can give faith with a god, sent and saved", () => {
    const gained = faithFrom(YARD, "kaelith");
    assert.ok(gained > 0, "Bram's yard gives Kaelith faith");
    const { session, link, saves } = startSession({ dev: true });
    session.cheat({ kind: "completeQuest" });
    assert.equal(session.story.quests[YARD]?.step, null);
    assert.deepEqual(session.faith, { kaelith: gained });
    assert.deepEqual(link.last("faith"), {
      t: "faith", faith: { kaelith: gained }, gained: { kaelith: gained }, blessed: [],
    });
    assert.deepEqual(saves.at(-1)?.faith, { kaelith: gained });
  });

  test("reaching the threshold blesses you, once", () => {
    const { session, link } = startSession({ dev: true, saved: { faith: { kaelith: BLESSING_FAITH - 1 } } });
    session.cheat({ kind: "completeQuest" });
    assert.deepEqual(link.last("faith").blessed, ["kaelith"]);
    session.cheat({ kind: "faith", god: "kaelith" });
    assert.deepEqual(link.last("faith").blessed, []);
  });

  test("the admin panel adds faith on dev servers only", () => {
    const dev = startSession({ dev: true });
    dev.session.cheat({ kind: "faith", god: "haldis" });
    assert.deepEqual(dev.session.faith, { haldis: FAITH_CHEAT });
    const prod = startSession();
    prod.session.cheat({ kind: "faith", god: "haldis" });
    assert.deepEqual(prod.session.faith, {});
  });

  test("a blessed player fights with the blessing on", () => {
    const { session } = startSession({ dev: true, saved: { faith: { brannoc: BLESSING_FAITH } } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    const fight = session.battle!.room.fight;
    const on = fight.world.require(fight.players[0]!, Statuses).on;
    assert.equal(timeLeft(on, BLESSINGS.brannoc.status), Infinity);
  });
});
