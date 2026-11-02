import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { describe, test } from "node:test";
import { ARENA_LOOK_IDS, ELEMENTS, ENEMY_IDS } from "@infinite-tower/shared";
import {
  ARENA_AMBIENCE, bagSound, ELEMENT_SOUNDS, ENEMY_SOUNDS, fileOf, soundDef, SOUNDS, STEP_SOUNDS, take, RUNNING_WATER_SOUND, STILL_WATER_SOUNDS,
  type SoundName,
} from "../../src/audio/sounds.js";

const NAMES = Object.keys(SOUNDS) as SoundName[];
const ON_DISK = readdirSync(new URL("../../src/audio/sounds/", import.meta.url));
const seq = (...values: number[]) => () => values.shift() ?? 0;

describe("the sound table", () => {
  test("every sound's files are there, and every file there is some sound's", () => {
    const listed = new Set(NAMES.flatMap((name) =>
      Array.from({ length: soundDef(name).variants }, (_, i) => fileOf(name, i + 1))));
    for (const file of listed) assert.ok(ON_DISK.includes(file), `${file} is missing`);
    for (const file of ON_DISK) assert.ok(listed.has(file), `${file} isn't used`);
  });

  test("every enemy, element and arena look names sounds that exist", () => {
    const named = [
      ...ENEMY_IDS.flatMap((id) => Object.values(ENEMY_SOUNDS[id])),
      ...Object.values(ELEMENT_SOUNDS).flatMap((el) => [el.cast, el.loop, el.impact]),
      ...ARENA_LOOK_IDS.flatMap((look) => [STEP_SOUNDS[look], ARENA_AMBIENCE[look]]),
      RUNNING_WATER_SOUND, ...Object.values(STILL_WATER_SOUNDS),
    ];
    for (const name of named) if (name !== null && name !== undefined) assert.ok(name in SOUNDS, name);
  });

  test("loops are the ambient bus's or a skill's, and loop", () => {
    for (const name of ["campfire", "river", "mire"] as const) {
      assert.equal(soundDef(name).bus, "ambient");
      assert.equal(soundDef(name).loop, true);
    }
    for (const el of ELEMENTS) assert.equal(soundDef(ELEMENT_SOUNDS[el].loop).loop, true);
  });
});

describe("take", () => {
  test("never the variant played last, and every other one in turn", () => {
    const { variants } = soundDef("swing");
    for (let last = 1; last <= variants; last++) {
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) seen.add(take("swing", last, Math.random).variant);
      assert.equal(seen.has(last), false);
      assert.equal(seen.size, variants - 1);
    }
  });

  test("a sound with one file always takes it", () => {
    assert.equal(take("victory", 1, Math.random).variant, 1);
    assert.equal(take("victory", undefined, Math.random).file, "victory-1.ogg");
  });

  test("its rate and volume vary within the sound's spread round its own", () => {
    const def = soundDef("hit-body"), spread = def.spread!;
    const low = take("hit-body", undefined, seq(0, 0, 0)), high = take("hit-body", undefined, seq(0.999, 1, 1));
    assert.equal(low.rate, (1 - spread) * (def.rate ?? 1));
    assert.equal(low.gain, (1 - spread) * def.volume);
    assert.equal(high.rate, (1 + spread) * (def.rate ?? 1));
    assert.equal(high.gain, (1 + spread) * def.volume);
  });

  test("a file comes from the stem when a sound borrows another's", () => {
    assert.equal(take("bolt-fire", undefined, Math.random).file, "campfire-1.ogg");
  });
});

describe("bagSound", () => {
  test("taking from a pile picks up, into a slot equips, anything else moves in the bag", () => {
    assert.equal(bagSound({ in: "pile", x: 0, y: 0 }, { in: "bag", x: 1, y: 1 }), "pickup");
    assert.equal(bagSound({ in: "bag", x: 0, y: 0 }, { in: "slot", slot: "rightHand" }), "equip");
    assert.equal(bagSound({ in: "slot", slot: "rightHand" }, { in: "bag", x: 0, y: 0 }), "bag");
    assert.equal(bagSound({ in: "bag", x: 0, y: 0 }, { in: "cloth", x: 2, y: 0 }), "bag");
  });
});
