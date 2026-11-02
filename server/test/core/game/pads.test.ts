import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { INTERACT_RANGE_M, tileAt } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { OverworldPos, SummoningPad } from "../../../src/core/overworld/components.js";
import { INTERACT_LAG_SLACK_M } from "../../../src/core/overworld/interact.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import { getLevel, LEVELS, START_LEVEL } from "../../../src/core/world/index.js";
import { arriveIn, dieIn, startSession } from "./helpers.js";

before(() => initPhysics());

const FIELD = getLevel("grass-field");
const padsOn = (overworld: Overworld) => [...overworld.world.query(SummoningPad, OverworldPos)]
  .map(([, pad, pos]) => ({ level: pad.level, x: pos.x, z: pos.z }));

function onFieldPad(saved = {}) {
  const started = startSession({ dev: true, saved: { pad: START_LEVEL, ...saved } });
  if (started.session.overworld.level.layout.id === START_LEVEL) {
    arriveIn(started.session, "market-ward");
    arriveIn(started.session, "grass-field");
  }
  started.session.overworld.place(started.session.me, FIELD.spawn);
  return started;
}

describe("summoning pads", () => {
  test("every level whose start is a pad has one, there, and the Market Ward has none", () => {
    for (const level of Object.values(LEVELS)) {
      const onPad = tileAt(level.layout, level.spawn.x, level.spawn.z) === "pad";
      const want = onPad ? [{ level: level.layout.id, ...level.spawn }] : [];
      assert.deepEqual(padsOn(new Overworld(level)), want, level.layout.id);
    }
    assert.deepEqual(padsOn(new Overworld(getLevel("market-ward"))), []);
  });

  test("a new player is bound to Highmere's platform", () => {
    assert.equal(newPlayer().pad, START_LEVEL);
  });

  test("Interact on one binds you to it, says so and saves it", () => {
    const { session, link, saves } = onFieldPad();
    session.bindPad();
    assert.deepEqual(link.last("padBound"), { t: "padBound", already: false });
    assert.equal(saves.at(-1)?.pad, "grass-field");
  });

  test("on the pad you're bound to, it only says so", () => {
    const { session, link, saves } = onFieldPad({ pad: "grass-field" });
    const saved = saves.length;
    session.bindPad();
    assert.deepEqual(link.last("padBound"), { t: "padBound", already: true });
    assert.equal(saves.length, saved);
  });

  test("works from its reach, facing it, and not from further or facing away", () => {
    const far = INTERACT_RANGE_M + INTERACT_LAG_SLACK_M;
    const { session, link } = onFieldPad();
    session.overworld.place(session.me, { x: FIELD.spawn.x, z: FIELD.spawn.z - far - 0.1 });
    session.overworld.playerData(session.me).heading = "north";
    session.bindPad();
    assert.equal(link.all("padBound").length, 0);
    session.overworld.place(session.me, { x: FIELD.spawn.x, z: FIELD.spawn.z - far + 0.1 });
    session.overworld.playerData(session.me).heading = "south";
    session.bindPad();
    assert.equal(link.all("padBound").length, 0);
    session.overworld.playerData(session.me).heading = "north";
    session.bindPad();
    assert.equal(link.last("padBound").already, false);
  });

  test("does nothing in a fight", () => {
    const { session, link } = onFieldPad();
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.bindPad();
    assert.equal(link.all("padBound").length, 0);
  });

  test("logging in wakes you on your pad", () => {
    const { session, saves } = onFieldPad();
    session.bindPad();
    arriveIn(session, "mistwood");
    session.disconnect();
    const { link } = startSession({ saved: saves.at(-1)! });
    assert.equal(link.last("level").level.id, "grass-field");
    assert.deepEqual(link.last("level").me, FIELD.spawn);
  });

  test("a pad that's gone, or a level with none, wakes you on Highmere's platform", () => {
    for (const pad of ["market-ward", "nowhere"]) {
      const { link } = startSession({ saved: { pad } });
      assert.equal(link.last("level").level.id, START_LEVEL, pad);
      assert.deepEqual(link.last("level").me, getLevel(START_LEVEL).spawn, pad);
    }
  });

  test("dying elsewhere wakes you on your pad once you leave the arena", () => {
    const { session, link, saves } = onFieldPad();
    session.bindPad();
    arriveIn(session, "mistwood");
    dieIn(session);
    assert.deepEqual(link.last("battleResult").me, FIELD.spawn);
    assert.equal(saves.at(-1)?.pad, "grass-field");
    session.leaveBattle();
    assert.equal(link.last("level").level.id, "grass-field");
    assert.deepEqual(link.last("level").me, FIELD.spawn);
  });

  test("dying on your pad's level puts you back on it at once", () => {
    const { session } = onFieldPad({ pad: "grass-field" });
    session.overworld.place(session.me, { x: FIELD.spawn.x + 5, z: FIELD.spawn.z });
    dieIn(session);
    assert.equal(session.overworld.level.layout.id, "grass-field");
    assert.deepEqual(session.overworld.playerPos(session.me), FIELD.spawn);
  });
});
