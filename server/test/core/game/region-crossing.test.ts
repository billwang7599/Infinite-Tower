import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { distXZ, FIXED_DT, type Vec2 } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { OverworldActor, OverworldPos } from "../../../src/core/overworld/components.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { getRegion } from "../../../src/core/world/index.js";
import { startSession, tick } from "./helpers.js";

before(() => initPhysics());

const FIELD = getRegion("grass-field"), WOODS = getRegion("mistwood");
const BORDER_X = FIELD.area.x + FIELD.area.w;
const ROAD_Z = -1.5;
const MAX_WALK_TICKS = 400;

let seq = 0;

function walkEast(session: GameSession, untilX: number): Vec2[] {
  const path: Vec2[] = [];
  for (let i = 0; i < MAX_WALK_TICKS && session.overworld.playerPos(session.me).x < untilX; i++) {
    session.input(++seq, 1, 0);
    tick(session);
    path.push(session.overworld.playerPos(session.me));
  }
  return path;
}

describe("walking from one region into the next", () => {
  test("is plain walking: no jump, no new world sent, and you're in the next region", () => {
    const { session, link } = startSession({ saved: { pad: "grass-field" } });
    session.overworld.place(session.me, { x: BORDER_X - 3, z: ROAD_Z });
    tick(session);
    assert.equal(session.region, "grass-field");
    const path = walkEast(session, BORDER_X + 3);
    assert.equal(session.region, "mistwood");
    assert.ok(session.overworld.playerPos(session.me).x >= BORDER_X + 3, "walked through");
    const step = session.overworld.map.layout.playerSpeed * FIXED_DT;
    for (let i = 1; i < path.length; i++) assert.ok(distXZ(path[i - 1]!, path[i]!) <= step + 1e-9, "never jumps");
    assert.equal(link.all("world").length, 1);
  });

  test("the way back is as open", () => {
    const { session } = startSession({ saved: { pad: "mistwood" } });
    session.overworld.place(session.me, { x: BORDER_X + 3, z: ROAD_Z });
    for (let i = 0; i < MAX_WALK_TICKS && session.overworld.playerPos(session.me).x > BORDER_X - 3; i++) {
      session.input(++seq, -1, 0);
      tick(session);
    }
    assert.equal(session.region, "grass-field");
  });

  test("monsters chase across it", () => {
    const { session } = startSession({ saved: { pad: "grass-field" } });
    const [wolf] = [...session.overworld.world.query(OverworldActor, OverworldPos)]
      .filter(([, actor]) => actor.kind === "grey-wolf")
      .sort(([, , a], [, , b]) => distXZ(a, WOODS.spawn) - distXZ(b, WOODS.spawn));
    assert.ok(wolf);
    const pos = wolf[2];
    pos.x = BORDER_X - 2;
    pos.z = ROAD_Z;
    session.overworld.place(session.me, { x: BORDER_X + 2, z: ROAD_Z });
    for (let i = 0; i < 180 && pos.x < BORDER_X + 0.5 && !session.battle; i++) tick(session);
    assert.ok(pos.x > BORDER_X || session.battle, "the wolf came over the border, or reached them");
  });

  test("does nothing in a battle", () => {
    const { session, link } = startSession({ cheats: true, saved: { pad: "grass-field" } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.overworld.place(session.me, { x: BORDER_X + 3, z: ROAD_Z });
    tick(session, 5);
    assert.equal(link.all("npcs").length, 0);
  });
});
