import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { bagCounts, emptyBag, FIXED_DT, IDLE_INPUT, Player, type Character } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import type { Account } from "../../../src/core/ports.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/world.js";
import { ACCOUNT, HOLLOW } from "./helpers.js";

before(() => initPhysics());

const OTHER: Account = { id: "player-2", username: "Other" };
const OTHER_CHARACTER: Character = { ...TEST_CHARACTER, name: "Wren" };
const sent = (link: FakeLink) => link.sent.map((m) => m.t);

async function twoPlayers(cheats = true) {
  const store = new MemoryPlayerStore();
  store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER, pad: HOLLOW });
  store.saved.set(OTHER.id, { ...newPlayer(), character: OTHER_CHARACTER, pad: HOLLOW });
  const online = new OnlinePlayers(store, cheats, 50);
  const join = async (account: Account) => {
    const link = new FakeLink();
    const session = await online.join(link, account);
    assert.ok(session);
    return { link, session };
  };
  return { online, store, a: await join(ACCOUNT), b: await join(OTHER) };
}

describe("give to a username", () => {
  test("with no username it gives to the one who asked, as before", async () => {
    const { a, b } = await twoPlayers();
    a.session.cheat({ kind: "give", item: "boar-meat", count: 2 });
    assert.deepEqual(bagCounts(a.session.bag), { "boar-meat": 2 });
    assert.deepEqual(b.session.bag, emptyBag());
    assert.equal(a.link.last("given").count, 2);
    assert.ok(!sent(b.link).includes("given"));
  });

  test("naming yourself is the same as naming nobody", async () => {
    const { a } = await twoPlayers();
    a.session.cheat({ kind: "give", item: "boar-meat", count: 1, to: ACCOUNT.username });
    assert.deepEqual(bagCounts(a.session.bag), { "boar-meat": 1 });
    assert.equal(a.link.last("given").from, undefined);
  });

  test("a named player gets the items, is told who gave them, and the giver is told it went", async () => {
    const { a, b, store } = await twoPlayers();
    a.session.cheat({ kind: "give", item: "boar-meat", count: 3, to: "other" });
    assert.deepEqual(bagCounts(b.session.bag), { "boar-meat": 3 }, "the username is matched ignoring case");
    assert.deepEqual(a.session.bag, emptyBag());
    const given = b.link.last("given");
    assert.deepEqual([given.item, given.count, given.left, given.from], ["boar-meat", 3, 0, TEST_CHARACTER.name]);
    assert.deepEqual(given.gear, b.session.gear);
    const gave = a.link.last("gave");
    assert.deepEqual([gave.to, gave.item, gave.count, gave.left], [OTHER.username, "boar-meat", 3, 0]);
    assert.ok(!sent(a.link).includes("given"), "the giver's own bag is untouched, so it isn't sent one");
    b.session.saveSoon();
    b.session.disconnect();
    assert.deepEqual(bagCounts(store.saved.get(OTHER.id)!.bag), { "boar-meat": 3 });
  });

  test("a named player in a fight gets it in the fight's bag", async () => {
    const { a, b, online } = await twoPlayers();
    b.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    const fight = b.session.battle!.room.fight;
    const step = fight.steps + 1;
    b.session.battleInput(step, [{ step, ...IDLE_INPUT }]);
    online.tick(FIXED_DT);
    a.session.cheat({ kind: "give", item: "boar-meat", count: 2, to: OTHER.username });
    assert.deepEqual(bagCounts(fight.world.require(fight.players[0]!, Player).gear.bag), { "boar-meat": 2 });
    assert.equal(b.link.last("given").from, TEST_CHARACTER.name);
  });

  test("an unknown or offline name gives nothing and tells the giver", async () => {
    const { a, b, online } = await twoPlayers();
    a.session.cheat({ kind: "give", item: "boar-meat", count: 3, to: "nobody" });
    assert.deepEqual(a.link.last("giveRefused"), { t: "giveRefused", to: "nobody" });
    online.leave(b.session);
    a.session.cheat({ kind: "give", item: "boar-meat", count: 3, to: OTHER.username });
    assert.deepEqual(a.link.last("giveRefused"), { t: "giveRefused", to: OTHER.username });
    assert.deepEqual(a.session.bag, emptyBag());
    assert.deepEqual(b.session.bag, emptyBag());
    assert.ok(!sent(a.link).includes("gave"));
  });

  test("without CHEATS a named give is ignored too", async () => {
    const { a, b } = await twoPlayers(false);
    a.session.cheat({ kind: "give", item: "boar-meat", count: 3, to: OTHER.username });
    assert.deepEqual(b.session.bag, emptyBag());
    for (const t of ["given", "gave", "giveRefused"] as const) {
      assert.ok(!sent(a.link).includes(t) && !sent(b.link).includes(t), t);
    }
  });
});
