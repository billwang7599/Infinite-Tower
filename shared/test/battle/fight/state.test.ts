import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  ActiveHit, Body, emptyBag, emptyEquipment, packFor, Wielder, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, BOAR, busy, CASTER, dumpState, enemy, IDLE, input, player } from "./fixtures.js";

before(() => initPhysics());

const PLAYER_AT = { x: 0, y: 0.05, z: -5 };
const BOAR_AT = { x: 0, y: 0.05, z: 3 };
const newFight = () => new Fight({ arena: ARENA, players: [player(PLAYER_AT)], enemies: [enemy(BOAR, BOAR_AT)] });

/** Steps `fight` on to step `to` with `busy` (or `next`). */
function runTo(fight: Fight, to: number, next: (step: number) => PlayerInputData = busy): void {
  while (fight.steps < to) fight.step([next(fight.steps + 1)]);
}

/** Through JSON, as it goes over the wire. */
const wire = (snap: FightSnapshot): FightSnapshot => JSON.parse(JSON.stringify(snap));

describe("a fight's whole state", () => {
  test("counts its steps", () => {
    const fight = newFight();
    assert.equal(fight.steps, 0);
    runTo(fight, 5);
    assert.equal(fight.steps, 5);
    assert.equal(fight.save().steps, 5);
  });

  test("survives JSON exactly", () => {
    const fight = newFight();
    runTo(fight, 200);
    assert.deepEqual(wire(fight.save()), fight.save());
  });

  test("loaded into a new fight, the two go on exactly alike, step for step", () => {
    for (const at of [1, 37, 120, 301, 455, 700]) {
      const original = newFight();
      runTo(original, at);
      const copy = newFight();
      copy.load(wire(original.save()));
      assert.equal(copy.steps, at);
      assert.equal(dumpState(copy), dumpState(original), `right after loading at step ${at}`);
      for (let i = 0; i < 300; i++) {
        original.step([busy(original.steps + 1)]);
        copy.step([busy(copy.steps + 1)]);
        assert.equal(dumpState(copy), dumpState(original), `step ${original.steps}, loaded at ${at}`);
      }
      assert.ok(Buffer.from(copy.physics.snapshot()).length > 0);
    }
  });

  test("loaded into a fight that went its own way, it's put back exactly and plays on the same", () => {
    const right = newFight(), wrong = newFight();
    runTo(right, 400);
    runTo(wrong, 380, (step) => input({ moveX: -1, attack: step % 2 ? "heavy" : null }));
    wrong.load(wire(right.save()));
    for (let i = 0; i < 300; i++) {
      right.step([busy(right.steps + 1)]);
      wrong.step([busy(wrong.steps + 1)]);
    }
    assert.equal(dumpState(wrong), dumpState(right));
  });

  test("a live hitbox comes back with whom it has already hit, checked in the same order", () => {
    const fight = newFight();
    // Find a step with a live swing that has hit the boar.
    let found = false;
    while (!found && fight.steps < 2000) {
      const me = fight.world.require(fight.players[0]!, Body).pos;
      const boar = fight.world.require(fight.enemies[0]!, Body).pos;
      const dx = boar.x - me.x, dz = boar.z - me.z, d = Math.hypot(dx, dz) || 1;
      fight.step([{ ...busy(fight.steps + 1), aimX: dx / d, aimZ: dz / d }]);
      const hit = fight.world.get(fight.players[0]!, ActiveHit);
      found = !!hit && hit.alreadyHit.size > 0;
    }
    assert.ok(found, "the busy player lands a swing");
    const snap = wire(fight.save());
    assert.deepEqual(snap.hits.find((h) => h.by === 0)?.alreadyHit, [1]);
    const copy = newFight();
    copy.load(snap);
    assert.deepEqual(copy.world.get(copy.players[0]!, ActiveHit), fight.world.get(fight.players[0]!, ActiveHit));
  });

  test("the outcome comes with it", () => {
    const fight = newFight();
    runTo(fight, 10, () => IDLE);
    const snap = fight.save();
    snap.outcome = { state: "won", stateTime: 0.5 };
    const copy = newFight();
    copy.load(snap);
    assert.deepEqual(copy.outcome, { state: "won", stateTime: 0.5 });
  });

  test("a caster comes back mid-chant, its stamina and what it's still to say with it", () => {
    const caster = () => new Fight({
      arena: { ...ARENA, radius: 16 }, players: [player({ x: 0, y: 0.05, z: -6 })], enemies: [enemy(CASTER, BOAR_AT)],
    });
    for (const at of [40, 75, 160, 333]) {
      const original = caster();
      runTo(original, at, () => IDLE);
      const copy = caster();
      copy.load(wire(original.save()));
      assert.equal(dumpState(copy), dumpState(original), `right after loading at step ${at}`);
      for (let i = 0; i < 300; i++) {
        original.step([IDLE]);
        copy.step([IDLE]);
      }
      assert.equal(dumpState(copy), dumpState(original), `loaded at ${at}`);
    }
  });
});

describe("the hand that swings", () => {
  const dual = () => new Fight({ arena: ARENA, enemies: [enemy(BOAR, BOAR_AT)], players: [player(PLAYER_AT, {
    gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null),
      equipment: { ...emptyEquipment(), rightHand: "sword", leftHand: "kobold-blade" } },
  })] });

  test("is in the saved state and its hash, and loads back", () => {
    const fight = dual(), copy = dual();
    fight.step([input({ switchHand: true })]);
    fight.step([IDLE]);
    copy.step([IDLE]);
    copy.step([IDLE]);
    assert.notEqual(fight.hash(), copy.hash());
    copy.load(wire(fight.save()));
    assert.equal(copy.world.require(copy.players[0]!, Wielder).hands.active, "leftHand");
    assert.equal(copy.hash(), fight.hash());
  });
});
