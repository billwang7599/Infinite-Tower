import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NPC_IDS } from "@infinite-tower/shared";
import { NPCS } from "../../../src/core/npcs/index.js";
import { LEVELS } from "../../../src/core/world/index.js";

describe("NPCS", () => {
  test("each always stands somewhere: every stop is on a level, and the last has no condition", () => {
    for (const id of NPC_IDS) {
      const { stops } = NPCS[id];
      assert.equal(stops.at(-1)?.when, undefined, id);
      for (const stop of stops) assert.ok(Object.hasOwn(LEVELS, stop.level), `${id}: ${stop.level}`);
    }
  });

  test("what it leaves where it moved on from has something to say; its first stop, never left, leaves none", () => {
    for (const id of NPC_IDS) {
      const { stops } = NPCS[id];
      assert.equal(stops[0]?.trace, undefined, id);
      for (const { trace } of stops) {
        if (!trace) continue;
        assert.ok(trace.lines.length > 0, id);
        for (const line of trace.lines) assert.ok(line.trim().length > 0, id);
      }
    }
  });

  test("at each stop it always has something to say: every talk has lines, and the last has no condition", () => {
    for (const id of NPC_IDS) {
      for (const { talk } of NPCS[id].stops) {
        assert.equal(talk.at(-1)?.when, undefined, id);
        for (const { lines } of talk) {
          assert.ok(lines.length > 0, id);
          for (const line of lines) assert.ok(line.trim().length > 0, id);
        }
      }
    }
  });
});
