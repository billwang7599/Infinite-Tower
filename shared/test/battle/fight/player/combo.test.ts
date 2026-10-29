import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackShape, Enemy, followingBlade, liveStep, planSwing, Player, PLAYER, restingBlade, Stamina, stepsUntil, SWING,
  WEAPONS, Wielder, type AttackKind, type Blade, type EnemyDef, type PlayerData, type PlayerInputData, type SwingDir,
  type WielderData,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BITER, enemy, input, player, STATS, STATUE } from "../fixtures.js";

before(() => initPhysics());

const SWORD = WEAPONS.sword, STRENGTH = STATS.strength;
const BASE_DAMAGE = SWORD.damage;
/** A statue right in front, in reach of every attack; or far away, out of reach of all. */
const NEAR = attackShape("lr", PLAYER.armReachM, SWORD).range + STATUE.radius - 0.4;
const FAR = 30;
const TOUGH: EnemyDef = { ...STATUE, maxHp: 10000 };

/** Stamina enough for any chain here. */
const newFight = (at = NEAR, def: EnemyDef = TOUGH) => new Fight({
  arena: { radius: Math.max(ARENA.radius, at + 2) },
  players: [player({ x: 0, y: 0.05, z: 0 }, {
    vitals: { hp: PLAYER.maxHp, stamina: 1000 }, stats: { ...STATS, stamina: 1000 },
  })],
  enemies: [enemy(def, { x: 0, y: 0.05, z: at })],
});

/** What the player does on a step, seeing how they stood after the last one. */
type Script = (step: number, me: PlayerData, wielder: WielderData) => Partial<PlayerInputData>;

interface Played {
  fight: Fight;
  starts: number[];
  live: number[];
  costs: number[];
  damage: number[];
  poise: number[];
  blades: Blade[];
  hurt: number[];
}

function play(script: Script, to = 200, fight = newFight()): Played {
  const me = fight.players[0]!, foe = fight.world.require(fight.enemies[0]!, Enemy);
  const stamina = fight.world.require(me, Stamina);
  const out: Played = { fight, starts: [], live: [], costs: [], damage: [], poise: [], blades: [], hurt: [] };
  let wasLive = false;
  while (fight.steps < to) {
    const step = fight.steps + 1;
    const wielder = fight.world.require(me, Wielder), staminaBefore = stamina.value, poiseBefore = foe.poise;
    fight.step([input(script(step, fight.world.require(me, Player), wielder))]);
    const swing = wielder.swing;
    if (swing && swing.step <= 1) {
      out.starts.push(step);
      out.costs.push(staminaBefore - stamina.value);
    }
    const live = swing !== null && swing.step > swing.liveAt && swing.step <= swing.liveUntil;
    if (live && !wasLive) out.live.push(step);
    wasLive = live;
    for (const ev of fight.events) {
      if (ev.type === "hit" && ev.team === "enemy") {
        out.damage.push(ev.damage);
        out.poise.push(poiseBefore - foe.poise);
      }
      if (ev.type === "hit" && ev.team === "player") out.hurt.push(step);
    }
    out.blades.push({ ...wielder.blade });
  }
  return out;
}

// Each next press two steps after the last swing started, so the same attack twice is two presses.
function chainOf(kinds: AttackKind[], then: Script = () => ({})): Script {
  let next = 0;
  return (step, me, wielder) => {
    const swing = wielder.swing, lastStarted = swing !== null && swing.step === 2 && swing.attack === kinds[next - 1];
    const due = (next === 0 && step === 5) || (next > 0 && next < kinds.length && lastStarted);
    if (due) return { attack: kinds[next++]! };
    return next >= kinds.length && step > 5 ? then(step, me, wielder) : {};
  };
}

function planOf(kinds: AttackKind[]) {
  let blade = restingBlade(), plan = planSwing(SWORD, STRENGTH, blade, kinds[0]!);
  for (const kind of kinds) {
    plan = planSwing(SWORD, STRENGTH, blade, kind);
    blade = followingBlade(kind, plan.flow);
  }
  return plan;
}

describe("when the next swing starts", () => {
  test("pressed early, it starts on the step the last one lets go, never cutting it short", () => {
    const { starts } = play(chainOf(["lr", "tb"]), 120, newFight(FAR));
    assert.equal(starts[1]! - starts[0]!, stepsUntil((SWING.setTime + SWING.driveTime) + SWING.activeTime));
  });

  test("from rest it goes live after it's set and driven; reversing the blade, after braking it and a drive", () => {
    const { starts, live } = play(chainOf(["lr", "rl"]), 120, newFight(FAR));
    assert.equal(live[0]! - starts[0]!, liveStep(SWING.setTime + SWING.driveTime));
    assert.equal(live[1]! - starts[1]!, liveStep(2 * SWING.driveTime));
  });

  test("the same swing again, the blade looping round on its way, goes live far sooner than from rest", () => {
    const { starts, live } = play(chainOf(["lr", "lr"]), 120, newFight(FAR));
    assert.ok(live[1]! - starts[1]! < 0.6 * (live[0]! - starts[0]!));
  });

  test("every order takes the time the blade needs to get to its start: in the fight as in the plan", () => {
    for (const kinds of [["lr", "lr"], ["lr", "tb"], ["lr", "tlbr"], ["tb", "bt", "tb"], ["lr", "stab", "rl"]] as
      AttackKind[][]) {
      const { starts, live } = play(chainOf(kinds), 60 + kinds.length * 30, newFight(FAR));
      assert.equal(live.at(-1)! - starts.at(-1)!, liveStep(planOf(kinds).windupTime), kinds.join(" "));
    }
  });
});

describe("how hard it hits and what it costs", () => {
  test("a swing carrying the blade on its way hits harder (and staggers more); a reverse doesn't", () => {
    const flowing = play(chainOf(["lr", "lr", "lr"]), 200);
    assert.equal(flowing.damage.length, 3);
    assert.equal(flowing.damage[0], BASE_DAMAGE);
    for (const i of [1, 2]) {
      assert.equal(flowing.damage[i], BASE_DAMAGE * planOf(["lr", "lr"]).momentum, `hit ${i + 1}`);
      assert.equal(flowing.poise[i], PLAYER.swing.poiseDamage * planOf(["lr", "lr"]).momentum, `hit ${i + 1}`);
    }
    assert.ok(flowing.damage[1]! > flowing.damage[0]!);
    const reversing = play(chainOf(["lr", "rl", "lr"]), 200);
    assert.deepEqual(reversing.damage, [BASE_DAMAGE, BASE_DAMAGE, BASE_DAMAGE]);
  });

  test("each swing costs stamina by what it adds to the blade's motion: reversing it costs most", () => {
    const kinds: AttackKind[] = ["lr", "rl", "brtl", "brtl"];
    const { costs } = play(chainOf(kinds), 200, newFight(FAR));
    const close = (a: number | undefined, b: number) => assert.ok(Math.abs(a! - b) < 1e-9, `${a} vs ${b}`);
    for (let i = 0; i < kinds.length; i++) close(costs[i], PLAYER.swing.cost * planOf(kinds.slice(0, i + 1)).effort);
    assert.ok(costs[1]! > costs[2]! && costs[2]! > costs[3]!, costs.join(", "));
  });

  test("a stab hits for the same after a chain as from rest", () => {
    const fresh = play(chainOf(["stab"]), 80).damage[0]!;
    assert.equal(fresh, BASE_DAMAGE * PLAYER.stab.damageFactor);
    const late = play(chainOf(["lr", "lr", "stab"]), 200).damage;
    assert.equal(late.length, 3);
    assert.equal(late.at(-1), fresh);
  });
});

describe("where the blade is between swings", () => {
  const atRest = (p: Played) => assert.deepEqual(p.blades.at(-1), restingBlade());
  const stoppedAt = (attack: SwingDir): Blade => ({ ...followingBlade(attack, 0), vx: 0, vy: 0 });

  test("it keeps moving a while after a swing, then stops where the swing left it and stays there", () => {
    const kinds: AttackKind[] = ["lr", "lr"];
    const going = play(chainOf(kinds), 5 + stepsUntil(SWING.setTime + SWING.driveTime + SWING.activeTime) + 5,
      newFight(FAR));
    assert.ok(Math.hypot(going.blades.at(-1)!.vx, going.blades.at(-1)!.vy) > 0, "moving");
    for (const attack of ["lr", "tb", "trbl"] as const) {
      const { blades } = play(chainOf([attack]), 300, newFight(FAR));
      assert.deepEqual(blades.at(-1), stoppedAt(attack), attack);
    }
  });

  test("the next swing winds up from where the blade stopped: back the way it came is quick, again is slow", () => {
    const opening = liveStep(SWING.setTime + SWING.driveTime);
    const after = (attack: AttackKind) => {
      const p = play(chainOf(["lr"], (step) => (step === 150 ? { attack } : {})), 220, newFight(FAR));
      assert.equal(p.live[1]! - p.starts[1]!, liveStep(planSwing(SWORD, STRENGTH, stoppedAt("lr"), attack).windupTime),
        attack);
      return p.live[1]! - p.starts[1]!;
    };
    assert.ok(after("rl") < opening && opening < after("lr"));
  });

  test("a stopped blade hits as hard as one swung from rest", () => {
    const after = play(chainOf(["lr"], (step) => (step === 150 ? { attack: "rl" } : {})), 220);
    assert.deepEqual(after.damage, [BASE_DAMAGE, BASE_DAMAGE]);
  });

  test("a block or a dodge brings it back to rest", () => {
    for (const breaker of [{ block: true }, { dodge: true, moveX: 1 }]) {
      const script = chainOf(["lr", "lr"], (_step, me) => (me.action === "none" ? breaker : {}));
      const broken = play(script, 120, newFight(FAR));
      atRest(broken);
    }
  });

  test("so does a hit taken", () => {
    const late: EnemyDef = {
      ...BITER, maxHp: 1e6, poise: 1e6, attacks: { lunge: { ...BITER.attacks.lunge!, firstDelay: 0.8 } },
    };
    const kinds: AttackKind[] = Array.from({ length: 12 }, () => "lr");
    const bitten = play(chainOf(kinds), 160, newFight(2.4, late));
    const at = bitten.hurt[0]!;
    assert.ok(at !== undefined, "bitten");
    assert.notDeepEqual(bitten.blades[at - 2], restingBlade(), "it was moving");
    assert.deepEqual(bitten.blades[at - 1], restingBlade());
  });
});
