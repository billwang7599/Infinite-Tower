import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, bagCounts, BOW, drawCost, drawTime, emptyBag, emptyEquipment, FIXED_DT, Health, loosedDamage, loosedSpeed,
  packFor, Player, Projectile, Stamina, stowedCounts, toSteps, WEAPONS, type PlayerInputData,
} from "@infinite-tower/shared";
import { blocking, Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_STAMINA, input, player, STATS, STATUE } from "../fixtures.js";

before(() => initPhysics());

const BOW_ITEM = WEAPONS["training-bow"];
const MIN_STEPS = toSteps(drawTime(BOW, BOW_ITEM, STATS.strength, "minTime"));
const FULL_STEPS = toSteps(drawTime(BOW, BOW_ITEM, STATS.strength, "fullTime"));
const TARGET = { ...STATUE, maxHp: 10_000 };

const QUIVER = "training-quiver";

function archer(arrows: number, foeAt = 8, quivered: number | null = null) {
  const fight = new Fight({
    arena: { ...ARENA, radius: 40 },
    players: [player({ x: 0, y: 0.05, z: 0 }, {
      gear: {
        bag: addItem(emptyBag(), BOW.ammo, arrows).bag, pack: packFor(null),
        quiver: quivered === null ? packFor(null) : addItem(packFor(QUIVER), BOW.ammo, quivered).bag,
        equipment: { ...emptyEquipment(), rightHand: "training-bow", hip: quivered === null ? null : QUIVER },
      },
    })],
    enemies: [enemy(TARGET, { x: 0, y: 0.05, z: foeAt })],
  });
  const me = fight.players[0]!;
  return {
    fight, me, player: fight.world.require(me, Player),
    arrowsLeft: () => stowedCounts(fight.world.require(me, Player).gear)[BOW.ammo] ?? 0,
    inQuiver: () => bagCounts(fight.world.require(me, Player).gear.quiver)[BOW.ammo] ?? 0,
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
    play(a.fight, toSteps(BOW.nock.bagTime) + 10, () => ({ block: true }));
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

describe("nocking the next arrow", () => {
  const loosed = (a: ReturnType<typeof archer>) => {
    play(a.fight, FULL_STEPS + 1, drawn(FULL_STEPS));
    assert.equal(a.player.action, "loose");
  };
  const nockedAfter = (a: ReturnType<typeof archer>, steps: number) => {
    play(a.fight, steps - 1);
    assert.equal(a.player.action, "loose");
    play(a.fight, 1);
    assert.equal(a.player.action, "none");
  };

  test("from the bag, the next draw waits the bag's nock time", () => {
    const a = archer(5);
    loosed(a);
    nockedAfter(a, toSteps(BOW.nock.bagTime));
  });

  test("with arrows in a quiver, they're shot first and nocked quicker", () => {
    const a = archer(5, 8, 3);
    loosed(a);
    assert.deepEqual([a.inQuiver(), a.arrowsLeft()], [2, 7]);
    nockedAfter(a, toSteps(BOW.nock.quiverTime));
    assert.ok(BOW.nock.quiverTime < BOW.nock.bagTime);
  });

  test("a quiver shot empty nocks the next from the bag", () => {
    const a = archer(5, 8, 1);
    loosed(a);
    assert.equal(a.inQuiver(), 0);
    nockedAfter(a, toSteps(BOW.nock.bagTime));
  });
});

describe("how fast the arrow leaves", () => {
  const speedOf = (heldTo: number) => {
    const a = archer(5, 30);
    play(a.fight, Math.max(heldTo, MIN_STEPS) + 1, drawn(heldTo));
    const [arrow] = a.flying();
    return Math.hypot(arrow!.vel.x, arrow!.vel.z);
  };

  test("fully drawn, at the bow's power; less drawn, slower, by the draw", () => {
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    assert.ok(near(speedOf(FULL_STEPS), BOW_ITEM.powerMps!));
    assert.ok(near(speedOf(3 * FULL_STEPS), BOW_ITEM.powerMps!));
    const quick = loosedSpeed(BOW, BOW_ITEM, STATS.strength, MIN_STEPS * FIXED_DT);
    assert.ok(near(speedOf(1), quick));
    assert.ok(quick < BOW_ITEM.powerMps!);
  });
});

describe("where the arrow goes", () => {
  const FAR = 16;
  const untouched = (a: ReturnType<typeof archer>) =>
    assert.equal(a.fight.world.require(a.fight.enemies[0]!, Health).hp, TARGET.maxHp);

  test("unlocked and aimed level, fully drawn it reaches a far foe; a short draw drops short of it", () => {
    const full = archer(5, FAR);
    assert.equal(damageOf(play(full.fight, 120, drawn(FULL_STEPS))).length, 1);
    const quick = archer(5, FAR);
    assert.deepEqual(damageOf(play(quick.fight, 120, drawn(1))), []);
    untouched(quick);
    const [arrow] = quick.flying();
    assert.ok(arrow?.stuck && arrow.pos.y === 0 && arrow.pos.z < FAR - TARGET.radius && arrow.pos.x === 0);
  });

  test("aimed up, it rises and flies over a foe a level shot hits", () => {
    const a = archer(5);
    play(a.fight, FULL_STEPS + 1, drawn(FULL_STEPS, { aimPitchRad: 0.5 }));
    assert.ok(a.flying()[0]!.vel.y > 0);
    assert.deepEqual(damageOf(play(a.fight, 120)), []);
    untouched(a);
  });

  test("aimed down, it sticks in the floor short of the foe", () => {
    const a = archer(5);
    assert.deepEqual(damageOf(play(a.fight, 120, drawn(FULL_STEPS, { aimPitchRad: -0.3 }))), []);
    untouched(a);
    const [arrow] = a.flying();
    assert.ok(arrow?.stuck && arrow.pos.y === 0 && arrow.pos.z < 8 - TARGET.radius);
  });

  test("locked on, it arcs onto the target whatever the aim's pitch", () => {
    const a = archer(5);
    assert.equal(damageOf(play(a.fight, 120, drawn(FULL_STEPS, { locked: 0, aimPitchRad: 0.5 }))).length, 1);
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

  test("locked on a target that's down, it goes the input's way and pitch", () => {
    const a = archer(5);
    a.fight.world.require(a.fight.enemies[0]!, Health).hp = 0;
    play(a.fight, FULL_STEPS + 1, drawn(FULL_STEPS, { locked: 0, aimX: 1, aimZ: 0, aimPitchRad: 0.2 }));
    const [arrow] = a.flying();
    assert.ok(arrow && arrow.vel.x > 0 && Math.abs(arrow.vel.z) < 1e-9 && arrow.vel.y > 0, JSON.stringify(arrow?.vel));
  });
});
