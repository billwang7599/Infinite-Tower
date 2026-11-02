import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { Vec2 } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import type { GameSession } from "../../../src/core/game/session.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import type { ExitDef } from "../../../src/core/world/level.js";
import type { FakeLink } from "../../fixtures/fakes.js";
import { startSession, tick } from "./helpers.js";

before(() => initPhysics());

const START = getLevel(START_LEVEL);
const OUT = START.exits[0]!;
const BACK = getLevel(OUT.to).exits.find((e) => e.to === START_LEVEL)!;
const MAX_WALK_TICKS = 300;

let seq = 0;

function walkInto(session: GameSession, link: FakeLink, exit: ExitDef): void {
  const levels = link.all("level").length;
  const target: Vec2 = { x: exit.area.x + exit.area.w / 2, z: exit.area.z + exit.area.h / 2 };
  for (let i = 0; i < MAX_WALK_TICKS && link.all("level").length === levels; i++) {
    const at = session.overworld.playerPos(session.me);
    const dx = target.x - at.x, dz = target.z - at.z, len = Math.hypot(dx, dz);
    session.input(++seq, dx / len, dz / len);
    tick(session);
  }
}

describe("entering a level", () => {
  test("sends the maps its exits lead to, each once, so the client can draw them before you cross", () => {
    const { link } = startSession({ saved: { pad: START_LEVEL } });
    const next = link.last("level").next;
    assert.deepEqual(next.map((m) => m.id), [...new Set(START.exits.map((e) => e.to))]);
    assert.deepEqual(next[0], getLevel(OUT.to).layout);
  });
});

describe("walking into an exit", () => {
  test("takes you to the level it leads to, at its entrance, and off the level you left", () => {
    const { session, link, overworldOf } = startSession({ saved: { pad: START_LEVEL } });
    session.overworld.place(session.me, BACK.at);
    walkInto(session, link, OUT);
    const arrived = link.last("level");
    assert.equal(arrived.level.id, OUT.to);
    assert.deepEqual(arrived.me, OUT.at);
    assert.equal(session.overworld.level.layout.id, OUT.to);
    assert.deepEqual(session.overworld.playerPos(session.me), OUT.at);
    assert.equal(overworldOf(START_LEVEL).empty, true);
  });

  test("and its way back arrives in front of the exit you took", () => {
    const { session, link } = startSession({ saved: { pad: START_LEVEL } });
    session.overworld.place(session.me, BACK.at);
    walkInto(session, link, OUT);
    walkInto(session, link, BACK);
    assert.equal(link.last("level").level.id, START_LEVEL);
    assert.deepEqual(link.last("level").me, BACK.at);
  });

  test("does nothing in a battle", () => {
    const { session, link } = startSession({ dev: true, saved: { pad: START_LEVEL } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.overworld.place(session.me, { x: OUT.area.x + OUT.area.w / 2, z: OUT.area.z + OUT.area.h / 2 });
    tick(session, 5);
    assert.equal(link.all("level").length, 1);
    assert.equal(session.overworld.level.layout.id, START_LEVEL);
  });
});
