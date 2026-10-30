import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";

describe("LORE", () => {
  test("each entry has a title and text, and a quest step reveals it", () => {
    const revealed = Object.values(QUESTS).flatMap((q) => q.steps.flatMap((s) => s.reward?.lore ?? []));
    for (const [id, entry] of Object.entries(LORE)) {
      assert.ok(entry.title.trim() && entry.text.trim(), id);
      assert.ok(revealed.includes(id as keyof typeof LORE), id);
    }
  });
});
