import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LocalPlayer, START_HEADING, World, type LevelLayout } from "@infinite-tower/shared";
import { overworldEars, STRIDE_TILES } from "../../src/audio/overworld.js";
import { WATER_SOUNDS } from "../../src/audio/sounds.js";
import {
  OverworldActor, OverworldPos, type OverworldActorData, type OverworldState,
} from "../../src/modes/overworld/components.js";

// 8 x 4 tiles, centred on 0, 0: x from -4 to 4, z from -2 to 2 (north first). Water in the east column, rows 1-2.
const LEVEL: LevelLayout = {
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5, campfires: [{ x: -2, z: 1 }], npcs: [],
  traces: [],
  tiles: ["........", ".......~", ".......~", "........"],
};
const DRY: LevelLayout = { ...LEVEL, theme: "mistwood", tiles: ["........", "........"], campfires: [] };

function overworld(level: LevelLayout | null = LEVEL) {
  const world = new World();
  const walker = (kind: OverworldActorData["kind"], x: number, z: number) => {
    const e = world.spawn();
    world.add(e, OverworldPos, { x, z });
    world.add(e, OverworldActor, { kind, vx: 0, vz: 0, heading: START_HEADING, alert: false });
    return e;
  };
  const player = walker("player", 0, 0);
  world.add(player, LocalPlayer, true);
  const state: OverworldState = { world, player, level, cameraTurns: 0 };
  return { state, world, walker, player, hear: overworldEars() };
}

describe("the overworld's ears", () => {
  test("are where you stand, facing the way the camera looks", () => {
    const { state, hear, world, player } = overworld();
    Object.assign(world.require(player, OverworldPos), { x: 1, z: -1 });
    state.cameraTurns = 1;
    assert.deepEqual(hear(state)!.ears, { x: 1, z: -1, yaw: Math.PI / 2 });
  });

  test("each campfire crackles where it is", () => {
    const { state, hear } = overworld();
    const loops = [...hear(state)!.loops.values()];
    assert.deepEqual(loops.filter((l) => l.sound === "campfire").map((l) => l.at), LEVEL.campfires);
  });

  test("the water is heard from its nearest point, as the level's water sounds", () => {
    const { state, hear } = overworld();
    const water = [...hear(state)!.loops.values()].filter((l) => l.sound === WATER_SOUNDS[LEVEL.theme]);
    assert.deepEqual(water.map((l) => l.at), [{ x: 3, z: 0 }]);
  });

  test("a level with no water or fire is quiet", () => {
    const { state, hear } = overworld(DRY);
    assert.equal(hear(state)!.loops.size, 0);
  });

  test("you and other players step every stride as you walk; enemies don't", () => {
    const { state, hear, world, player, walker } = overworld();
    const peer = walker("peer", 2, 0), boar = walker("wild-boar", -2, 0);
    hear(state);
    const steps: string[] = [];
    for (let i = 0; i < 55; i++) {
      for (const e of [player, peer, boar]) world.require(e, OverworldPos).z += STRIDE_TILES / 10;
      steps.push(...hear(state)!.cues.map((c) => c.sound));
    }
    assert.equal(steps.length, 10);
    assert.ok(steps.every((s) => s === "step-grass"));
  });

  test("put somewhere new (a new level, a correction) isn't a walk", () => {
    const { state, hear, world, player } = overworld();
    hear(state);
    world.require(player, OverworldPos).x += 20;
    assert.deepEqual(hear(state)!.cues, []);
  });

  test("nothing before the level comes", () => {
    const { state, hear } = overworld(null);
    assert.equal(hear(state), null);
  });
});
