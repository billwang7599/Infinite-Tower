import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Body, ONE_STRIKE, punchDamage, toSteps } from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ARENA, STATS } from "../../fixtures.js";
import {
  blade, both, hp, maxHp, me, play, playTo, pressAt, pvp, swingOf, SWORD_LINE_STEPS, SWORD_THRUST_STEPS,
  type Script,
} from "./duel.js";

await initPhysics();

const AT = 20;
const lands = AT + SWORD_THRUST_STEPS;
const posOf = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Body).pos;

function answer(from: number, then: "middle" | "low", by: 0 | 1 = 0) {
  const fight = pvp();
  const thruster: Script = pressAt(AT, { attack: "light" });
  const answerer: Script = (s) => ({ line: s >= from ? then : "high" });
  const events = by === 0 ? playTo(fight, lands + 3, thruster, answerer) : playTo(fight, lands + 3, answerer, thruster);
  return { fight, events, thruster: by, other: 1 - by };
}

describe("One Strike's disarm", () => {
  test("a blade still moving into the thrust's line as it lands disarms the thruster, both seats alike", () => {
    for (const by of [0, 1] as const) {
      for (const from of [lands - 1, lands - SWORD_LINE_STEPS]) {
        const { fight, events, thruster, other } = answer(from, "middle", by);
        const loser = fight.players[thruster];
        const disarmed = events.some((e) => e.type === "strike" && e.what === "disarm" && e.target === loser);
        assert.ok(disarmed, `seat ${by}, from ${from}`);
        assert.equal(hp(fight, other), maxHp(fight, other));
        assert.ok(blade(fight, thruster).loose, "its blade lies loose");
        assert.equal(swingOf(fight, thruster), null);
      }
    }
  });

  test("its blade lands about three metres away, away from the disarmer", () => {
    const { fight } = answer(lands - 1, "middle");
    const loose = blade(fight, 0).loose!, at = posOf(fight, 0);
    assert.ok(loose.z < at.z, "behind the thruster");
    assert.ok(Math.abs(Math.hypot(loose.x - at.x, loose.z - at.z) - ONE_STRIKE.disarm.throwM) < 0.6);
  });

  test("moving there sooner just clashes: the blade holds the line by the time it lands", () => {
    const { fight, events } = answer(lands - SWORD_LINE_STEPS - 1, "middle");
    assert.ok(events.some((e) => e.type === "strike" && e.what === "clash"));
    assert.equal(blade(fight, 0).loose, null);
  });

  test("a blade moving anywhere else, or still at another line, doesn't disarm: the thrust lands", () => {
    const { fight, events } = answer(lands - 1, "low");
    assert.ok(!events.some((e) => e.type === "strike"));
    assert.ok(hp(fight, 1) < maxHp(fight, 1));
    assert.equal(blade(fight, 0).loose, null);
  });

  test("near the wall the blade still lands inside it", () => {
    const fight = pvp({ at: { x: 0, y: 0.05, z: -ARENA.radius + 1 } }, { at: { x: 0, y: 0.05, z: -ARENA.radius + 3 } });
    playTo(fight, lands + 3, pressAt(AT, { attack: "light" }), (s) => ({ line: s >= lands - 1 ? "middle" : "high" }));
    const loose = blade(fight, 0).loose!;
    assert.ok(Math.hypot(loose.x, loose.z) <= ARENA.radius - ONE_STRIKE.disarm.wallGapM + 1e-6);
  });

  test("disarmed, left click punches: a little damage by strength, and a stagger", () => {
    const fight = pvp({}, { at: { x: 0, y: 0.05, z: 1.2 } });
    play(fight, 1);
    blade(fight, 0).loose = { x: 0, z: -4 };
    const events = playTo(fight, 30, pressAt(3, { attack: "light" }), () => ({ line: "low" }));
    assert.ok(Math.abs(maxHp(fight, 1) - hp(fight, 1) - punchDamage(STATS)) < 1e-6);
    assert.ok(events.some((e) => e.type === "hit" && e.target === fight.players[1] && !e.weapon));
  });

  test("a punch staggers its target", () => {
    const fight = pvp({}, { at: { x: 0, y: 0.05, z: 1.2 } });
    play(fight, 1);
    blade(fight, 0).loose = { x: 0, z: -4 };
    let staggered = false;
    for (let i = 0; i < 30; i++) {
      play(fight, 1, pressAt(3, { attack: "light" }));
      staggered ||= me(fight, 1).action === "stagger";
    }
    assert.ok(staggered);
  });

  test("walking within reach of your own blade picks it up, standing still; nobody else can", () => {
    const fight = pvp();
    play(fight, 1);
    blade(fight, 0).loose = { x: 0, z: -1.5 };
    blade(fight, 1).loose = null;
    let started = -1;
    for (let i = 0; i < 120 && blade(fight, 0).loose; i++) {
      play(fight, 1, () => ({ moveZ: me(fight, 0).action === "none" ? -1 : 0 }));
      if (started < 0 && me(fight, 0).action === "pickup") started = fight.steps;
    }
    assert.ok(started > 0);
    assert.equal(blade(fight, 0).loose, null);
    assert.equal(fight.steps - started + 1, toSteps(ONE_STRIKE.pickup.time));
    const other = pvp();
    play(other, 1);
    blade(other, 0).loose = { x: 0, z: 2.4 };
    play(other, 60, () => ({}), () => ({ moveZ: 1 }));
    assert.ok(blade(other, 0).loose, "the other player walked over it");
    assert.notEqual(me(other, 1).action, "pickup");
  });

  test("a disarmed fighter holds no line: a thrust at any line lands", () => {
    const fight = pvp();
    play(fight, 1);
    blade(fight, 1).loose = { x: 4, z: 4 };
    playTo(fight, lands + 2, both(pressAt(AT, { attack: "light" })));
    assert.ok(hp(fight, 1) < maxHp(fight, 1));
  });
});
