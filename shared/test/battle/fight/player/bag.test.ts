import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  emptyBag, FIXED_DT, Health, Player, SAVE_IN_FIGHT_TIME, starterEquipment, Wielder, type Bag, type Carried,
  type GearMove, type Spell, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BITER, bodyOf, enemy, IDLE, input, player, run, segment, spell, STATUE } from "../fixtures.js";

await initPhysics();

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const BAG = input({ bag: true });
const RIGHT_HAND = { in: "slot", slot: "rightHand" } as const;
const UNEQUIP_SWORD: GearMove = { from: RIGHT_HAND, to: { in: "bag", x: 0, y: 0 }, turned: false };
const EQUIP_SWORD: GearMove = { from: { in: "bag", x: 0, y: 0 }, to: RIGHT_HAND, turned: false };
const NOVA: Spell = spell(segment("nova", ["fire"]));

function alone(gear?: Carried): Fight {
  return new Fight({
    arena: ARENA, players: [player(at(0, -4), gear && { gear })], enemies: [enemy(STATUE, at(0, 6))],
  });
}
const playerOf = (fight: Fight) => fight.world.require(fight.players[0]!, Player);
const handsOf = (fight: Fight) => fight.world.require(fight.players[0]!, Wielder).hands;
const flatPos = (fight: Fight) => {
  const { x, z } = bodyOf(fight, fight.players[0]!).pos;
  return { x, z };
};
function moveInBag(fight: Fight, move: GearMove): void {
  fight.step([BAG]);
  fight.step([input({ bag: true, gear: move })]);
  fight.step([BAG]);
}
const swings = (fight: Fight): boolean => {
  fight.step([IDLE]);
  run(fight, 0.1, (i) => input({ attack: i === 0 ? "lr" : null }));
  return playerOf(fight).action === "attack";
};

describe("the bag in a fight", () => {
  test("the bag input opens it; while it's open the player stands still", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([BAG]);
    assert.equal(playerOf(fight).action, "bag");
    const before = flatPos(fight);
    run(fight, 0.5, () => input({ bag: true, moveX: 1 }));
    assert.equal(playerOf(fight).action, "bag");
    const after = flatPos(fight);
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.01, "stood still");
  });

  test("letting go of it closes the bag, and the player walks again", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([BAG]);
    fight.step([IDLE]);
    assert.equal(playerOf(fight).action, "none");
    const before = flatPos(fight);
    run(fight, 0.3, () => input({ moveX: 1 }));
    assert.ok(flatPos(fight).x - before.x > 0.3);
  });

  test("the sword put in the bag: it's out of hand at once, and the player can't swing until it's back", () => {
    const fight = alone();
    run(fight, 0.3);
    moveInBag(fight, UNEQUIP_SWORD);
    const { gear } = playerOf(fight);
    assert.equal(gear.equipment.rightHand, null);
    assert.deepEqual(gear.bag.items, [{ item: "sword", count: 1, x: 0, y: 0, turned: false }]);
    assert.equal(handsOf(fight).rightHand, null);
    assert.equal(swings(fight), false);
    run(fight, 0.5);
    moveInBag(fight, EQUIP_SWORD);
    assert.equal(playerOf(fight).gear.equipment.rightHand, "sword");
    assert.equal(swings(fight), true);
  });

  test("the spellbook put away: no chant", () => {
    const fight = alone();
    run(fight, 0.3);
    moveInBag(fight, { from: { in: "slot", slot: "leftHand" }, to: { in: "bag", x: 0, y: 0 }, turned: false });
    assert.equal(handsOf(fight).leftHand, null);
    fight.step([IDLE]);
    fight.step([input({ chant: true })]);
    assert.equal(playerOf(fight).action, "none");
  });

  test("a move is made once, on the step it's first there", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([BAG]);
    run(fight, 0.2, () => input({ bag: true, gear: UNEQUIP_SWORD }));
    assert.equal(playerOf(fight).gear.bag.items.length, 1);
  });

  test("nothing moves with the bag shut", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([input({ gear: UNEQUIP_SWORD })]);
    assert.equal(playerOf(fight).gear.equipment.rightHand, "sword");
  });

  test("a move the bag's rules refuse, or one onto the cloth (there's none in a fight), changes nothing", () => {
    const fight = alone();
    run(fight, 0.3);
    const before = playerOf(fight).gear;
    const outside = { from: RIGHT_HAND, to: { in: "bag", x: 0, y: 2 }, turned: false } as const;
    const onCloth = { from: RIGHT_HAND, to: { in: "cloth", x: 0, y: 0 }, turned: false } as const;
    const onHead = { from: RIGHT_HAND, to: { in: "slot", slot: "head" }, turned: false } as const;
    for (const move of [outside, onCloth, onHead]) moveInBag(fight, move);
    assert.deepEqual(playerOf(fight).gear, before);
  });

  test("the fight starts with the gear the player brings", () => {
    const bag: Bag = { ...emptyBag(), items: [{ item: "boar-meat", count: 2, x: 1, y: 1, turned: false }] };
    const gear = { bag, equipment: { ...starterEquipment(), rightHand: null } };
    const fight = alone(gear);
    assert.deepEqual(playerOf(fight).gear, gear);
    assert.equal(handsOf(fight).rightHand, null);
    assert.equal(handsOf(fight).leftHand, "spellbook");
  });

  test("a hit that stuns closes it, and it stays shut until the bag is asked for again", () => {
    const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(BITER, at(0, 1.5))] });
    fight.step([BAG]);
    assert.equal(playerOf(fight).action, "bag");
    for (let i = 0; i < 3 / FIXED_DT && playerOf(fight).action === "bag"; i++) fight.step([BAG]);
    assert.ok(fight.world.require(fight.players[0]!, Health).hp < 100, "bitten");
    assert.equal(playerOf(fight).brokenOff, true);
    run(fight, 1.5, () => BAG);
    assert.notEqual(playerOf(fight).action, "bag");
    fight.step([IDLE]);
    assert.equal(playerOf(fight).brokenOff, false);
    fight.step([BAG]);
    assert.equal(playerOf(fight).action, "bag");
  });

  test("a dodge closes it and dodges, and it doesn't reopen on its own", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([BAG]);
    fight.step([input({ bag: true, dodge: true, moveX: 1 })]);
    assert.equal(playerOf(fight).action, "dodge");
    assert.equal(playerOf(fight).brokenOff, true);
    run(fight, 1, () => BAG);
    assert.equal(playerOf(fight).action, "none");
  });

  test("a page is written from the bag with the book in hand, taking SAVE_IN_FIGHT_TIME, back to the bag", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([BAG]);
    fight.step([input({ bag: true, write: { page: 1, spell: NOVA } })]);
    assert.equal(playerOf(fight).action, "write");
    run(fight, SAVE_IN_FIGHT_TIME - 2 * FIXED_DT, () => BAG);
    assert.equal(playerOf(fight).book[1], null, "not yet");
    run(fight, 2 * FIXED_DT, () => BAG);
    assert.deepEqual(playerOf(fight).book[1], NOVA);
    assert.equal(playerOf(fight).action, "bag");
  });

  test("without the book in hand, no page is written from the bag", () => {
    const fight = alone({ bag: emptyBag(), equipment: { ...starterEquipment(), leftHand: null } });
    run(fight, 0.3);
    fight.step([BAG]);
    fight.step([input({ bag: true, write: { page: 1, spell: NOVA } })]);
    assert.equal(playerOf(fight).action, "bag");
  });

  test("the gear moved is part of the fight's state: saved, loaded and hashed", () => {
    const fight = alone();
    run(fight, 0.3);
    const untouched = alone();
    run(untouched, 0.3);
    moveInBag(fight, UNEQUIP_SWORD);
    run(untouched, 3 * FIXED_DT, () => BAG);
    const copy = alone();
    copy.load(JSON.parse(JSON.stringify(fight.save())));
    assert.deepEqual(playerOf(copy).gear, playerOf(fight).gear);
    assert.equal(handsOf(copy).rightHand, null);
    assert.equal(copy.hash(), fight.hash());
    assert.notEqual(untouched.hash(), fight.hash());
  });
});
