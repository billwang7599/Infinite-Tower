import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  ActiveHit, Body, CHAIN, Enemy, feltHeft, FIXED_DT, HYBRID, Player, PLAYER, toSteps, wayStepsAfter, WEAPONS, Wielder,
  type EnemyDef, type PlayerInputData, type Vec2, type WeaponAttackDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, STATS, STATUE, swings, SWORDSMAN } from "../fixtures.js";

before(() => initPhysics());

const { lungeSpeed, moveFactor, liveTurnRadPerSec, whiffRecoverTime, whiffCarrySpeed } = HYBRID.swinging;
const LIGHT = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false, STATS.strength);
const WHIFF_STEPS = toSteps(whiffRecoverTime * feltHeft(WEAPONS.sword, STATS.strength));
const IN_REACH_M = 2, OUT_OF_REACH_M = 6;

const near = (a: number, b: number, what: string, within = 1e-3) =>
  assert.ok(Math.abs(a - b) < within, `${what}: ${a} vs ${b}`);
const along = (vel: Vec2, dir: Vec2) => vel.x * dir.x + vel.z * dir.z;
const yawOf = (dir: Vec2) => Math.atan2(dir.x, dir.z);
const sameDir = (hit: { dirX: number; dirZ: number } | undefined, dir: Vec2) =>
  !hit || (Math.abs(hit.dirX - dir.x) < 1e-12 && Math.abs(hit.dirZ - dir.z) < 1e-12);

const facing = (at: number, def: EnemyDef = STATUE) => new Fight({
  arena: { ...ARENA, radius: 40 }, players: [player({ x: 0, y: 0.05, z: 0 })],
  enemies: [enemy(def, { x: 0, y: 0.05, z: at })],
});

interface Seen { step: number; dir: Vec2; vel: Vec2; hitFollows: boolean }

function watch(fight: Fight, who: number, next: (step: number) => Partial<PlayerInputData> = () => ({})) {
  const wielder = fight.world.require(who, Wielder), body = fight.world.require(who, Body);
  while (wielder.swing === null) fight.step([input(next(-1))]);
  const swing = wielder.swing, seen: Seen[] = [];
  while (wielder.swing === swing) {
    const step = swing.step;
    fight.step([input(next(step))]);
    seen.push({ step, dir: { ...swing.dir }, vel: { x: body.vel.x, z: body.vel.z },
      hitFollows: sameDir(fight.world.get(who, ActiveHit), swing.dir) });
  }
  return { swing, seen, at: (step: number) => seen.find((s) => s.step === step)! };
}

function swingAt(at: number, next: (step: number) => Partial<PlayerInputData> = () => ({})) {
  const fight = facing(at), me = fight.players[0]!;
  return { fight, me, ...watch(fight, me, (step) => ({ ...(step === -1 && { attack: "light" }), ...next(step) })) };
}

describe("a swing's hold on the body: a player", () => {
  test("walks at a quarter pace from the wind-up through the recovery", () => {
    const walk = PLAYER.moveSpeed * moveFactor, { swing, at } = swingAt(IN_REACH_M, () => ({ moveX: 1 }));
    near(at(swing.liveAt - 1).vel.x, walk, "winding up");
    near(at(swing.endAt - 1).vel.x, walk, "recovering");
  });

  test("is carried forward at the lunge's speed while the blade is live", () => {
    const { swing, at } = swingAt(IN_REACH_M);
    for (let step = swing.liveAt; step < swing.liveUntil; step++) near(at(step).vel.z, lungeSpeed, `step ${step}`);
  });

  test("a swing that lands recovers as it always did", () => {
    const { swing } = swingAt(IN_REACH_M);
    assert.equal(swing.whiffed, false);
    assert.equal(swing.endAt, LIGHT.endAt);
  });

  test("a whiff overextends: a longer recovery by the blade's felt heft, carried forward all through it", () => {
    const { swing, at } = swingAt(OUT_OF_REACH_M);
    assert.equal(swing.whiffed, true);
    assert.equal(swing.endAt, LIGHT.endAt + WHIFF_STEPS);
    for (let step = swing.liveUntil; step < swing.endAt; step++) {
      near(along(at(step).vel, swing.dir), whiffCarrySpeed, `step ${step}`);
    }
  });

  test("overextended, a dodge or a swing pressed waits for the recovery's end", () => {
    for (const press of [{ dodge: true }, { attack: "heavy" as const }]) {
      const { fight, me, seen } = swingAt(OUT_OF_REACH_M, (step) => (step === LIGHT.liveUntil + 1 ? press : {}));
      assert.equal(seen.at(-1)!.step, LIGHT.endAt + WHIFF_STEPS, JSON.stringify(press));
      assert.equal(fight.world.require(me, Player).action, press.dodge ? "dodge" : "attack", JSON.stringify(press));
    }
  });

  test("the live blade turns toward the aim at no more than the cap, its hit and the carry with it", () => {
    const { swing, seen, at } = swingAt(OUT_OF_REACH_M, (step) => (step >= LIGHT.liveAt ? { aimX: 1, aimZ: 0 } : {}));
    near(yawOf(swing.dir), (swing.liveUntil - swing.liveAt) * liveTurnRadPerSec * FIXED_DT, "turned", 1e-9);
    assert.ok(yawOf(swing.dir) < Math.PI / 2, "never all the way round");
    for (let step = swing.liveAt; step < swing.liveUntil; step++) {
      near(along(at(step).vel, at(step).dir), lungeSpeed, `carried along at ${step}`);
    }
    assert.ok(seen.every((s) => s.hitFollows));
  });
});

describe("a swing's hold on the body: a swordsman, by the same rules", () => {
  const def = (over: Partial<WeaponAttackDef> = {}): EnemyDef =>
    ({ ...SWORDSMAN, walkSpeed: 3, attacks: { weapon: swings({ triggerDist: 8, ...over }) } });

  test("walks at a quarter pace winding up, is carried at the lunge's speed while live, and overextends on a whiff",
    () => {
      const walker = def(), fight = facing(7, walker), { swing, at } = watch(fight, fight.enemies[0]!);
      near(Math.hypot(at(swing.liveAt - 1).vel.x, at(swing.liveAt - 1).vel.z), walker.walkSpeed * moveFactor,
        "winding up");
      for (let step = swing.liveAt; step < swing.liveUntil; step++) {
        near(along(at(step).vel, swing.dir), lungeSpeed, `live at ${step}`);
      }
      assert.equal(swing.whiffed, true);
      const steps = wayStepsAfter(WEAPONS.sword, walker.attacks.weapon!.windup, false, STATS.strength);
      assert.equal(swing.endAt, steps.endAt + WHIFF_STEPS);
      for (let step = swing.liveUntil; step < swing.endAt; step++) {
        near(along(at(step).vel, swing.dir), whiffCarrySpeed, `overextended at ${step}`);
      }
    });

  test("overextended, its chain's next swing waits for the recovery's end", () => {
    const fight = facing(7, def({ minChain: 2, maxChain: 2 })), it = fight.enemies[0]!;
    const { swing, seen } = watch(fight, it);
    assert.equal(swing.whiffed, true);
    assert.equal(seen.at(-1)!.step, swing.endAt);
    assert.equal(fight.world.require(it, Wielder).swing?.step, 1, "the next swing has begun");
  });

  test("its live blade turns toward its target at no more than the cap, its hit with it", () => {
    const fight = facing(IN_REACH_M, def()), it = fight.enemies[0]!, wielder = fight.world.require(it, Wielder);
    const kobold = fight.world.require(it, Enemy);
    while (wielder.swing === null || wielder.swing.step < wielder.swing.liveAt) fight.step([input({})]);
    const off = Math.PI / 2;
    kobold.yaw += off;
    wielder.swing.dir = { x: Math.sin(kobold.yaw), z: Math.cos(kobold.yaw) };
    const { swing, seen } = watch(fight, it);
    const live = seen.filter((s) => s.step < swing.liveUntil), last = live.at(-1)!;
    const toTarget = Math.PI, offBy = Math.abs(Math.atan2(Math.sin(yawOf(last.dir) - toTarget),
      Math.cos(yawOf(last.dir) - toTarget)));
    near(offBy, off - live.length * liveTurnRadPerSec * FIXED_DT, "still off its target", 1e-6);
    assert.ok(live.every((s) => s.hitFollows));
  });
});
