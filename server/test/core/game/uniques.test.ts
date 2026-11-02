import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { addItem, bagCounts, emptyBag, FIXED_DT, UNIQUE_ITEMS, type ItemId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import { UNIQUE_HOLD_MS, Uniques } from "../../../src/core/game/uniques.js";
import { PILE_LIFETIME_MS } from "../../../src/core/overworld/piles.js";
import type { Account, PlayerSave } from "../../../src/core/ports.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { ACCOUNT } from "./helpers.js";

before(() => initPhysics());

const UNIQUE = UNIQUE_ITEMS[0]!;
const OTHER: Account = { id: "player-2", username: "other" };

const carrying = (item: ItemId): PlayerSave =>
  ({ ...newPlayer(), character: TEST_CHARACTER, bag: addItem(emptyBag(), item, 1).bag });

async function loaded(store = new MemoryPlayerStore(), inPlay: ItemId[] = []) {
  const uniques = new Uniques(store, () => inPlay);
  await uniques.ready;
  return { uniques, store, inPlay };
}

describe("a unique thing", () => {
  test("is free while nobody holds it and it lies nowhere", async () => {
    const { uniques } = await loaded();
    assert.equal(uniques.isFree(UNIQUE), true);
  });

  test("isn't free before the holders are loaded", () => {
    const uniques = new Uniques(new MemoryPlayerStore(), () => []);
    assert.equal(uniques.isFree(UNIQUE), false);
  });

  test("isn't free while it's in play: in a pile, a bag or on a cloth", async () => {
    const { uniques } = await loaded(undefined, [UNIQUE]);
    assert.equal(uniques.isFree(UNIQUE), false);
  });

  test("saving a player who carries it makes them its holder, in the store too", async () => {
    const { uniques, store } = await loaded();
    uniques.saved(ACCOUNT.id, carrying(UNIQUE));
    assert.equal(uniques.isFree(UNIQUE), false);
    assert.equal(store.holds.get(UNIQUE), ACCOUNT.id);
    assert.deepEqual(bagCounts(uniques.kept(ACCOUNT.id, carrying(UNIQUE)).bag), { [UNIQUE]: 1 });
  });

  test("a holder's save without it lets it go", async () => {
    const { uniques, store } = await loaded();
    uniques.saved(ACCOUNT.id, carrying(UNIQUE));
    uniques.saved(ACCOUNT.id, newPlayer());
    assert.equal(uniques.isFree(UNIQUE), true);
    assert.equal(store.holds.has(UNIQUE), false);
  });

  test("can change hands: whoever saves with it last holds it", async () => {
    const { uniques, store } = await loaded();
    uniques.saved(ACCOUNT.id, carrying(UNIQUE));
    uniques.saved(ACCOUNT.id, newPlayer());
    uniques.saved(OTHER.id, carrying(UNIQUE));
    assert.equal(store.holds.get(UNIQUE), OTHER.id);
    assert.deepEqual(bagCounts(uniques.kept(OTHER.id, carrying(UNIQUE)).bag), { [UNIQUE]: 1 });
  });

  test("a copy in a save of someone who doesn't hold it is taken out as they load", async () => {
    const { uniques } = await loaded();
    uniques.saved(OTHER.id, carrying(UNIQUE));
    const save = carrying(UNIQUE);
    save.equipment = { ...save.equipment, rightHand: "sword" };
    const kept = uniques.kept(ACCOUNT.id, { ...save, bag: addItem(save.bag, "boar-meat", 2).bag });
    assert.deepEqual(bagCounts(kept.bag), { "boar-meat": 2 });
    assert.equal(kept.equipment.rightHand, "sword");
  });

  test("goes back to the world once its holder hasn't been on for 7 days, and leaves their save", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const { uniques, store } = await loaded();
    uniques.saved(ACCOUNT.id, carrying(UNIQUE));
    t.mock.timers.tick(UNIQUE_HOLD_MS - 1);
    assert.equal(uniques.isFree(UNIQUE), false);
    t.mock.timers.tick(1);
    assert.equal(uniques.isFree(UNIQUE), true);
    assert.deepEqual(bagCounts(uniques.kept(ACCOUNT.id, carrying(UNIQUE)).bag), {});
    assert.equal(store.holds.has(UNIQUE), false);
  });

  test("its holder is read back from the store, as of their last save", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const store = new MemoryPlayerStore();
    await store.save(ACCOUNT.id, carrying(UNIQUE));
    await store.holdUnique(UNIQUE, ACCOUNT.id);
    t.mock.timers.tick(UNIQUE_HOLD_MS - 1);
    const { uniques } = await loaded(store);
    assert.equal(uniques.isFree(UNIQUE), false);
    t.mock.timers.tick(1);
    assert.equal(uniques.isFree(UNIQUE), true);
  });
});

describe("unique things among the players online", () => {
  async function online(saves: [Account, PlayerSave][], holder: Account | null = null) {
    const store = new MemoryPlayerStore();
    for (const [account, save] of saves) await store.save(account.id, save);
    if (holder) await store.holdUnique(UNIQUE, holder.id);
    const players = new OnlinePlayers(store, true, 50);
    const join = async (account: Account) => {
      const session = await players.join(new FakeLink(), account);
      assert.ok(session);
      return session;
    };
    return { store, players, join };
  }

  test("one carried by a player online isn't free", async () => {
    const { players, join } = await online([[ACCOUNT, carrying(UNIQUE)]], ACCOUNT);
    await join(ACCOUNT);
    assert.equal(players.uniques.isFree(UNIQUE), false);
  });

  test("a player joining with a copy someone else holds loses it", async () => {
    const { join } = await online([[OTHER, carrying(UNIQUE)], [ACCOUNT, carrying(UNIQUE)]], OTHER);
    const session = await join(ACCOUNT);
    assert.deepEqual(bagCounts(session.bag), {});
  });

  test("one lying in a pile is free again once the pile vanishes", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const { players, join } = await online([[ACCOUNT, { ...newPlayer(), character: TEST_CHARACTER }]]);
    const session = await join(ACCOUNT);
    session.overworld.dropPile(session.overworld.playerPos(session.me), { [UNIQUE]: 1 });
    assert.equal(players.uniques.isFree(UNIQUE), false);
    t.mock.timers.tick(PILE_LIFETIME_MS);
    players.tick(FIXED_DT);
    assert.equal(players.uniques.isFree(UNIQUE), true);
  });
});
