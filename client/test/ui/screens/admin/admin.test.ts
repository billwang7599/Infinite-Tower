import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GODS, type Cheat, type DayChange } from "@infinite-tower/shared";
import {
  act, applySavedCheats, CHEATS_KEY, DEFAULT_CHEATS, loadCheats, rememberCheat, saveCheats, whyNot,
  type AdminOutlet, type CheatStorage,
} from "../../../../src/ui/screens/admin/admin.js";
import { UiState } from "../../../../src/ui/state.js";

class MemoryStorage implements CheatStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
}

function outlet(storage: CheatStorage = new MemoryStorage()) {
  const sent: Cheat[] = [], clock: DayChange[] = [];
  const to: AdminOutlet = {
    storage, admin: new UiState().admin, send: (cheat) => sent.push(cheat), setDayClock: (change) => clock.push(change),
  };
  return { to, sent, clock };
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
    const { to, sent, clock } = outlet(storage);
    applySavedCheats(to);
    assert.deepEqual(sent, [{ kind: "invulnerable", on: true }, { kind: "keepInventory", on: true }]);
    assert.deepEqual(clock, [{ speed: 600 }]);
    assert.equal(to.admin.get().daySpeed, 600);
  });

  test("on a first join, keep inventory goes to the server on", () => {
    const { to, sent } = outlet();
    applySavedCheats(to);
    assert.deepEqual(sent.find((c) => c.kind === "keepInventory"), { kind: "keepInventory", on: true });
  });
});

describe("what the panel and the commands both do", () => {
  test("a cheat goes to the server, and a toggle is remembered", () => {
    const { to, sent } = outlet();
    act(to, { cheat: { kind: "heal" } });
    act(to, { cheat: { kind: "invulnerable", on: true } });
    assert.deepEqual(sent, [{ kind: "heal" }, { kind: "invulnerable", on: true }]);
    assert.equal(loadCheats(to.storage).invulnerable, true);
  });

  test("the time of day is only drawn; its speed is saved and shown in the panel too", () => {
    const { to, sent, clock } = outlet();
    act(to, { dayTime: 0.8 });
    act(to, { daySpeed: 60 });
    assert.deepEqual(clock, [{ fraction: 0.8 }, { speed: 60 }]);
    assert.deepEqual(sent, []);
    assert.equal(loadCheats(to.storage).daySpeed, 60);
    assert.equal(to.admin.get().daySpeed, 60);
  });

  test("fights, quests, faith and the reset are overworld only; kill needs enemies to fight", () => {
    const overworld = { mode: "overworld", againstEnemies: false } as const;
    const fighting = { mode: "battle", againstEnemies: true } as const;
    for (const kind of ["encounter", "completeQuest", "faith", "resetSave"] as const) {
      assert.equal(whyNot(kind, overworld), null, kind);
      assert.equal(whyNot(kind, fighting), "Only in the overworld.", kind);
    }
    assert.equal(whyNot("kill", fighting), null);
    assert.equal(whyNot("kill", overworld), "No enemy to kill here.");
    assert.equal(whyNot("kill", { mode: "battle", againstEnemies: false }), "No enemy to kill here.");
    for (const kind of ["heal", "give", "coreStep", "invulnerable", "keepInventory"] as const) {
      assert.equal(whyNot(kind, fighting), null, kind);
      assert.equal(whyNot(kind, overworld), null, kind);
    }
  });
});
