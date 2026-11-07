import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GODS, type Cheat, type DayChange } from "@infinite-tower/shared";
import {
  applySavedCheats, CHEATS_KEY, DEFAULT_CHEATS, loadCheats, rememberCheat, saveCheats, type CheatStorage,
} from "../../../../src/ui/screens/admin/admin.js";

class MemoryStorage implements CheatStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
}

const storing = (raw: string) => {
  const storage = new MemoryStorage();
  storage.setItem(CHEATS_KEY, raw);
  return storage;
};

describe("saved cheats", () => {
  test("with nothing saved, keep inventory is on and everything else is off or at its first value", () => {
    const loaded = loadCheats(new MemoryStorage());
    assert.deepEqual(loaded, DEFAULT_CHEATS);
    assert.equal(loaded.keepInventory, true);
    assert.equal(loaded.invulnerable, false);
  });

  test("bad JSON, another version or no object at all: the defaults", () => {
    const otherVersion = JSON.stringify({ ...DEFAULT_CHEATS, invulnerable: true, v: 99 });
    for (const raw of ["{", "null", "7", "\"text\"", otherVersion]) {
      assert.deepEqual(loadCheats(storing(raw)), DEFAULT_CHEATS, raw);
    }
  });

  test("a bad value falls back to its default and keeps the rest", () => {
    const storage = new MemoryStorage();
    saveCheats(storage, { invulnerable: true });
    const saved = JSON.parse(storage.getItem(CHEATS_KEY)!);
    storage.setItem(CHEATS_KEY, JSON.stringify({ ...saved, daySpeed: 7, keepInventory: "yes" }));
    assert.deepEqual(loadCheats(storage), { ...DEFAULT_CHEATS, invulnerable: true });
  });

  test("what's saved comes back, all under one key", () => {
    const storage = new MemoryStorage();
    saveCheats(storage, { invulnerable: true, daySpeed: 60 });
    saveCheats(storage, { keepInventory: false, giveCount: 20 });
    assert.deepEqual([...storage.items.keys()], [CHEATS_KEY]);
    assert.deepEqual(loadCheats(storage), { invulnerable: true, keepInventory: false, daySpeed: 60, giveCount: 20 });
  });

  test("the toggles are remembered as they're sent; the one-shot cheats never are", () => {
    const oneShots: Cheat[] = [
      { kind: "encounter", enemy: "wild-boar" }, { kind: "give", item: "boar-meat", count: 5 }, { kind: "heal" },
      { kind: "coreStep", add: true }, { kind: "completeQuest" }, { kind: "resetSave" },
      { kind: "faith", god: GODS[0] }, { kind: "kill" },
    ];
    const storage = new MemoryStorage();
    for (const cheat of oneShots) rememberCheat(storage, cheat);
    assert.equal(storage.items.size, 0);
    rememberCheat(storage, { kind: "invulnerable", on: true });
    rememberCheat(storage, { kind: "keepInventory", on: false });
    assert.deepEqual(loadCheats(storage), { ...DEFAULT_CHEATS, invulnerable: true, keepInventory: false });
    assert.deepEqual(Object.keys(JSON.parse(storage.getItem(CHEATS_KEY)!)).sort(),
      ["v", ...Object.keys(DEFAULT_CHEATS)].sort());
  });

  test("on joining, the saved toggles go to the server and the day speed is set", () => {
    const storage = new MemoryStorage();
    saveCheats(storage, { invulnerable: true, daySpeed: 600, giveCount: 5 });
    const sent: Cheat[] = [], clock: DayChange[] = [];
    applySavedCheats(storage, (cheat) => sent.push(cheat), (change) => clock.push(change));
    assert.deepEqual(sent, [{ kind: "invulnerable", on: true }, { kind: "keepInventory", on: true }]);
    assert.deepEqual(clock, [{ speed: 600 }]);
  });

  test("on a first join, keep inventory goes to the server on", () => {
    const sent: Cheat[] = [];
    applySavedCheats(new MemoryStorage(), (cheat) => sent.push(cheat), () => {});
    assert.deepEqual(sent.find((c) => c.kind === "keepInventory"), { kind: "keepInventory", on: true });
  });
});
