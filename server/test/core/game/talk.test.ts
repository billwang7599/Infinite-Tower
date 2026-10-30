import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  HEADING_WAY, INTERACT_LOOK_RAD, INTERACT_RANGE_M, type Heading,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import type { GameSession } from "../../../src/core/game/session.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { INTERACT_LAG_SLACK_M, INTERACT_LOOK_SLACK_RAD } from "../../../src/core/overworld/interact.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { startSession, tick } from "./helpers.js";

before(() => initPhysics());

const LEVEL = getLevel(START_LEVEL);
const NPC = LEVEL.layout.npcs[0]!;
const REACH_TILES = INTERACT_RANGE_M + INTERACT_LAG_SLACK_M;
const LOOK_RAD = INTERACT_LOOK_RAD + INTERACT_LOOK_SLACK_RAD;

function standBy(session: GameSession, awayTiles: number, heading: Heading = "west", offRad = 0): void {
  const way = HEADING_WAY[heading], toNpcRad = Math.atan2(way.x, way.z) + offRad;
  session.overworld.place(session.me, {
    x: NPC.at.x - Math.sin(toNpcRad) * awayTiles, z: NPC.at.z - Math.cos(toNpcRad) * awayTiles,
  });
  session.overworld.playerData(session.me).heading = heading;
}

describe("talking to an NPC", () => {
  test("the start level has one", () => {
    assert.ok(NPC);
  });

  test("in reach (with the lag slack) and faced, the server sends who it is and what it says", () => {
    const { session, link } = startSession();
    standBy(session, REACH_TILES - 0.1);
    session.talk();
    assert.deepEqual(link.last("dialogue"), { t: "dialogue", npc: NPC.npc, lines: NPCS[NPC.npc].lines });
  });

  test("out of reach, nothing", () => {
    const { session, link } = startSession();
    standBy(session, REACH_TILES + 0.1);
    session.talk();
    assert.equal(link.all("dialogue").length, 0);
  });

  test("only looked at: not behind them, nor further round than the look (plus the lag slack)", () => {
    const { session, link } = startSession();
    for (const offRad of [Math.PI, LOOK_RAD + 0.02, -(LOOK_RAD + 0.02)]) {
      standBy(session, 1, "west", offRad);
      session.talk();
    }
    assert.equal(link.all("dialogue").length, 0);
    standBy(session, 1, "west", LOOK_RAD - 0.02);
    session.talk();
    assert.equal(link.all("dialogue").length, 1);
  });

  test("they face the way they last walked", () => {
    const { session, link } = startSession();
    standBy(session, 1, "north");
    session.input(session.overworld.playerData(session.me).lastSeq + 1, 0, -1);
    tick(session);
    session.talk();
    assert.equal(link.all("dialogue").length, 0, "turned their back on it");
  });

  test("not mid-fight", () => {
    const { session, link } = startSession({ dev: true });
    standBy(session, 1);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.talk();
    assert.equal(link.all("dialogue").length, 0);
  });

  test("it changes nothing: no save, and only the lines are sent", () => {
    const { session, link, saves } = startSession();
    standBy(session, 1);
    const before = { sent: link.sent.length, saves: saves.length, vitals: session.vitals, gear: session.gear };
    session.talk();
    assert.deepEqual(link.sent.slice(before.sent).map((m) => m.t), ["dialogue"]);
    assert.equal(saves.length, before.saves);
    assert.equal(session.vitals, before.vitals);
    assert.equal(session.gear, before.gear);
  });
});
