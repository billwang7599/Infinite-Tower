import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Enemy, FIXED_DT, gripOf, guardRaiseTime, HYBRID, IDLE_INPUT, parryWay, Player, strikeDamage, strikeOf,
  toSteps, wayStepsAfter, WEAPONS, Wielder, windupTime, type EnemyDef, type Skill, type SwingDir,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { PLAYER_STATS } from "../../../src/core/content/player.js";
import { fightWith, gripStrengthOf, setupWith } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;
const SEEDS = [1, 2, 3, 1234, 99999];

describe("the Kobold Swordsman", () => {
  test("its first swing winds up a player's opening with its blade, which swings as the Iron shortsword", () => {
    const fight = fightWith(KOBOLD, 1), wielder = fight.world.require(fight.enemies[0]!, Wielder);
    for (let i = 0; i < 10 / FIXED_DT && wielder.swing?.step !== 1; i++) fight.step([IDLE_INPUT]);
    assert.equal(wielder.swing?.step, 1);
    const strike = strikeOf(wielder.swing!.attack, wielder.swing!.way);
    const liveAt = (blade: "sword" | "kobold-blade") =>
      wayStepsAfter(WEAPONS[blade], strike, windupTime(WEAPONS[blade], strike, "opening"), gripStrengthOf(KOBOLD)).liveAt;
    assert.equal(wielder.swing!.liveAt, liveAt("kobold-blade"));
    assert.equal(liveAt("kobold-blade"), liveAt("sword"));
  });

  test("its other hand empty, it still holds its blade in one: a one-handed wind-up and damage", () => {
    const fight = fightWith(KOBOLD, 1), wielder = fight.world.require(fight.enemies[0]!, Wielder);
    assert.equal(wielder.hands.leftHand, null);
    assert.equal(gripOf(wielder.hands), "one");
    for (let i = 0; i < 10 / FIXED_DT && wielder.swing?.step !== 1; i++) fight.step([IDLE_INPUT]);
    const swing = wielder.swing!, strike = strikeOf(swing.attack, swing.way), blade = WEAPONS["kobold-blade"];
    const opening = wayStepsAfter(blade, strike, windupTime(blade, strike, "opening"), gripStrengthOf(KOBOLD));
    assert.equal(swing.liveAt, opening.liveAt);
    assert.deepEqual(swing.damage, strikeDamage(blade, strike, 1, KOBOLD.stats));
  });

  test("its own blade never drops: only its essence, besides treasure", () => {
    assert.equal(KOBOLD.wielder?.hands.rightHand, "kobold-blade");
    assert.deepEqual(ENEMIES["kobold-swordsman"].drops.map((d) => d.item), ["kobold-swordsman-essence"]);
  });
});

describe("losing a parry to a swordsman", () => {
  const PAST_CLASH_STEPS = toSteps(HYBRID.parry.clashTime) + 2;
  type Mine = "sword" | "wooden-sword";

  function answerLate(def: EnemyDef, mine: Mine, heavy: boolean, seed: number) {
    const weapon = { ...def.attacks.weapon!, heavyShare: heavy ? 1 : 0, heavyFeintShare: 0 };
    const setup = setupWith({ ...def, attacks: { weapon } }), gear = setup.players[0]!.gear;
    gear.equipment = { ...gear.equipment, rightHand: mine };
    const fight = new Fight({ ...setup, enemies: [{ ...setup.enemies[0]!, seed }] });
    const opening = wayStepsAfter(WEAPONS[mine], "light", windupTime(WEAPONS[mine], "light", "opening"),
      PLAYER_STATS.strength).liveAt;
    const me = fight.players[0]!, it = fight.enemies[0]!;
    const wielder = fight.world.require(it, Wielder), player = fight.world.require(me, Player);
    const blade = WEAPONS[def.wielder!.hands.rightHand as "sword"];
    let press = -1, way: SwingDir = "lr", parried = -1, free = -1, counter = -1, counterLiveAt = -1, expected = -1;
    const after: FightEvent[] = [];
    while (fight.steps < 30 / FIXED_DT && (counter < 0 || fight.steps < counter + 30)) {
      const s = fight.steps + 1;
      fight.step([{ ...IDLE_INPUT, locked: 0, way, attack: s === press ? "light" : null, block: parried >= 0 }]);
      if (parried >= 0) after.push(...fight.events);
      const swing = wielder.swing;
      if (press < 0 && swing?.step === 1 && swing.way !== "stab") {
        way = parryWay(swing.way);
        press = fight.steps + swing.liveAt + PAST_CLASH_STEPS - opening;
      }
      if (parried < 0 && fight.events.some((e) => e.type === "parry" && e.by === it && !e.clash)) parried = fight.steps;
      else if (parried >= 0 && free < 0 && player.action !== "stagger") free = fight.steps;
      if (parried >= 0 && counter < 0 && swing?.step === 1) {
        counter = fight.steps + swing.liveAt;
        counterLiveAt = swing.liveAt;
        const strike = strikeOf(swing.attack, swing.way);
        expected = wayStepsAfter(blade, strike, windupTime(blade, strike, "opening"), gripStrengthOf(def)).liveAt;
      }
    }
    return { parried, free, counter, counterLiveAt, expected, after, me, it };
  }

  test("its counter winds up as a player's opening, and lands only after the player is free to raise a block", () => {
    const fights = [
      [KOBOLD, "sword"], [ENEMIES["kobold-greatsword"].def, "sword"], [ENEMIES.bram.def, "wooden-sword"],
    ] as const;
    for (const [def, mine] of fights) {
      const raise = toSteps(guardRaiseTime(WEAPONS[mine], PLAYER_STATS.strength));
      for (const [heavy, seed] of SEEDS.flatMap((seed) => [[false, seed], [true, seed]] as const)) {
        const r = answerLate(def, mine, heavy, seed), name = `${def.id}${heavy ? " heavy" : ""} seed ${seed}`;
        assert.ok(r.parried >= 0 && r.free >= 0 && r.counter >= 0, `${name}: ${JSON.stringify(r)}`);
        assert.ok(r.counter - r.free >= raise, `${name}: free at ${r.free}, its counter live at ${r.counter}`);
        assert.ok(!r.after.some((e) => e.type === "hit" && e.target === r.me), `${name}: never hit`);
        assert.ok(r.after.some((e) => e.type === "block" && e.target === r.me && e.by === r.it), `${name}: blocked`);
        assert.equal(r.counterLiveAt, r.expected, `${name}: the player's math`);
      }
    }
  });
});

describe("stepping aside from a Bolt", () => {
  const BOLT: Skill = { segments: [{ form: "bolt", elements: [], modifiers: [] }] };
  const stepsAside = (def: EnemyDef, seed: number) => {
    const fight = fightWith(def, seed);
    const aimed = { ...IDLE_INPUT, aimX: 0, aimZ: 1 };
    fight.step([{ ...aimed, chant: true }]);
    fight.step([{ ...aimed, cast: BOLT }]);
    for (let i = 0; i < 1 / FIXED_DT; i++) {
      fight.step([aimed]);
      if (fight.world.require(fight.enemies[0]!, Enemy).state === "sidestep") return true;
    }
    return false;
  };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

  test("the Kobold sometimes does", () => assert.ok(seeds.some((seed) => stepsAside(KOBOLD, seed))));
  test("the boar never does", () => assert.ok(!seeds.some((seed) => stepsAside(ENEMIES["wild-boar"].def, seed))));
});
