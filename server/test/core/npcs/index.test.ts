import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NPC_IDS } from "@infinite-tower/shared";
import { NPCS } from "../../../src/core/npcs/index.js";
import { LEVELS } from "../../../src/core/world/index.js";
import type { LevelDef } from "../../../src/core/world/level.js";

describe("NPCS", () => {
  test("each has something to say", () => {
    for (const id of NPC_IDS) {
      assert.ok(NPCS[id].lines.length > 0, id);
      for (const line of NPCS[id].lines) assert.ok(line.trim().length > 0, id);
    }
  });

  test("each stands in a level", () => {
    const placed = (Object.values(LEVELS) as LevelDef[]).flatMap((level) => level.layout.npcs.map(({ npc }) => npc));
    for (const id of NPC_IDS) assert.ok(placed.includes(id), id);
  });
});
