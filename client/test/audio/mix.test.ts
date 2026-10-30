import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MAX_PAN, mixGain, nearestWater, place, type Ears } from "../../src/audio/mix.js";

const HEARING = { near: 2, far: 20 };
const facingNorth: Ears = { x: 0, z: 0, yaw: 0 };

describe("place", () => {
  test("a sound with no place is full and centred", () => {
    assert.deepEqual(place(facingNorth, null, HEARING), { gain: 1, pan: 0 });
  });

  test("full within the near distance, silent from the far one, quieter all the way between", () => {
    assert.equal(place(facingNorth, { x: 0, z: 0 }, HEARING).gain, 1);
    assert.equal(place(facingNorth, { x: 0, z: HEARING.near }, HEARING).gain, 1);
    assert.equal(place(facingNorth, { x: 0, z: HEARING.far }, HEARING).gain, 0);
    assert.equal(place(facingNorth, { x: 0, z: HEARING.far * 3 }, HEARING).gain, 0);
    let last = 1;
    for (let d = HEARING.near + 1; d < HEARING.far; d++) {
      const { gain } = place(facingNorth, { x: 0, z: d }, HEARING);
      assert.ok(gain < last && gain > 0, `at ${d}: ${gain}`);
      last = gain;
    }
  });

  test("a sound's reach shortens its far distance", () => {
    const at = { x: 0, z: HEARING.far * 0.6 };
    assert.ok(place(facingNorth, at, HEARING).gain > 0);
    assert.equal(place(facingNorth, at, HEARING, 0.5).gain, 0);
  });

  test("to the right pans right, to the left left, ahead and behind not at all", () => {
    assert.ok(place(facingNorth, { x: 5, z: 0 }, HEARING).pan > 0);
    assert.ok(place(facingNorth, { x: -5, z: 0 }, HEARING).pan < 0);
    assert.equal(place(facingNorth, { x: 0, z: 5 }, HEARING).pan, 0);
    assert.ok(Math.abs(place(facingNorth, { x: 0, z: -5 }, HEARING).pan) < 1e-12);
  });

  test("the pan follows the way the ears face", () => {
    const facingEast = { x: 0, z: 0, yaw: Math.PI / 2 };
    assert.ok(place(facingEast, { x: 0, z: 5 }, HEARING).pan < 0, "north is on the left facing east");
    assert.ok(place(facingEast, { x: 0, z: -5 }, HEARING).pan > 0);
  });

  test("never hard to one side, and less to the side the closer it is", () => {
    assert.ok(Math.abs(place(facingNorth, { x: 15, z: 0 }, HEARING).pan - MAX_PAN) < 1e-12);
    const close = place(facingNorth, { x: HEARING.near / 4, z: 0 }, HEARING).pan;
    assert.ok(close > 0 && close < MAX_PAN);
  });
});

describe("mixGain", () => {
  const volumes = { master: 0.5, effects: 0.8, ambient: 0.25 };

  test("the master volume times the bus's, times the sound's own gains", () => {
    assert.equal(mixGain(volumes, "effects", 0.5, 2), 0.5 * 0.8 * 0.5 * 2);
    assert.equal(mixGain(volumes, "ambient", 1), 0.5 * 0.25);
  });

  test("a master or bus at zero silences it", () => {
    assert.equal(mixGain({ ...volumes, master: 0 }, "effects", 1), 0);
    assert.equal(mixGain({ ...volumes, ambient: 0 }, "ambient", 1), 0);
    assert.ok(mixGain({ ...volumes, ambient: 0 }, "effects", 1) > 0);
  });
});

describe("nearestWater", () => {
  const tiles = [{ x: 3, z: 0 }, { x: 3, z: 1 }, { x: -6, z: -6 }];

  test("no water, no point", () => {
    assert.equal(nearestWater([], { x: 0, z: 0 }), null);
  });

  test("the nearest point on the nearest water tile (each a tile from its corner)", () => {
    assert.deepEqual(nearestWater(tiles, { x: 0, z: 0.5 }), { x: 3, z: 0.5 });
    assert.deepEqual(nearestWater(tiles, { x: 5, z: 3 }), { x: 4, z: 2 });
    assert.deepEqual(nearestWater(tiles, { x: -8, z: -5.5 }), { x: -6, z: -5.5 });
  });

  test("standing in it, the point is where you stand", () => {
    assert.deepEqual(nearestWater(tiles, { x: 3.5, z: 1.25 }), { x: 3.5, z: 1.25 });
  });
});
