import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CHAIN, emptyBag, packFor, Health, HYBRID, parryKind, parryRecoilTime, parryWay, parryWindowTime, perfectBlockTime,
  Player, SWING_DIRS, swingWeight, toSteps, WEAPONS, Wielder, wayStepsAfter, type ItemId, type PlayerInputData,
  type Strike, type Way,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, FULL_HP, FULL_STAMINA, input, player, STATS, armed } from "../fixtures.js";

await initPhysics();

const pvp = (blade: ItemId = "sword") => new Fight({
  arena: ARENA, duel: true, enemies: [],
  players: [
    player({ x: 0, y: 0.05, z: 0 }),
    player({ x: 0, y: 0.05, z: 1.6 }, {
      vitals: { hp: FULL_HP, stamina: FULL_STAMINA },
      gear: {
        bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: { ...armed(), rightHand: blade },
      },
    }),
  ],
});
const FACING_0 = { aimX: 0, aimZ: -1, locked: 0 };

const liveAfter = (strike: Strike, blade: ItemId = "sword") => {
  const windup = strike === "stab" ? CHAIN.stabStartupTime
    : CHAIN.startupTime.opening + (strike === "heavy" ? HYBRID.heavy.extraTime : 0);
  return wayStepsAfter(WEAPONS[blade as "sword"], windup, strike === "heavy").liveAt;
};

const PRESS = 60;
const LANDS = PRESS + liveAfter("light");

interface Exchange {
  way: Way; strike?: Strike;
  answer: Way; answerStrike?: Strike;
  /** Steps the answer's blade goes live before the attack's would land (negative: after). */
  lead: number;
  blade?: ItemId;
}

function exchange(x: Exchange) {
  const fight = pvp(x.blade), strike = x.strike ?? "light", answerStrike = x.answerStrike ?? "light";
  const lands = PRESS + liveAfter(strike);
  const answerAt = lands - x.lead - liveAfter(answerStrike, x.blade);
  const events: FightEvent[] = [];
  let parryStep: number | null = null;
  const hitstun: [number, number] = [0, 0];
  const atk = (s: number): Partial<PlayerInputData> =>
    ({ way: x.way === "stab" ? null : x.way, attack: s === PRESS ? strike : null });
  const ans = (s: number): Partial<PlayerInputData> =>
    ({ way: x.answer === "stab" ? null : x.answer, attack: s === answerAt ? answerStrike : null });
  while (fight.steps < lands + 30) {
    const s = fight.steps + 1;
    fight.step([input({ locked: 1, ...atk(s) }), input({ ...FACING_0, ...ans(s) })]);
    events.push(...fight.events);
    if (parryStep === null && fight.events.some((e) => e.type === "parry")) {
      parryStep = s;
      for (const i of [0, 1] as const) hitstun[i] = fight.world.require(fight.players[i]!, Health).hitstun;
    }
  }
  const [me, them] = fight.players as [number, number];
  return {
    fight, events, me, them, hitstun, parryStep,
    hp: (i: 0 | 1) => fight.world.require(fight.players[i]!, Health).hp,
    hits: events.filter((e) => e.type === "hit"),
    parry: events.find((e) => e.type === "parry"),
  };
}
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} vs ${b}`);
const WINDOW = toSteps(parryWindowTime(WEAPONS.sword));
const CLASH = toSteps(HYBRID.parry.clashTime);

describe("which ways parry", () => {
  test("facing each other, the same named way meets head on: a full parry; 45° off it a partial one", () => {
    assert.equal(parryKind("lr", "lr"), "full");
    assert.equal(parryKind("tlbr", "bltr"), "full");
    assert.equal(parryKind("tlbr", "lr"), "partial");
    assert.equal(parryKind("tb", "bltr"), "partial");
    assert.equal(parryKind("rl", "lr"), null);
    assert.equal(parryKind("tlbr", "trbl"), null);
  });

  test("stabs neither parry nor get parried", () => {
    assert.equal(parryKind("stab", "lr"), null);
    assert.equal(parryKind("lr", "stab"), null);
  });

  test("the way to parry with is the full parry where there is one, else a partial one", () => {
    for (const way of SWING_DIRS) assert.notEqual(parryKind(parryWay(way), way), null, way);
    assert.equal(parryKind(parryWay("lr"), "lr"), "full");
    assert.equal(parryKind(parryWay("tlbr"), "tlbr"), "full");
  });
});

describe("a swing parried by a swing", () => {
  test("the reverse swing live just before the attack lands deflects it: no damage, the attacker recoils", () => {
    const r = exchange({ way: "lr", answer: "lr", lead: CLASH + 2 });
    assert.ok(r.parry?.type === "parry" && !r.parry.clash && r.parry.by === r.them && r.parry.target === r.me);
    assert.equal(r.hits.length, 0);
    assert.equal(r.hp(0), FULL_HP);
    assert.equal(r.hp(1), FULL_HP);
    close(r.hitstun[0], HYBRID.parry.fullRecoilTime, "the attacker's recoil");
    assert.equal(r.hitstun[1], 0, "the parrier doesn't recoil");
  });

  test("the parrier skips its recovery: it can swing again at once", () => {
    const r = exchange({ way: "lr", answer: "lr", lead: CLASH + 2 });
    const fight = pvp();
    for (let s = 1; s <= r.parryStep!; s++) {
      const answerAt = LANDS - (CLASH + 2) - liveAfter("light");
      fight.step([input({ locked: 1, way: "lr", attack: s === PRESS ? "light" : null }),
        input({ ...FACING_0, way: "lr", attack: s === answerAt ? "light" : null })]);
    }
    assert.equal(fight.world.require(fight.players[1]!, Wielder).swing, null);
    fight.step([input({ locked: 1 }), input({ ...FACING_0, way: "rl", attack: "heavy" })]);
    assert.equal(fight.world.require(fight.players[1]!, Player).action, "attack");
    assert.equal(fight.world.require(fight.players[1]!, Wielder).swing?.attack, "heavy");
  });

  test("45° off the reverse, a partial parry: a shorter recoil", () => {
    const r = exchange({ way: "lr", answer: "tlbr", lead: CLASH + 2 });
    assert.ok(r.parry && !r.parry.clash);
    assert.equal(r.hits.length, 0);
    close(r.hitstun[0], HYBRID.parry.partialRecoilTime, "partial recoil");
  });

  test("a swing that isn't at a parry angle trades: both land", () => {
    const r = exchange({ way: "lr", answer: "rl", lead: CLASH + 2 });
    assert.equal(r.parry, undefined);
    assert.ok(r.hits.some((e) => e.type === "hit" && e.target === r.me));
    assert.ok(r.hits.some((e) => e.type === "hit" && e.target === r.them));
  });

  test("its window is wider than a perfect block's: live earlier than a perfect block works, it still deflects", () => {
    const lead = toSteps(perfectBlockTime(WEAPONS.sword)) + 2;
    const r = exchange({ way: "lr", answer: "lr", lead });
    assert.ok(r.parry?.type === "parry" && !r.parry.clash && r.parry.by === r.them, `lead ${lead}`);
    assert.equal(r.hits.length, 0);
    assert.ok(lead <= WINDOW);
  });

  test("live longer than the window before, it's no parry", () => {
    const r = exchange({ way: "lr", answer: "lr", lead: WINDOW + 3 });
    assert.equal(r.parry, undefined);
    assert.ok(r.hits.some((e) => e.type === "hit" && e.target === r.them));
  });

  test("the window grows with the parrier's blade", () => {
    const lead = WINDOW + 3;
    assert.ok(lead <= toSteps(parryWindowTime(WEAPONS.greatsword)));
    const r = exchange({ way: "lr", answer: "lr", lead, blade: "greatsword" });
    assert.ok(r.parry && !r.parry.clash && r.parry.by === r.them);
    assert.equal(r.hits.length, 0);
  });

  test("whichever blade comes first parries: a reverse swing coming too late is parried by the attack", () => {
    const r = exchange({ way: "lr", answer: "lr", lead: -(CLASH + 2) });
    assert.ok(r.parry && !r.parry.clash && r.parry.by === r.me && r.parry.target === r.them);
    assert.equal(r.hits.length, 0);
  });

  test("stabs can't be parried, and can't parry", () => {
    const stabbed = exchange({ way: "stab", strike: "stab", answer: "lr", lead: CLASH + 2 });
    assert.equal(stabbed.parry, undefined);
    assert.ok(stabbed.hits.some((e) => e.type === "hit" && e.target === stabbed.them));
    const stabbing = exchange({ way: "lr", answer: "stab", answerStrike: "stab", lead: CLASH + 2 });
    assert.equal(stabbing.parry, undefined);
    assert.ok(stabbing.hits.length > 0);
  });

  test("blades live within the clash time of each other clash: both stagger briefly, nobody is hurt", () => {
    for (const [way, answer] of [["lr", "lr"], ["lr", "tlbr"]] as const) {
      for (const lead of [0, CLASH, -CLASH]) {
        const r = exchange({ way, answer, lead });
        assert.ok(r.parry?.type === "parry" && r.parry.clash, `${answer} ${lead}`);
        assert.equal(r.hits.length, 0, `${answer} ${lead}`);
        close(r.hitstun[0], HYBRID.parry.clashStaggerTime, `${answer} ${lead} first`);
        close(r.hitstun[1], HYBRID.parry.clashStaggerTime, `${answer} ${lead} second`);
      }
    }
    assert.ok(HYBRID.parry.clashStaggerTime < HYBRID.parry.partialRecoilTime, "briefer than any parry's recoil");
  });
});

describe("the weight of a swing", () => {
  test("is the blade's heft, by the square root of strength over 10, twice for a heavy", () => {
    close(swingWeight(WEAPONS.sword, STATS.strength, false), WEAPONS.sword.heft, "sword");
    close(swingWeight(WEAPONS.greatsword, 40, true), WEAPONS.greatsword.heft * 2 * HYBRID.parry.heavyWeightFactor,
      "greatsword heavy at 40");
  });

  test("a heavy parrying a heavy is a light parrying a light; heavier against lighter recoils it longer", () => {
    const heavy = exchange({ way: "lr", strike: "heavy", answer: "lr", answerStrike: "heavy", lead: CLASH + 2 });
    close(heavy.hitstun[0], HYBRID.parry.fullRecoilTime, "heavy on heavy");
    const onLight = exchange({ way: "lr", answer: "lr", answerStrike: "heavy", lead: CLASH + 2 });
    close(onLight.hitstun[0], HYBRID.parry.fullRecoilTime * HYBRID.parry.heavyWeightFactor, "heavy on light");
    const onHeavy = exchange({ way: "lr", strike: "heavy", answer: "lr", lead: CLASH + 2 });
    close(onHeavy.hitstun[0], HYBRID.parry.fullRecoilTime / HYBRID.parry.heavyWeightFactor, "light on heavy");
  });

  test("the ratio is held between its bounds and the recoil never goes under the floor", () => {
    const { fullRecoilTime: full, minRatio, maxRatio, minRecoilTime } = HYBRID.parry;
    close(parryRecoilTime(full, 100), full * maxRatio, "capped");
    close(parryRecoilTime(full, 0.01), full * minRatio, "held up");
    close(parryRecoilTime(minRecoilTime / 2, 1), minRecoilTime, "floor");
  });
});
