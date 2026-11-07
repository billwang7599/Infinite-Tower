import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ENEMY_IDS, gripOf, itemDef, ITEMS, UNIQUE_ITEMS, type EnemyId, type ItemEffect, type ItemId,
} from "@infinite-tower/shared";
import { ENEMIES, rollDrops, TREASURE, TREASURE_TIERS } from "../../../src/core/enemies/index.js";
import { touchSystem } from "../../../src/core/overworld/behaviors/touch.js";
import { spawnActor } from "../../../src/core/overworld/parts.js";
import { testOverworld } from "../overworld/helpers.js";

const SPARRING: readonly EnemyId[] = ["training-dummy", "bram"];
const MONSTERS = ENEMY_IDS.filter((id) => !SPARRING.includes(id));

const NONE_FREE = () => false;
const ALL_FREE = () => true;

const treasureRng = (enemy: EnemyId, treasureRoll: number) => {
  const rolls = [...ENEMIES[enemy].drops.map(() => 0.999), treasureRoll];
  return () => rolls.shift() ?? 0;
};

const essenceOf = (item: string): number => {
  const effects: readonly ItemEffect[] = itemDef(item as ItemId).consumable?.effects ?? [];
  return effects.reduce((sum, effect) => sum + ("essence" in effect ? effect.essence : 0), 0);
};

describe("enemies' weapons", () => {
  test("every Kobold holds its weapon in one hand, its off hand emptied too; Bram holds his stick in both", () => {
    const grip = (id: EnemyId) => gripOf({ rightHand: null, ...ENEMIES[id].def.wielder!.hands, leftHand: null });
    for (const id of ["kobold-swordsman", "kobold-greatsword", "kobold-shieldbearer"] as const) {
      assert.equal(grip(id), "one", id);
    }
    assert.equal(grip("bram"), "two");
  });
});

describe("knockback", () => {
  const factorOf = (id: EnemyId) => ENEMIES[id].def.knockbackFactor ?? 1;

  test("the big beasts are pushed less than a Kobold, the bog lurker least; a training dummy not at all", () => {
    const person = factorOf("kobold-swordsman");
    assert.ok(factorOf("wild-boar") < person, "the boar");
    assert.ok(factorOf("bog-lurker") < factorOf("wild-boar"), "the bog lurker");
    assert.equal(factorOf("training-dummy"), 0);
  });

  test("none is pushed further than a person", () => {
    for (const id of ENEMY_IDS) assert.ok(factorOf(id) <= 1, id);
  });
});

describe("rollDrops", () => {
  test("a lowest roll drops boar meat, a hide and a tusk from a wild boar", () => {
    const loot = rollDrops("wild-boar", () => 0, NONE_FREE);
    for (const item of ["boar-meat", "boar-hide", "boar-tusk"] as const) assert.ok((loot[item] ?? 0) >= 1, item);
  });

  test("a highest roll drops only the boar's essence", () => {
    assert.deepEqual(rollDrops("wild-boar", () => 0.999, NONE_FREE), { "boar-essence": 1 });
  });

  test("every enemy always drops one essence of its own", () => {
    const seen = new Set<string>();
    for (const id of MONSTERS) {
      const always = Object.entries(rollDrops(id, () => 0.999, NONE_FREE));
      assert.equal(always.length, 1, id);
      const [item, count] = always[0]!;
      assert.equal(count, 1, id);
      assert.ok(essenceOf(item) > 0, `${id}: ${item} is essence`);
      seen.add(item);
    }
    assert.equal(seen.size, MONSTERS.length, "each its own");
  });

  test("a Kobold's essence is worth more than a boar's", () => {
    const worth = (id: EnemyId) => essenceOf(Object.keys(rollDrops(id, () => 0.999, NONE_FREE))[0]!);
    assert.ok(worth("kobold-swordsman") > worth("wild-boar"));
  });

  test("returns fresh counts each time", () => {
    const a = rollDrops("wild-boar", () => 0, NONE_FREE);
    const b = rollDrops("wild-boar", () => 0, NONE_FREE);
    assert.notEqual(a, b);
    assert.deepEqual(a, b);
  });
});

describe("treasure", () => {
  test("each tier is rarer than the one below it, for every monster", () => {
    for (const id of MONSTERS) {
      const chances = TREASURE_TIERS.map((tier) => ENEMIES[id].treasure[tier] ?? 0);
      for (let i = 1; i < chances.length; i++) assert.ok(chances[i]! < chances[i - 1]!, `${id}: ${TREASURE_TIERS[i]}`);
      assert.ok(chances[0]! < 0.1, id);
    }
  });

  test("sparring partners have none", () => {
    for (const id of SPARRING) assert.deepEqual(ENEMIES[id].treasure, {});
  });

  test("every treasure is of its tier", () => {
    for (const tier of TREASURE_TIERS) {
      assert.ok(TREASURE[tier].length > 0, tier);
      for (const item of TREASURE[tier]) assert.equal(ITEMS[item].rarity, tier, item);
    }
  });

  test("a roll inside a tier's band drops one of its treasures", () => {
    const { treasure } = ENEMIES["kobold-swordsman"];
    const below = (["uncommon", "rare", "epic"] as const).reduce((sum, tier) => sum + (treasure[tier] ?? 0), 0);
    const legendaryBand = below + (treasure.legendary ?? 0) / 2;
    const loot = rollDrops("kobold-swordsman", treasureRng("kobold-swordsman", legendaryBand), ALL_FREE);
    assert.equal(loot[TREASURE.legendary[0]!], 1);
  });

  test("a roll above every band drops no treasure", () => {
    const loot = rollDrops("kobold-swordsman", treasureRng("kobold-swordsman", 0.5), ALL_FREE);
    assert.deepEqual(Object.keys(loot), ["kobold-swordsman-essence"]);
  });

  test("a unique drops only while it's free", () => {
    const total = Object.values(ENEMIES["wild-boar"].treasure).reduce((sum, chance) => sum + chance, 0);
    const uniqueBand = total - 1e-9;
    const free = rollDrops("wild-boar", treasureRng("wild-boar", uniqueBand), ALL_FREE);
    assert.equal(free[UNIQUE_ITEMS[0]!], 1);
    const held = rollDrops("wild-boar", treasureRng("wild-boar", uniqueBand), NONE_FREE);
    assert.deepEqual(Object.keys(held), ["boar-essence"]);
  });
});

describe("ENEMIES", () => {
  test("each is listed under its own id", () => {
    for (const [id, enemy] of Object.entries(ENEMIES)) assert.equal(enemy.def.id, id);
  });

  test("each one's overworld actor starts its own fight when it touches you", () => {
    for (const id of MONSTERS) {
      const enemy = ENEMIES[id];
      const f = testOverworld({ playerAt: { x: 0.5, z: 0 } });
      const e = spawnActor(f.world, enemy.def.id, { x: 0, z: 0 }, enemy.overworld());
      touchSystem(f.ctx)(f.world, 0.1);
      assert.deepEqual(f.encounters, [{ player: f.player, source: e, enemy: id }]);
    }
  });
});
