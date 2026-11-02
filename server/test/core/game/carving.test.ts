import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bagCounts, COIN_VALUE, itemDef, newCore, sigilOf, type Bag, type CoreState, type InscriptionId, type ItemCounts,
  type UseSpot,
} from "@infinite-tower/shared";
import { CARVE_PRICES, REMOVE_PRICE_FACTOR } from "../../../src/core/content/shops.js";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { Uniques } from "../../../src/core/game/uniques.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { newPlayer } from "../../../src/core/content/player.js";
import type { PlayerSave } from "../../../src/core/ports.js";
import { MemoryPlayerStore } from "../../fixtures/fakes.js";
import { ACCOUNT, bagWith, startIn, talkTo } from "./helpers.js";

const GOLD = COIN_VALUE["gold-coin"];
const carveFor = (id: InscriptionId) => CARVE_PRICES[itemDef(sigilOf(id)).rarity];
const removeFor = (id: InscriptionId) => {
  const { copper, essence } = carveFor(id);
  return { copper: copper * REMOVE_PRICE_FACTOR.copper, essence: essence * REMOVE_PRICE_FACTOR.essence };
};
const withCarved = (...inscriptions: InscriptionId[]): CoreState => ({ ...newCore(), inscriptions });

function atCollegium(bag: Bag, saved: Partial<PlayerSave> = {}) {
  const started = startIn("market-ward", { saved: { bag, ...saved } });
  const said = talkTo(started.session, started.link, "carver");
  started.session.openShop();
  return { ...started, said };
}

function spotOf(bag: Bag, item: string): UseSpot {
  const stack = bag.items.find((s) => s.item === item);
  assert.ok(stack, item);
  return { in: "bag", x: stack.x, y: stack.y };
}

const rich = (more: ItemCounts = {}) => bagWith({ "gold-coin": 10, "boar-essence": 10, ...more });

describe("the Collegium's carver", () => {
  test("stands in the Market Ward, offering carving, its prices by rarity", () => {
    assert.equal(stopFor(newStory(), NPCS.carver)?.level, "market-ward");
    const { said, link } = atCollegium(rich());
    assert.equal(said.offer?.kind, "shop");
    const carving = link.last("shop").shop?.carving;
    assert.ok(carving);
    assert.deepEqual(carving.carve, CARVE_PRICES);
  });

  test("carves a sigil into the core: the sigil, coins and essence used up, the core sent and saved", () => {
    const bag = rich({ "sigil-of-grit": 1 });
    const { session, link, saves } = atCollegium(bag);
    session.carve(spotOf(bag, "sigil-of-grit"));
    assert.deepEqual(session.core.inscriptions, ["grit"]);
    assert.deepEqual(link.last("core").core.inscriptions, ["grit"]);
    const price = carveFor("grit"), left = 10 * GOLD - price.copper;
    const counts = bagCounts(session.bag);
    assert.equal(counts["sigil-of-grit"], undefined);
    assert.equal(counts["boar-essence"], 10 - price.essence);
    const money = (counts["gold-coin"] ?? 0) * GOLD + (counts["silver-coin"] ?? 0) * COIN_VALUE["silver-coin"]
      + (counts["copper-coin"] ?? 0);
    assert.equal(money, left);
    assert.deepEqual(link.last("trade").news, { kind: "carved", inscription: "grit", price });
    session.disconnect();
    assert.deepEqual(saves.at(-1)?.core.inscriptions, ["grit"]);
  });

  test("essence is paid cheapest first, off the cloth before the bag", () => {
    const bag = bagWith({ "gold-coin": 10, "sigil-of-grit": 1, "kobold-swordsman-essence": 5, "boar-essence": 1 });
    const { session } = atCollegium(bag);
    session.carve(spotOf(bag, "sigil-of-grit"));
    const counts = bagCounts(session.bag);
    assert.equal(counts["boar-essence"], undefined);
    assert.equal(counts["kobold-swordsman-essence"], 5 - (carveFor("grit").essence - 1));
  });

  test("refuses, changing nothing, without the coins, the essence, a free slot, or if it's carved already", () => {
    const cases: [Bag, CoreState, string][] = [
      [bagWith({ "sigil-of-grit": 1, "boar-essence": 10 }), newCore(), "tooPoor"],
      [bagWith({ "sigil-of-grit": 1, "gold-coin": 10 }), newCore(), "noEssence"],
      [rich({ "sigil-of-grit": 1 }), withCarved("embers"), "noSlot"],
      [rich({ "sigil-of-grit": 1 }), { ...withCarved("grit"), steps: 1 }, "carved"],
    ];
    for (const [bag, core, reason] of cases) {
      const { session, link } = atCollegium(bag, { core });
      session.carve(spotOf(bag, "sigil-of-grit"));
      assert.deepEqual(link.last("trade").news, { kind: "refused", reason }, reason);
      assert.deepEqual(session.bag, bag, reason);
      assert.deepEqual(session.core, core, reason);
    }
  });

  test("only carves sigils, and only at the Collegium", () => {
    const bag = rich({ "boar-meat": 1, "sigil-of-grit": 1 });
    const { session } = atCollegium(bag);
    session.carve(spotOf(bag, "boar-meat"));
    assert.deepEqual(session.bag, bag);
    const smith = startIn("market-ward", { saved: { bag } });
    talkTo(smith.session, smith.link, "smith");
    smith.session.openShop();
    smith.session.carve(spotOf(bag, "sigil-of-grit"));
    assert.deepEqual(smith.session.core.inscriptions, []);
  });

  test("removing one costs far more, and it's gone: no sigil comes back", () => {
    const bag = rich();
    const { session, link } = atCollegium(bag, { core: withCarved("grit") });
    session.uncarve("grit");
    assert.deepEqual(session.core.inscriptions, []);
    const price = removeFor("grit"), counts = bagCounts(session.bag);
    assert.ok(price.copper > carveFor("grit").copper && price.essence > carveFor("grit").essence);
    assert.equal(counts["sigil-of-grit"], undefined);
    assert.equal(counts["boar-essence"], 10 - price.essence);
    assert.deepEqual(link.last("trade").news, { kind: "uncarved", inscription: "grit", price });
  });

  test("won't remove what isn't carved, or without the price", () => {
    const { session, link } = atCollegium(rich());
    session.uncarve("grit");
    assert.deepEqual(link.last("trade").news, { kind: "refused", reason: "notCarved" });
    const poor = atCollegium(bagWith({ "boar-essence": 10 }), { core: withCarved("grit") });
    poor.session.uncarve("grit");
    assert.deepEqual(poor.session.core.inscriptions, ["grit"]);
  });
});

describe("a carved unique inscription", () => {
  const carvedDoor = (): PlayerSave => ({ ...newPlayer(), core: withCarved("first-door") });
  const DOOR = sigilOf("first-door");

  test("holds its unique thing like carrying the sigil does", async () => {
    const store = new MemoryPlayerStore(), uniques = new Uniques(store, () => []);
    await uniques.ready;
    uniques.saved(ACCOUNT.id, carvedDoor());
    assert.equal(uniques.isFree(DOOR), false);
    assert.deepEqual(uniques.kept(ACCOUNT.id, carvedDoor()).core.inscriptions, ["first-door"]);
    uniques.saved(ACCOUNT.id, newPlayer());
    assert.equal(uniques.isFree(DOOR), true, "removed, it's free again");
  });

  test("is taken off a core whose player doesn't hold it as they load", async () => {
    const store = new MemoryPlayerStore(), uniques = new Uniques(store, () => []);
    await uniques.ready;
    uniques.saved("someone-else", carvedDoor());
    assert.deepEqual(uniques.kept(ACCOUNT.id, carvedDoor()).core.inscriptions, []);
  });
});
