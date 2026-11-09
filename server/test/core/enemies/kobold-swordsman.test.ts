import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, gripOf, guardRaiseTime, Health, HYBRID, IDLE_INPUT, parryWay, Player, strikeDamage, strikeOf,
  toSteps, wayStepsAfter, WEAPONS, Wielder, windupTime, type EnemyDef, type PlayerInputData, type Skill, type SwingDir,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { PLAYER_STATS } from "../../../src/core/content/player.js";
import { fightWith, FULL, gripStrengthOf, setupWith } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;

const PERFECT_LEAD_STEPS = 6;
const SEEDS = [1, 2, 3, 1234, 99999];

function reader(fight: Fight): PlayerInputData {
  const at = fight.world.require(fight.players[0]!, Body).pos;
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const swing = fight.world.require(fight.enemies[0]!, Wielder).swing;
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.2 ? 1 : dist < 1.4 ? -1 : 0;
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ, locked: 0,
    way: Math.floor(fight.steps / 20) % 2 === 0 ? "lr" : "rl",
  };
  if (swing && swing.step < swing.liveAt) {
    input.block = swing.liveAt - swing.step <= PERFECT_LEAD_STEPS;
    return input;
  }
  const even = fight.steps % 2 === 0;
  if (kobold.state === "staggered" || kobold.state === "weaponRecover") input.attack = even ? "light" : null;
  return input;
}

const play = (seed: number, next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(KOBOLD, seed);
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp };
};

describe("the Kobold Swordsman", () => {
  test("its first swing winds up a player's opening with its blade, which feels as the Basic Sword", () => {
    const fight = fightWith(KOBOLD, 1), wielder = fight.world.require(fight.enemies[0]!, Wielder);
    for (let i = 0; i < 10 / FIXED_DT && wielder.swing?.step !== 1; i++) fight.step([IDLE_INPUT]);
    assert.equal(wielder.swing?.step, 1);
    const strike = strikeOf(wielder.swing!.attack, wielder.swing!.way);
    const liveAt = (blade: "sword" | "kobold-blade" | "old-stick") =>
      wayStepsAfter(WEAPONS[blade], strike, windupTime(WEAPONS[blade], strike, "opening"), gripStrengthOf(KOBOLD)).liveAt;
    assert.equal(wielder.swing!.liveAt, liveAt("kobold-blade"));
    assert.equal(liveAt("kobold-blade"), liveAt("sword"));
    assert.ok(liveAt("sword") >= liveAt("old-stick"));
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

  test("a player who reads it beats it, whatever its seed", () => {
    for (const seed of SEEDS) {
      const { fight, hp } = play(seed, reader);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 4, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who only holds a block loses: its blows wear the stamina down, the guard breaks and it cuts", () => {
    const { fight } = play(1, (f) => ({ ...reader(f), block: true, attack: null }));
    assert.equal(fight.outcome.state, "lost");
  });

  test("a player who only swings at it mostly loses", () => {
    const masher = (f: Fight): PlayerInputData =>
      ({ ...reader(f), block: false, attack: f.steps % 2 === 0 ? "light" : null });
    const lost = SEEDS.filter((seed) => play(seed, masher).fight.outcome.state === "lost").length;
    assert.ok(lost > SEEDS.length / 2, `lost ${lost} of ${SEEDS.length}`);
  });

  test("its own blade never drops: only its essence, besides treasure", () => {
    assert.equal(KOBOLD.wielder?.hands.rightHand, "kobold-blade");
    assert.deepEqual(ENEMIES["kobold-swordsman"].drops.map((d) => d.item), ["kobold-swordsman-essence"]);
  });
});

describe("losing a parry to a swordsman", () => {
  const PAST_CLASH_STEPS = toSteps(HYBRID.parry.clashTime) + 2;
  type Mine = "sword" | "old-stick";

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
      [KOBOLD, "sword"], [ENEMIES["kobold-greatsword"].def, "sword"], [ENEMIES.bram.def, "old-stick"],
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
