import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Body, CHAIN, Health, liveStep, SKILL_EFFECTS, MAX_LIVE_SHOTS, shotOf, SkillObject, Statuses, Wielder,
  type Modifier, type Form, type SkillElement, type SkillObjectData, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, castNow, enemy, IDLE, input, player, run, segment, skill, STATUE } from "../fixtures.js";

await initPhysics();

const D = SKILL_EFFECTS.damage, W = SKILL_EFFECTS.elements.water.damage, A = SKILL_EFFECTS.modifiers;
const ME: Vec3 = { x: 0, y: 0.05, z: -4 };
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });

const fightWith = (enemies: Vec3[], radius = ARENA.radius) =>
  new Fight({ arena: { radius }, players: [player(ME)], enemies: enemies.map((e) => enemy(STATUE, e)) });
const lostHp = (fight: Fight, i: number) => {
  const health = fight.world.require(fight.enemies[i]!, Health);
  return health.max - health.hp;
};
const objects = (fight: Fight, kind: string) => [...fight.world.query(SkillObject)].filter(([, o]) => o.kind === kind);
const one = (form: Form, elements: SkillElement[], modifiers: Modifier[]) => skill(segment(form, elements, modifiers));
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const untilDone = (fight: Fight) => {
  for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) fight.step([IDLE]);
};

describe("modifiers, in order", () => {
  const shot = (...modifiers: Modifier[]) => shotOf(segment("bolt", [], modifiers));
  const B = SKILL_EFFECTS.bolt;

  test("a repeat is a full step, applied again to the shot so far", () => {
    close(shot().delayTime, 0);
    close(shot("delay", "swift", "delay").delayTime, A.delayTime * 2);
    close(shot("amplify", "amplify").damageFactor, (1 + A.amplify) ** 2);
    close(shot("swift", "swift", "swift").swiftFactor, (1 + A.swift) ** 3);
  });

  test("each changes the shot built before it: Amplify then Split amplifies both Bolts", () => {
    const amplified = shot("amplify", "split");
    assert.equal(amplified.bolts, 2);
    close(amplified.damageFactor, (1 + A.amplify) * B.splitDamageFactor);
  });

  test("Split then Split splits each Bolt again", () => {
    const twice = shot("split", "split");
    assert.equal(twice.bolts, 4);
    close(twice.boltRadiusM, B.radiusM * B.splitRadiusFactor ** 2);
  });

  test("the first Extend leaves a cloud, each after it makes it last longer", () => {
    close(shotOf(segment("nova", [], ["extend"])).cloudTime, SKILL_EFFECTS.cloud.time);
    close(shotOf(segment("nova", [], ["extend", "extend"])).cloudTime, SKILL_EFFECTS.cloud.time * (1 + A.extend));
  });

  test("Follow then Split: every split Bolt homes", () => {
    close(shot("follow", "split").followTurnRadPerSec, A.followTurnRadPerSec);
  });
});

describe("Amplify", () => {
  test("adds damage, again in full with each repeat", () => {
    for (const modifiers of [["amplify"], ["amplify", "amplify"]] as Modifier[][]) {
      const fight = fightWith([at(0, 0)]);
      castNow(fight, one("bolt", ["water"], modifiers));
      untilDone(fight);
      close(lostHp(fight, 0), W * D * (1 + A.amplify) ** modifiers.length);
    }
  });
});

describe("Widen", () => {
  test("a wider Nova reaches what a plain one can't", () => {
    const beyond = at(0, ME.z + SKILL_EFFECTS.nova.radius + STATUE.radius + 0.4);
    const plain = fightWith([beyond]), wide = fightWith([beyond]);
    castNow(plain, one("nova", ["water"], []));
    castNow(wide, one("nova", ["water"], ["widen"]));
    assert.equal(lostHp(plain, 0), 0);
    close(lostHp(wide, 0), W * D);
  });

  test("a wider Beam hits what passes beside a plain one", () => {
    const beside = at(STATUE.radius + SKILL_EFFECTS.beam.radiusM + 0.1, 0);
    const plain = fightWith([beside]), wide = fightWith([beside]);
    castNow(plain, one("beam", ["water"], []));
    castNow(wide, one("beam", ["water"], ["widen"]));
    assert.equal(lostHp(plain, 0), 0);
    assert.ok(lostHp(wide, 0) > 0);
  });
});

describe("Pierce", () => {
  test(`a Bolt goes through ${A.pierceTargets} enemies and stops in the next`, () => {
    const fight = fightWith([at(0, -2), at(0, 0), at(0, 2), at(0, 4)]);
    castNow(fight, one("bolt", ["water"], ["pierce"]));
    untilDone(fight);
    const hits = [0, 1, 2, 3].map((i) => lostHp(fight, i) > 0);
    assert.deepEqual(hits, [0, 1, 2, 3].map((i) => i <= A.pierceTargets));
  });

  test("a Beam strikes every enemy on its line, up to as many", () => {
    const fight = fightWith([at(0, -2), at(0, 0)]);
    castNow(fight, one("beam", ["water"], ["pierce"]));
    run(fight, 0.1);
    assert.ok(lostHp(fight, 0) > 0);
    assert.ok(lostHp(fight, 1) > 0);
  });
});

describe("Split", () => {
  const B = SKILL_EFFECTS.bolt;
  const splits = (n: number): Modifier[] => Array.from({ length: n }, () => "split");
  const skillHits = (fight: Fight) => {
    const hits: number[] = [];
    for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) {
      fight.step([IDLE]);
      for (const e of fight.events) if (e.type === "hit" && !e.sword && e.team === "enemy") hits.push(e.damage);
    }
    return hits;
  };

  test("each Split doubles the Bolts", () => {
    for (let n = 0; 2 ** n <= MAX_LIVE_SHOTS; n++) {
      const fight = fightWith([at(5, 5)]);
      castNow(fight, one("bolt", ["water"], splits(n)));
      assert.equal(objects(fight, "bolt").length, 2 ** n, `${n} Splits`);
    }
  });

  test(`a fight holds at most ${MAX_LIVE_SHOTS} shots: past that, they don't spawn`, () => {
    const fight = fightWith([at(5, 5)]);
    castNow(fight, skill(segment("bolt", ["water"], splits(20)), segment("bolt", [], splits(10))));
    assert.equal(objects(fight, "bolt").length, MAX_LIVE_SHOTS);
    for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) {
      fight.step([IDLE]);
      assert.ok(objects(fight, "bolt").length <= MAX_LIVE_SHOTS);
    }
  });

  test("each Split makes every Bolt smaller and deal less", () => {
    for (const n of [1, 2, 3]) {
      const fight = fightWith([at(0, -2)]);
      castNow(fight, one("bolt", ["water"], splits(n)));
      for (const [, o] of objects(fight, "bolt")) close(o.reachM, B.radiusM * B.splitRadiusFactor ** n);
      const hits = skillHits(fight);
      assert.ok(hits.length > 0);
      for (const damage of hits) close(damage, W * D * B.splitDamageFactor ** n);
    }
  });

  test("Amplify strengthens every Bolt, wherever it's written", () => {
    const orders = [["amplify", "split", "split"], ["split", "amplify", "split"], ["split", "split", "amplify"]];
    for (const modifiers of orders) {
      const fight = fightWith([at(0, -2)]);
      castNow(fight, one("bolt", ["water"], modifiers as Modifier[]));
      const hits = skillHits(fight);
      assert.ok(hits.length > 0);
      for (const damage of hits) close(damage, W * D * (1 + A.amplify) * B.splitDamageFactor ** 2);
    }
  });

  test("Follow homes every Bolt, wherever it's written", () => {
    for (const modifiers of [["follow", "split", "split"], ["split", "split", "follow"]]) {
      const fight = fightWith([at(0, 4)]);
      castNow(fight, one("bolt", ["water"], modifiers as Modifier[]));
      assert.equal(skillHits(fight).length, 4);
    }
  });

  const seeded = (seed: number, radius = ARENA.radius) =>
    new Fight({ arena: { radius }, players: [player(ME, { seed })], enemies: [enemy(STATUE, at(5, 5))] });
  const startOf = (o: SkillObjectData): Vec3 => ({
    x: o.pos.x - o.dir.x * o.flownM, y: o.pos.y - o.climbPerM * Math.min(o.flownM, o.climbUntilM),
    z: o.pos.z - o.dir.z * o.flownM,
  });
  const starts = (fight: Fight, n: number) => {
    castNow(fight, one("bolt", ["water"], splits(n)));
    return objects(fight, "bolt").map(([, o]) => startOf(o));
  };

  test("the Bolts start in an upright circle round the caster, across the aim, clear of the ground", () => {
    for (const n of [1, 2, 4, 6]) {
      const fight = seeded(1);
      const me = fight.world.require(fight.players[0]!, Body).pos;
      for (const p of starts(fight, n)) {
        close(p.z, me.z);
        assert.ok(Math.abs(p.x - me.x) <= B.splitRingMaxM + 1e-9, `${n} Splits: ${p.x}`);
        assert.ok(p.y >= B.splitGroundM - 1e-9, `${n} Splits: ${p.y} underground`);
        assert.ok(p.y <= B.splitGroundM + 2 * B.splitRingMaxM + 1e-9, `${n} Splits: ${p.y}`);
      }
    }
  });

  test("the Bolts start at least two radii apart, however many fit the circle", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (let n = 1; 2 ** n <= B.splitRingMaxM ** 2 / B.splitRingPerRootM ** 2; n++) {
        const spots = starts(seeded(seed), n);
        const gapM = B.splitGapRadii * B.radiusM * B.splitRadiusFactor ** n;
        for (const a of spots) for (const b of spots) {
          if (a === b) continue;
          const apartM = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
          assert.ok(apartM >= gapM - 1e-9, `seed ${seed}, ${n} Splits: ${apartM} < ${gapM}`);
        }
      }
    }
  });

  test("by the wall, they all start inside the arena", () => {
    const fight = fightWith([at(0, 2)], 5);
    castNow(fight, one("bolt", ["water"], splits(4)), { aimX: 1, aimZ: 0 });
    const flying = objects(fight, "bolt").map(([, o]) => o);
    assert.equal(flying.length, 2 ** 4);
    for (const o of flying) assert.ok(Math.hypot(o.pos.x, o.pos.z) < 5, `${o.pos.x}, ${o.pos.z} outside`);
  });

  test("the fight's seed places them: the same seed, the same spots", () => {
    assert.deepEqual(starts(seeded(7), 3), starts(seeded(7), 3));
    assert.notDeepEqual(starts(seeded(7), 3), starts(seeded(8), 3));
  });

  test("they fly in to meet near a point ahead, each off it by at most the jitter, then on straight", () => {
    const fight = seeded(3, 30);
    const me = { ...fight.world.require(fight.players[0]!, Body).pos };
    castNow(fight, one("bolt", ["water"], splits(3)));
    const focus = { x: me.x, y: me.y, z: me.z + B.splitFocusM };
    const flying = objects(fight, "bolt").map(([, o]) => o);
    const nearestM = flying.map(() => Infinity), last = flying.map((o) => ({ ...o.pos }));
    for (let i = 0; i < 120 && objects(fight, "bolt").length === flying.length; i++) {
      fight.step([IDLE]);
      flying.forEach((o, j) => {
        const a = last[j]!, b = o.pos;
        const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
        const t = Math.max(0, Math.min(1, ((focus.x - a.x) * d.x + (focus.y - a.y) * d.y + (focus.z - a.z) * d.z)
          / (d.x * d.x + d.y * d.y + d.z * d.z || 1)));
        const near = Math.hypot(a.x + d.x * t - focus.x, a.y + d.y * t - focus.y, a.z + d.z * t - focus.z);
        nearestM[j] = Math.min(nearestM[j]!, near);
        if (o.flownM > o.climbUntilM + 1) close(b.y, a.y);
        last[j] = { ...b };
      });
    }
    for (const m of nearestM) assert.ok(m <= B.splitJitterM + 1e-6, `${m} off the point`);
    assert.ok(Math.max(...nearestM) > 0.01, "not all through one pinpoint");
  });

  test("every Bolt hands off", () => {
    const fight = fightWith([at(0, 4)]);
    const novas: FightEvent[] = [];
    castNow(fight, skill(segment("bolt", ["water"], ["split"]), segment("nova")));
    for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) {
      fight.step([IDLE]);
      novas.push(...fight.events.filter((e) => e.type === "skill" && e.form === "nova"));
    }
    assert.equal(novas.length, 2);
  });
});

describe("Swift", () => {
  test("a Bolt flies faster", () => {
    const plain = fightWith([at(0, 7)]), swift = fightWith([at(0, 7)]);
    castNow(plain, one("bolt", ["water"], []));
    castNow(swift, one("bolt", ["water"], ["swift"]));
    const flown = (f: Fight) => objects(f, "bolt")[0]![1].flownM;
    close(flown(swift) / flown(plain), 1 + A.swift);
  });

  test("an Imbue's swings start quicker", () => {
    const plain = fightWith([at(5, 5)]), swift = fightWith([at(5, 5)]);
    castNow(plain, one("imbue", ["fire"], []));
    castNow(swift, one("imbue", ["fire"], ["swift"]));
    for (const f of [plain, swift]) f.step([input({ attack: "lr" })]);
    const liveAt = (f: Fight) => f.world.require(f.players[0]!, Wielder).swing?.liveAt;
    assert.equal(liveAt(plain), liveStep(CHAIN.startupTime.opening));
    assert.equal(liveAt(swift), liveStep(CHAIN.startupTime.opening / (1 + A.swift)));
  });
});

describe("Extend", () => {
  test("Self's statuses last longer", () => {
    const plain = fightWith([at(5, 5)]), long = fightWith([at(5, 5)]);
    castNow(plain, one("self", ["fire"], []));
    castNow(long, one("self", ["fire"], ["extend"]));
    const left = (f: Fight) => f.world.require(f.players[0]!, Statuses).left.empowered;
    close(left(long), left(plain) + SKILL_EFFECTS.self.fire.time * A.extend);
  });

  test("an Imbue holds more hits", () => {
    const fight = fightWith([at(5, 5)]);
    castNow(fight, one("imbue", ["fire"], ["extend"]));
    assert.equal(objects(fight, "imbue")[0]![1].hitsLeft, Math.round(SKILL_EFFECTS.imbue.hits * (1 + A.extend)));
  });

  test("a Beam lasts longer", () => {
    const fight = fightWith([at(5, 5)]);
    castNow(fight, one("beam", ["water"], ["extend"]));
    run(fight, SKILL_EFFECTS.beam.time * (1 + A.extend) - 0.1);
    assert.equal(objects(fight, "beam").length, 1);
    run(fight, 0.2);
    assert.equal(objects(fight, "beam").length, 0);
  });
});

describe("Delay", () => {
  test("holds back the hand-off after its segment completes", () => {
    const fight = fightWith([at(0, 0)]);
    castNow(fight, skill(segment("bolt", ["water"], ["delay"]), segment("nova", ["earth"])));
    untilDone(fight);
    run(fight, A.delayTime - 0.1);
    close(lostHp(fight, 0), W * D);
    run(fight, 0.2);
    close(lostHp(fight, 0), (W + SKILL_EFFECTS.elements.earth.damage) * D);
  });
});

describe("Follow", () => {
  const AWAY = { aimX: Math.sin(0.3), aimZ: Math.cos(0.3) };
  const FAR = at(0, 4);
  const bolts = (fight: Fight) => objects(fight, "bolt").map(([, o]) => o);

  test("aimed a little away, a Bolt homes onto the nearest enemy when nothing is locked", () => {
    const plain = fightWith([FAR]), homing = fightWith([FAR]);
    castNow(plain, one("bolt", ["water"], []), AWAY);
    castNow(homing, one("bolt", ["water"], ["follow"]), AWAY);
    untilDone(plain);
    untilDone(homing);
    assert.equal(lostHp(plain, 0), 0);
    close(lostHp(homing, 0), W * D);
  });

  test("it homes onto the locked enemy, not the nearest", () => {
    const enemies = [at(-1.5, 3), at(1.5, 4)];
    const unlocked = fightWith(enemies), locked = fightWith(enemies);
    castNow(unlocked, one("bolt", ["water"], ["follow"]));
    castNow(locked, one("bolt", ["water"], ["follow"]), { locked: 1 });
    untilDone(unlocked);
    untilDone(locked);
    assert.ok(lostHp(unlocked, 0) > 0 && lostHp(unlocked, 1) === 0, "the nearest");
    assert.ok(lostHp(locked, 1) > 0 && lostHp(locked, 0) === 0, "the locked one");
  });

  test("it turns no faster than its turn rate", () => {
    const fight = fightWith([at(4, -2)]);
    castNow(fight, one("bolt", ["water"], ["follow"]));
    let yaw = Math.atan2(bolts(fight)[0]!.dir.x, bolts(fight)[0]!.dir.z);
    for (let i = 0; i < 10; i++) {
      fight.step([IDLE]);
      const now = Math.atan2(bolts(fight)[0]!.dir.x, bolts(fight)[0]!.dir.z);
      assert.ok(Math.abs(now - yaw) <= A.followTurnRadPerSec * Fight.STEP_SECONDS + 1e-9, `${now - yaw}`);
      yaw = now;
    }
  });

  test("an enemy that moves aside early is still found; one that moves aside as the Bolt arrives isn't", () => {
    const sideM = 1.5;
    const moveAsideWhen = (closeM: number) => {
      const fight = fightWith([FAR]);
      castNow(fight, one("bolt", ["water"], ["follow"]));
      const body = fight.world.require(fight.enemies[0]!, Body);
      for (let i = 0; i < 240 && bolts(fight).length > 0; i++) {
        const bolt = bolts(fight)[0]!;
        if (body.pos.x === FAR.x && Math.hypot(bolt.pos.x - body.pos.x, bolt.pos.z - body.pos.z) <= closeM) {
          body.pos.x += sideM;
          fight.physics.place(body.collider, body.pos);
        }
        fight.step([IDLE]);
      }
      return lostHp(fight, 0);
    };
    assert.ok(moveAsideWhen(7) > 0, "moved early");
    assert.equal(moveAsideWhen(1.5), 0, "moved late");
  });

  test("split Bolts come in apart: Split twice and Follow, still two radii apart halfway there, however strong", () => {
    for (const follows of [1, 3]) {
      const words = segment("bolt", ["water"], ["split", "split", ...Array<Modifier>(follows).fill("follow")]);
      const fight = fightWith([FAR]);
      castNow(fight, skill(words));
      const halfwayM = (FAR.z - ME.z) / 2;
      for (let i = 0; i < 240 && bolts(fight)[0]!.flownM < halfwayM; i++) fight.step([IDLE]);
      const flying = bolts(fight);
      assert.equal(flying.length, shotOf(words).bolts);
      let nearestM = Infinity;
      for (const a of flying) for (const b of flying) {
        if (a !== b) nearestM = Math.min(nearestM, Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z));
      }
      assert.ok(nearestM >= 2 * shotOf(words).boltRadiusM, `${follows} Follow: ${nearestM}`);
    }
  });



});
