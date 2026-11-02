import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LocalPlayer, START_HEADING, World, type LevelLayout } from "@infinite-tower/shared";
import { overworldEars, STRIDE_TILES } from "../../src/audio/overworld.js";
import { RUNNING_WATER_SOUND, STILL_WATER_SOUNDS } from "../../src/audio/sounds.js";
import { CAMERA_PITCH } from "../../src/modes/overworld/facing.js";
import {
  OverworldActor, OverworldPos, type OverworldActorData, type OverworldState,
} from "../../src/modes/overworld/components.js";

// 8 x 4 tiles, centred on 0, 0: x from -4 to 4, z from -2 to 2 (north first). A stream down x 2 to 3, off the map at
// both ends, and a pond (x -3 to -1, z -1 to 0) against nothing.
const LEVEL: LevelLayout = {
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5, campfires: [{ x: -2, z: 1 }], npcs: [],
  traces: [],
  tiles: ["......~.", "......~.", ".~~...~.", "......~."],
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
  const state: OverworldState = {
    world, player, level, next: [], cameraTurns: 0, cameraPitchRad: CAMERA_PITCH.startRad,
  };
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

  test("running water is heard from its nearest point, even with still water nearer", () => {
    const { state, hear } = overworld();
    const water = [...hear(state)!.loops.values()].filter((l) => l.sound === RUNNING_WATER_SOUND);
    assert.deepEqual(water.map((l) => l.at), [{ x: 2, z: 0 }]);
  });

  test("still water makes no sound unless the level's theme gives it one", () => {
    const { state, hear } = overworld();
    assert.deepEqual([...hear(state)!.loops.values()].map((l) => l.sound).sort(), ["campfire", RUNNING_WATER_SOUND]);
    const mire = overworld({ ...LEVEL, theme: "mistwood" });
    const still = [...mire.hear(mire.state)!.loops.values()].filter((l) => l.sound === STILL_WATER_SOUNDS.mistwood);
    assert.deepEqual(still.map((l) => l.at), [{ x: -1, z: 0 }]);
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
