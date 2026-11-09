import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BOW, ITEMS, weaponDamage, WEAPONS, type BagItem, type ItemId } from "@infinite-tower/shared";
import { formatWeight, itemInfo } from "../../../../src/ui/hud/inventory/itemInfo.js";

const stack = (item: ItemId, count = 1, turned = false): BagItem => ({ item, count, x: 0, y: 0, turned });

describe("itemInfo (the tooltip)", () => {
  test("names the item and how many there are", () => {
    assert.equal(itemInfo(stack("boar-meat", 3)).name, `${ITEMS["boar-meat"].name} ×3`);
    assert.equal(itemInfo(stack("boar-hide")).name, ITEMS["boar-hide"].name);
  });

  test("gives its size in cells as it lies", () => {
    const { cols, rows } = ITEMS["boar-tusk"];
    assert.equal(itemInfo(stack("boar-tusk")).size, `${cols} × ${rows}`);
    assert.equal(itemInfo(stack("boar-tusk", 1, true)).size, `${rows} × ${cols}`);
  });

  test("gives its weight, and a stack's in all", () => {
    assert.equal(itemInfo(stack("boar-tusk")).weight, formatWeight(ITEMS["boar-tusk"].weight));
    const each = ITEMS["boar-meat"].weight;
    const all = formatWeight(3 * each);
    assert.equal(itemInfo(stack("boar-meat", 3)).weight, `${formatWeight(each)} each, ${all} in all`);
  });

  test("says what it does: food how much it heals and how long it takes to eat; other things nothing", () => {
    const food = itemInfo(stack("boar-meat")).effect ?? "";
    const { useTime, effects } = ITEMS["boar-meat"].consumable;
    assert.match(food, new RegExp(`Heals ${effects[0].healShare * 100}% of your HP`));
    assert.match(food, new RegExp(`Takes ${useTime} s`));
    assert.doesNotMatch(food, /mid-fight/);
    assert.equal(itemInfo(stack("boar-hide")).effect, null);
  });

  test("essence says it's absorbed into the core, and how long that takes", () => {
    const essence = itemInfo(stack("boar-essence")).effect ?? "";
    assert.match(essence, /into your core/);
    assert.match(essence, new RegExp(`Takes ${ITEMS["boar-essence"].consumable.useTime} s`));
  });

  test("the sword and the skillbook say what holding them lets you do", () => {
    assert.equal(itemInfo(stack("sword")).effect,
      `In a hand: light and heavy attacks, and a guard. Needs ${WEAPONS.sword.minStrength} strength.`);
    assert.equal(itemInfo(stack("skillbook")).effect, "In a hand: quick-cast skills.");
  });

  test("a bow says it's drawn, takes both hands, how fast it shoots and where its arrows come from", () => {
    const bow = itemInfo(stack("training-bow")).effect ?? "";
    assert.match(bow, /drawn and loosed/);
    assert.match(bow, /both hands/);
    assert.match(bow, new RegExp(`${WEAPONS["training-bow"].powerMps} m/s`));
    assert.match(bow, /arrows from your quiver, else your bag/);
    assert.match(itemInfo(stack("arrow")).effect ?? "", /from a bow.*quiver first/);
  });

  test("a quiver says where it's worn, how many arrows its cell holds, and that they're nocked quicker", () => {
    const { holds } = ITEMS["training-quiver"].pack;
    const quiver = itemInfo(stack("training-quiver")).effect ?? "";
    assert.match(quiver, /^Worn at your hip/);
    assert.match(quiver, new RegExp(`${holds.stackSize} arrows`));
    assert.match(quiver, new RegExp(`${BOW.nock.quiverTime} s`));
    assert.match(quiver, new RegExp(`${BOW.nock.bagTime} s`));
  });

  test("a weapon gives its damage by type, Slash · Stab · Blunt, leaving out a type it doesn't deal", () => {
    const sword = weaponDamage(WEAPONS.sword), stick = weaponDamage(WEAPONS["old-stick"]);
    assert.equal(itemInfo(stack("sword")).damage, `Slash ${sword.slash} · Stab ${sword.stab} · Blunt ${sword.blunt}`);
    assert.equal(stick.slash, 0);
    assert.equal(itemInfo(stack("old-stick")).damage, `Stab ${stick.stab} · Blunt ${stick.blunt}`);
    assert.equal(itemInfo(stack("training-bow")).damage, `Stab ${weaponDamage(WEAPONS["training-bow"]).stab}`);
    assert.equal(itemInfo(stack("wooden-shield")).damage, null);
    assert.equal(itemInfo(stack("boar-meat")).damage, null);
  });

  test("a weapon that needs strength says how much", () => {
    assert.ok(itemInfo(stack("greatsword")).effect?.endsWith(`Needs ${WEAPONS.greatsword.minStrength} strength.`));
    assert.ok(!itemInfo(stack("old-stick")).effect?.includes("strength"));
  });

  test("gives its rarity", () => {
    assert.equal(itemInfo(stack("wolf-fang")).rarity, "common");
    assert.equal(itemInfo(stack("bog-pearl")).rarity, "rare");
  });

  test("a backpack says where it's worn and how big a grid it brings; a cosmetic that it's looks only", () => {
    const { cols, rows } = ITEMS["canvas-backpack"].pack;
    const grid = `a grid of ${cols} × ${rows} of its own`;
    assert.equal(itemInfo(stack("canvas-backpack")).effect, `Worn on your back: ${grid}.`);
    assert.equal(itemInfo(stack("feathered-hat")).effect, "Worn over your cap: it changes only how you look.");
    assert.equal(itemInfo(stack("copper-ring")).effect, "Worn on a finger.");
  });

  test("a sigil says it's to be carved into the core", () => {
    assert.match(itemInfo(stack("sigil-of-embers")).effect ?? "", /carve it into your core/);
    assert.doesNotMatch(itemInfo(stack("sigil-of-embers")).effect ?? "", /not yet/);
  });

  test("weights show one decimal place at most", () => {
    assert.equal(formatWeight(12), "12");
    assert.equal(formatWeight(12.5), "12.5");
    assert.equal(formatWeight(0.1 + 0.2), "0.3");
  });
});
