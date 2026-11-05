import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, bagCounts, Body, BOW, damageTotal, drawCost, drawTime, emptyBag, emptyEquipment, Fighter, FIXED_DT,
  flightAfter, Health, loosedDamage, loosedSpeed, packFor, Player, Projectile, Stamina, stowedCounts, toSteps, WEAPONS,
  type PlayerInputData, type Vec3,
} from "@infinite-tower/shared";
import { blocking, Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_STAMINA, input, player, STATS, STATUE } from "../fixtures.js";

before(() => initPhysics());

const BOW_ITEM = WEAPONS["training-bow"];
const MIN_STEPS = toSteps(drawTime(BOW, BOW_ITEM, STATS.strength, "minTime"));
const FULL_STEPS = toSteps(drawTime(BOW, BOW_ITEM, STATS.strength, "fullTime"));
const TARGET = { ...STATUE, maxHp: 10_000 };

const QUIVER = "training-quiver";
const WALL_M = 40;

function archer(arrows: number, foeAt = 8, quivered: number | null = null) {
  const fight = new Fight({
    arena: { ...ARENA, radius: WALL_M },
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

const launched = ({ pos, vel }: { pos: Vec3; vel: Vec3 }) => flightAfter(BOW.projectile, pos, vel, -FIXED_DT);

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
    const quick = archer(5, 3), full = archer(5, 3), over = archer(5, 3);
    const quickHits = damageOf(play(quick.fight, 90, drawn(1, { locked: 0 })));
    const fullHits = damageOf(play(full.fight, FULL_STEPS + 90, drawn(FULL_STEPS + 1, { locked: 0 })));
    const overHits = damageOf(play(over.fight, 3 * FULL_STEPS + 90, drawn(3 * FULL_STEPS, { locked: 0 })));
    const loosed = (drawnTime: number) => damageTotal(loosedDamage(BOW, BOW_ITEM, drawnTime, STATS));
    assert.equal(quickHits.length, 1);
    assert.ok(Math.abs(quickHits[0]! - loosed(MIN_STEPS * FIXED_DT)) < 1e-9);
    assert.deepEqual(fullHits, [loosed(FULL_STEPS * FIXED_DT)]);
    assert.deepEqual(overHits, fullHits);
    assert.ok(quickHits[0]! < fullHits[0]!);
  });

  test("an arrow strikes as stab only", () => {
    const a = archer(5, 3);
    const hits = play(a.fight, FULL_STEPS + 90, drawn(FULL_STEPS + 1, { locked: 0 })).flatMap((ev) =>
      (ev.type === "hit" ? [ev] : []));
    assert.equal(hits.length, 1);
    assert.deepEqual(hits[0]!.byType, { slash: 0, stab: hits[0]!.damage, blunt: 0 });
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
    play(a.fight, Math.max(heldTo, MIN_STEPS) + 1, drawn(heldTo, { aimAt: { x: 0, y: 1, z: 30 } }));
    const { x, y, z } = launched(a.flying()[0]!).vel;
    return Math.hypot(x, y, z);
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
  const stuckAt = (a: ReturnType<typeof archer>): Vec3 => {
    const [arrow] = a.flying();
    assert.ok(arrow?.stuck, JSON.stringify(arrow));
    return arrow.pos;
  };
  const unit = ({ x, y, z }: Vec3): Vec3 => {
    const m = Math.hypot(x, y, z);
    return { x: x / m, y: y / m, z: z / m };
  };
  const middleOf = (a: ReturnType<typeof archer>): number => {
    const foe = a.fight.enemies[0]!, { pos, centerHeight } = a.fight.world.require(foe, Body);
    return pos.y - centerHeight + a.fight.world.require(foe, Fighter).heightM / 2;
  };
  const hitsOf = (events: FightEvent[]) => events.flatMap((ev) => (ev.type === "hit" ? [ev] : []));

  test("unlocked, it leaves straight along the line to the spot aimed at, with no arc", () => {
    for (const spot of [{ x: 0, y: 6, z: WALL_M }, { x: 3, y: 0, z: 5 }, { x: -20, y: 2, z: 30 }]) {
      const a = archer(5, FAR);
      play(a.fight, FULL_STEPS + 1, drawn(FULL_STEPS, { aimAt: spot }));
      const { pos, vel } = launched(a.flying()[0]!), way = unit(vel);
      const want = unit({ x: spot.x - pos.x, y: spot.y - pos.y, z: spot.z - pos.z });
      assert.ok(Math.hypot(way.x - want.x, way.y - want.y, way.z - want.z) < 1e-9, JSON.stringify({ way, want }));
    }
  });

  test("unlocked, it hits a near foe about where it's aimed", () => {
    const a = archer(5, 4), spot = { x: 0.2, y: middleOf(a), z: 4 - TARGET.radius };
    const [hit] = hitsOf(play(a.fight, FULL_STEPS + 30, drawn(FULL_STEPS, { aimAt: spot })));
    const offM = hit?.at ? Math.hypot(hit.at.x - spot.x, hit.at.y - spot.y, hit.at.z - spot.z) : Infinity;
    assert.ok(offM < 0.1, JSON.stringify(hit));
  });

  test("unlocked, it drops below a far spot by at least gravity's fall over the flight, so you aim high", () => {
    const a = archer(5, FAR), spot = { x: 0, y: 6, z: WALL_M }, power = BOW_ITEM.powerMps!;
    play(a.fight, FULL_STEPS + 90, drawn(FULL_STEPS, { aimAt: spot }));
    untouched(a);
    const at = stuckAt(a), fallM = (-BOW.projectile.gravityMps2 / 2) * ((WALL_M - 1) / power) ** 2;
    assert.ok(Math.hypot(at.x - spot.x, at.z - spot.z) < 1e-6, `in the wall straight below: ${JSON.stringify(at)}`);
    assert.ok(at.y > 0 && spot.y - at.y > fallM, `${at.y} vs ${spot.y} - ${fallM}`);
  });

  test("a tap barely flies: aimed level at the far wall, it falls into the floor far short of a full draw", () => {
    const level = { aimAt: { x: WALL_M, y: 1, z: 0 } };
    const tap = archer(5, FAR), full = archer(5, FAR);
    play(tap.fight, FULL_STEPS + 60, drawn(1, level));
    play(full.fight, FULL_STEPS + 60, drawn(FULL_STEPS, level));
    const short = stuckAt(tap), long = stuckAt(full);
    assert.ok(Math.abs(short.y) < 1e-9 && Math.abs(long.y) < 1e-9, "both in the floor");
    assert.ok(short.x < long.x / 3, `${short.x} vs ${long.x}`);
  });

  test("aimed at the floor short of the foe, it sticks in the floor about there", () => {
    const a = archer(5), floor = { x: 0.5, y: 0, z: 4 };
    assert.deepEqual(damageOf(play(a.fight, 120, drawn(FULL_STEPS, { aimAt: floor }))), []);
    untouched(a);
    const at = stuckAt(a);
    assert.ok(Math.abs(at.y) < 1e-9 && Math.hypot(at.x - floor.x, at.z - floor.z) < 0.5, JSON.stringify(at));
  });

  test("locked on, it's aimed over the drop to land on the target's middle, near or across the arena", () => {
    for (const foeAt of [4, FAR, 2 * FAR]) {
      const a = archer(5, foeAt), [hit] = hitsOf(play(a.fight, 120, drawn(FULL_STEPS, { locked: 0 })));
      assert.ok(hit?.at && Math.abs(hit.at.y - middleOf(a)) < 0.25, `${foeAt} m: ${JSON.stringify(hit)}`);
    }
  });

  test("locked on, a tap that can't reach a far target is loosed straight at it and drops short", () => {
    const a = archer(5, FAR);
    play(a.fight, MIN_STEPS + 1, drawn(1, { locked: 0 }));
    const { pos, vel } = launched(a.flying()[0]!), way = unit(vel);
    const want = unit({ x: -pos.x, y: middleOf(a) - pos.y, z: FAR - pos.z });
    assert.ok(Math.hypot(way.x - want.x, way.y - want.y, way.z - want.z) < 1e-6, JSON.stringify({ way, want }));
    play(a.fight, 60);
    untouched(a);
    const at = stuckAt(a);
    assert.ok(Math.abs(at.y) < 1e-9 && at.z < FAR - TARGET.radius, JSON.stringify(at));
  });

  test("locked on, it arcs onto the target whatever spot the input aims at", () => {
    const a = archer(5);
    const events = play(a.fight, 120, drawn(FULL_STEPS, { locked: 0, aimAt: { x: 0, y: 6, z: 40 } }));
    assert.equal(damageOf(events).length, 1);
  });

  test("locked on, it goes at the target whichever way the input aims", () => {
    const a = archer(5);
    const events = play(a.fight, 120, drawn(FULL_STEPS, { locked: 0, aimX: 1, aimZ: 0 }));
    assert.equal(damageOf(events).length, 1);
  });

  test("locked on a target that's down, it goes for the input's spot", () => {
    const a = archer(5);
    a.fight.world.require(a.fight.enemies[0]!, Health).hp = 0;
    play(a.fight, FULL_STEPS + 1, drawn(FULL_STEPS, { locked: 0, aimX: 1, aimZ: 0, aimAt: { x: 20, y: 6, z: 0 } }));
    const [arrow] = a.flying();
    assert.ok(arrow && arrow.vel.x > 0 && Math.abs(arrow.vel.z) < 1e-9 && arrow.vel.y > 0, JSON.stringify(arrow?.vel));
  });
});
