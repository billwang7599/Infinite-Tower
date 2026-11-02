import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { describe, test } from "node:test";
import { ARENA_LOOK_IDS, type LevelLayout } from "@infinite-tower/shared";
import { MUSIC, musicFor, TRACKS, type Scene } from "../../src/audio/music.js";

const ON_DISK = readdirSync(new URL("../../src/audio/music/", import.meta.url));
const THEMES = Object.keys(MUSIC.overworld) as LevelLayout["theme"][];
const scene = (over: Partial<Scene>): Scene => ({ mode: null, level: null, arena: null, decided: false, ...over });

describe("the music table", () => {
  test("every track's file is there, and every file there is a track's", () => {
    const listed = Object.keys(TRACKS).map((name) => `${name}.ogg`);
    for (const file of listed) assert.ok(ON_DISK.includes(file), `${file} is missing`);
    for (const file of ON_DISK) assert.ok(listed.includes(file), `${file} isn't used`);
  });

  test("the title, every level and every arena name a track", () => {
    const named = [MUSIC.title, ...Object.values(MUSIC.overworld), ...ARENA_LOOK_IDS.map((look) => MUSIC.battle[look])];
    for (const track of named) assert.ok(track in TRACKS, track);
  });

  test("the Old Quarry plays a track of its own, which no other level or arena plays", () => {
    const others = [MUSIC.title, ...THEMES.filter((t) => t !== "quarry").map((t) => MUSIC.overworld[t]),
      ...ARENA_LOOK_IDS.map((look) => MUSIC.battle[look])];
    assert.ok(!others.includes(MUSIC.overworld.quarry));
  });
});

describe("musicFor", () => {
  test("the title's plays on the title, and on the overworld until a level comes (making a character)", () => {
    assert.equal(musicFor(scene({})), MUSIC.title);
    assert.equal(musicFor(scene({ mode: "overworld" })), MUSIC.title);
  });

  test("each level plays its own", () => {
    for (const level of THEMES) assert.equal(musicFor(scene({ mode: "overworld", level })), MUSIC.overworld[level]);
  });

  test("a fight plays its arena's, whatever level it came from, until it's decided", () => {
    for (const arena of ARENA_LOOK_IDS) {
      for (const level of THEMES) {
        assert.equal(musicFor(scene({ mode: "battle", level, arena })), MUSIC.battle[arena], `${arena} from ${level}`);
        assert.equal(musicFor(scene({ mode: "battle", level, arena, decided: true })), null);
      }
    }
  });

  test("a battle with no fight yet plays nothing", () => {
    assert.equal(musicFor(scene({ mode: "battle" })), null);
  });
});
