import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, BOW, drawCost, drawTime, emptyBag, emptyEquipment, FIXED_DT, Health, loosedDamage, packFor, Player,
  Projectile, Stamina, stowedCounts, toSteps, WEAPONS, type PlayerInputData,
} from "@infinite-tower/shared";
import { blocking, Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_STAMINA, input, player, STATS, STATUE } from "../fixtures.js";

before(() => initPhysics());

const BOW_ITEM = WEAPONS["training-bow"];
const MIN_STEPS = toSteps(drawTime(BOW, BOW_ITEM, STATS.strength, "minTime"));
const FULL_STEPS = toSteps(drawTime(BOW, BOW_ITEM, STATS.strength, "fullTime"));
const TARGET = { ...STATUE, maxHp: 10_000 };

function archer(arrows: number, foeAt = 8) {
  const fight = new Fight({
    arena: { ...ARENA, radius: 40 },
    players: [player({ x: 0, y: 0.05, z: 0 }, {
      gear: {
        bag: addItem(emptyBag(), BOW.ammo, arrows).bag, pack: packFor(null),
        equipment: { ...emptyEquipment(), rightHand: "training-bow" },
      },
    })],
    enemies: [enemy(TARGET, { x: 0, y: 0.05, z: foeAt })],
  });
  const me = fight.players[0]!;
  return {
    fight, me, player: fight.world.require(me, Player),
    arrowsLeft: () => stowedCounts(fight.world.require(me, Player).gear)[BOW.ammo] ?? 0,
    flying: () => [...fight.world.query(Projectile)].map(([, a]) => a),
  };
}

type Script = (step: number) => Partial<PlayerInputData>;
function play(fight: Fight, steps: number, script: Script = () => ({})): FightEvent[] {
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    fight.step([input(script(fight.steps + 1))]);
    events.push(...fight.events);
  }
  return events;
}

/** Pressed on step 1, held through step `heldTo`. */
const drawn = (heldTo: number, over: Partial<PlayerInputData> = {}): Script => (s) =>
  ({ ...over, attack: s === 1 ? "light" : null, attackHeld: s <= heldTo });

const damageOf = (events: FightEvent[]) => events.flatMap((ev) => (ev.type === "hit" ? [ev.damage] : []));

describe("drawing a bow", () => {
  test("the light attack held draws it, and letting go looses one arrow from the bag", () => {
    const a = archer(5);
    play(a.fight, 30, drawn(30));
    assert.equal(a.player.action, "draw");
    assert.equal(a.flying().length, 0);
    play(a.fight, 1, drawn(30));
    assert.equal(a.player.action, "loose");
    assert.equal(a.flying().length, 1);
    assert.equal(a.arrowsLeft(), 4);
    play(a.fight, toSteps(BOW.looseRecoverTime));
    assert.equal(a.player.action, "none");
  });

  test("costs its stamina as the draw starts", () => {
    const a = archer(5);
    play(a.fight, 1, drawn(10));
    assert.equal(a.fight.world.require(a.me, Stamina).value, FULL_STAMINA - drawCost(BOW, BOW_ITEM, STATS.strength));
  });

  test("with no arrows it doesn't draw at all", () => {
    const a = archer(0);
    play(a.fight, 20, drawn(20));
    assert.equal(a.player.action, "none");
    assert.equal(a.fight.world.require(a.me, Stamina).value, FULL_STAMINA);
  });

  test("let go before the least draw, it looses once that's reached", () => {
    const a = archer(5);
    play(a.fight, MIN_STEPS, drawn(1));
    assert.equal(a.flying().length, 0);
    play(a.fight, 1);
    assert.equal(a.flying().length, 1);
  });

  test("the arrow's damage grows with the draw, up to the full draw's", () => {
    const quick = archer(5), full = archer(5), over = archer(5);
    const quickHits = damageOf(play(quick.fight, 90, drawn(1, { locked: 0 })));
    const fullHits = damageOf(play(full.fight, FULL_STEPS + 90, drawn(FULL_STEPS + 1, { locked: 0 })));
    const overHits = damageOf(play(over.fight, 3 * FULL_STEPS + 90, drawn(3 * FULL_STEPS, { locked: 0 })));
    assert.equal(quickHits.length, 1);
    assert.ok(Math.abs(quickHits[0]! - loosedDamage(BOW, BOW_ITEM, MIN_STEPS * FIXED_DT, STATS)) < 1e-9);
    assert.deepEqual(fullHits, [loosedDamage(BOW, BOW_ITEM, FULL_STEPS * FIXED_DT, STATS)]);
    assert.deepEqual(overHits, fullHits);
    assert.ok(quickHits[0]! < fullHits[0]!);
  });

  test("can't block while drawing; once loosed, it can", () => {
    const a = archer(5);
    play(a.fight, 20, (s) => ({ ...drawn(20)(s), block: s > 5 }));
    assert.equal(a.player.action, "draw");
    assert.equal(blocking(a.fight.world, a.me), false);
    play(a.fight, toSteps(BOW.looseRecoverTime) + 10, () => ({ block: true }));
    assert.equal(a.player.action, "block");
  });

  test("a dodge breaks the draw off and keeps the arrow", () => {
    const a = archer(5);
    play(a.fight, 20, drawn(40));
    assert.equal(a.player.action, "draw");
    play(a.fight, 1, () => ({ attackHeld: true, dodge: true }));
    assert.equal(a.player.action, "dodge");
    play(a.fight, 30, () => ({ attackHeld: true }));
    assert.equal(a.flying().length, 0);
    assert.equal(a.arrowsLeft(), 5);
  });

  test("a heavy or a stab does nothing with a bow", () => {
    const a = archer(5);
    play(a.fight, 20, (s) => ({ attack: s % 4 === 1 ? "heavy" : s % 4 === 3 ? "stab" : null }));
    assert.equal(a.player.action, "none");
    assert.equal(a.flying().length, 0);
  });
});

describe("where the arrow goes", () => {
  const FAR = 16;

  test("unlocked, it flies level where you face and drops short of a far foe", () => {
    const a = archer(5, FAR);
    const events = play(a.fight, 120, drawn(FULL_STEPS));
    assert.deepEqual(damageOf(events), []);
    assert.equal(a.fight.world.require(a.fight.enemies[0]!, Health).hp, TARGET.maxHp);
    const [arrow] = a.flying();
    assert.ok(arrow?.stuck && arrow.pos.y === 0 && arrow.pos.z < FAR - TARGET.radius && arrow.pos.x === 0);
  });

  test("locked on, it's loosed in an arc that lands on the target", () => {
    const a = archer(5, FAR);
    const events = play(a.fight, 120, drawn(FULL_STEPS, { locked: 0 }));
    assert.equal(damageOf(events).length, 1);
  });

  test("locked on, it goes at the target whichever way the input aims", () => {
    const a = archer(5);
    const events = play(a.fight, 120, drawn(FULL_STEPS, { locked: 0, aimX: 1, aimZ: 0 }));
    assert.equal(damageOf(events).length, 1);
  });
});
