/**
 * Parrying: a swing met by the player's swing the other way along the same line, its blade live within the parry
 * window before the enemy's lands; and the swordsman parrying a badly timed swing of the player's.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ActiveHit, Body, CHAIN, Enemy, FIXED_DT, Health, isSwing, liveStep, PARRY, physicalDamage, Player, PLAYER,
  reverseOf, SWING_DIRS, WEAPONS, Wielder, type AttackKind, type EnemyDef, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, dumpState, enemy, GUARD, input, player, STATS, swings, SWORDSMAN } from "./fixtures.js";

await initPhysics();

const ENEMY_Z = 2;
const newFight = (def: EnemyDef = SWORDSMAN, enemyZ = ENEMY_Z, vitals = { hp: PLAYER.maxHp, stamina: STATS.stamina }) =>
  new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { vitals })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: enemyZ })],
  });
const withMoves = (moves: AttackKind[]): EnemyDef => ({ ...SWORDSMAN, attacks: { weapon: swings({ moves }) } });

/** What the player does on each step (1 is the fight's first). */
type Script = (step: number) => Partial<PlayerInputData>;
interface Played { fight: Fight; events: { step: number; event: FightEvent }[] }

function play(script: Script, to: number, fight = newFight()): Played {
  const events: Played["events"] = [];
  while (fight.steps < to) {
    const step = fight.steps + 1;
    fight.step([input(script(step))]);
    for (const event of fight.events) events.push({ step, event });
  }
  return { fight, events };
}

const hpOf = (fight: Fight, e = fight.players[0]!) => fight.world.require(e, Health).hp;
const kobold = (fight: Fight) => fight.world.require(fight.enemies[0]!, Enemy);
const wielderOf = (fight: Fight, e = fight.players[0]!) => fight.world.require(e, Wielder);

/** The step the swordsman's "lr" lands on, the player standing still. */
const LANDS_AT = (() => {
  const f = newFight();
  while (hpOf(f) === PLAYER.maxHp && f.steps < 200) f.step([input({})]);
  return f.steps;
})();
/** Steps from pressing an opening swing to its blade going live. */
const LIVE_AFTER = liveStep(CHAIN.startupTime.opening);
const WINDOW_STEPS = Math.round(PARRY.window / FIXED_DT);

/** A swing `kind` pressed so that its blade goes live `k` steps before the swordsman's lands (negative: after). */
const swingBefore = (kind: AttackKind, k: number, landsAt = LANDS_AT): Script => (step) =>
  step === landsAt - LIVE_AFTER - k ? { attack: kind } : {};

describe("parrying the swordsman's swing", () => {
  test("the setup: its swing lands on a step of its own, and hurts", () => {
    assert.ok(LANDS_AT > LIVE_AFTER + WINDOW_STEPS + 5, `lands at ${LANDS_AT}`);
    assert.ok(hpOf(play(() => ({}), LANDS_AT).fight) < PLAYER.maxHp);
  });

  test("the reverse swing on the same line, live within the window before it lands: parried", () => {
    for (const k of [0, 1, 4, WINDOW_STEPS - 1, WINDOW_STEPS]) {
      const { fight, events } = play(swingBefore("rl", k), LANDS_AT);
      assert.equal(hpOf(fight), PLAYER.maxHp, `k = ${k}: unhurt`);
      assert.equal(kobold(fight).state, "parried", `k = ${k}`);
      assert.deepEqual(events.filter((e) => e.event.type === "parry"),
        [{ step: LANDS_AT, event: { type: "parry", by: fight.players[0], target: fight.enemies[0] } }], `k = ${k}`);
    }
  });

  test("hit by a chain's first swing, the next can still be parried while you're briefly invulnerable", () => {
    const chainWindup = PLAYER.hurtInvuln / 2;
    const chain = { ...SWORDSMAN, attacks: { weapon: swings({ minChain: 2, maxChain: 2, chainWindup }) } };
    const liveSteps: number[] = [];
    const f = newFight(chain);
    while (f.steps < LANDS_AT + 60) {
      f.step([input({})]);
      if (f.world.get(f.enemies[0]!, ActiveHit)) liveSteps.push(f.steps);
    }
    const secondLands = liveSteps.find((s, i) => i > 0 && s !== liveSteps[i - 1]! + 1)!;
    assert.ok(secondLands, "it swings twice");

    const { fight, events } = play(swingBefore("rl", 2, secondLands), secondLands, newFight(chain));
    const hurts = events.filter((e) => e.event.type === "hit" && e.event.team === "player");
    assert.equal(hurts.length, 1, "only the first swing hurts");
    assert.equal(kobold(fight).state, "parried");
  });

  test("every swing direction is parried by its own reverse", () => {
    for (const dir of SWING_DIRS) {
      const reverse = reverseOf(dir);
      const { fight } = play(swingBefore(reverse, 2), LANDS_AT, newFight(withMoves([dir])));
      assert.equal(kobold(fight).state, "parried", `${dir} by ${reverse}`);
      assert.equal(hpOf(fight), PLAYER.maxHp, `${dir} by ${reverse}`);
    }
  });

  test("too late (the blade not live yet when it lands) or too early: you're hit, nothing parried", () => {
    for (const k of [-1, -3, WINDOW_STEPS + 1, WINDOW_STEPS + 6]) {
      const { fight } = play(swingBefore("rl", k), LANDS_AT + 2);
      assert.ok(hpOf(fight) < PLAYER.maxHp, `k = ${k}: hit`);
      assert.notEqual(kobold(fight).state, "parried", `k = ${k}`);
    }
  });

  test("the wrong direction: both hits land", () => {
    for (const kind of ["lr", "tb", "bt", "tlbr", "trbl"] as const) {
      const { fight } = play(swingBefore(kind, 2), LANDS_AT + 2);
      assert.ok(hpOf(fight) < PLAYER.maxHp, `${kind}: the player is hit`);
      assert.ok(hpOf(fight, fight.enemies[0]) < SWORDSMAN.maxHp, `${kind}: so is the swordsman`);
      assert.notEqual(kobold(fight).state, "parried", kind);
    }
  });

  test("a stab can't be parried, whatever the swing", () => {
    for (const kind of SWING_DIRS) {
      const { fight } = play(swingBefore(kind, 2), LANDS_AT + 2, newFight(withMoves(["stab"])));
      assert.ok(hpOf(fight) < PLAYER.maxHp, `${kind} against a stab`);
      assert.notEqual(kobold(fight).state, "parried", kind);
    }
  });

  test("parried, it's knocked back, stunned for the stun time, and takes extra damage meanwhile", () => {
    // Parry, then walk up to it and swing again (a fresh swing: the chain has lapsed by then).
    const step0 = LANDS_AT - LIVE_AFTER - 2;
    const walkFrom = LANDS_AT + 30, swingAt = LANDS_AT + 44;
    const script: Script = (step) => step === step0 ? { attack: "rl" }
      : step >= walkFrom && step < swingAt ? { moveZ: 1 } : step === swingAt ? { attack: "tb" } : {};
    const parried = play(script, LANDS_AT, newFight());
    const at = parried.fight.world.require(parried.fight.enemies[0]!, Body).pos.z;
    const after = play(script, walkFrom - 1, parried.fight);
    const knockedTo = after.fight.world.require(after.fight.enemies[0]!, Body).pos.z;
    assert.ok(knockedTo - at >= PARRY.knockbackDist * 0.8, `knocked back ${(knockedTo - at).toFixed(2)} m`);

    const hit = play(script, swingAt + 20, after.fight).events.find((e) => e.event.type === "hit");
    assert.ok(hit, "the second swing lands");
    assert.ok((hit.step - LANDS_AT) * FIXED_DT < PARRY.stunTime, "while still stunned");
    assert.deepEqual(hit.event, {
      type: "hit", by: after.fight.players[0], target: after.fight.enemies[0], team: "enemy",
      damage: physicalDamage(WEAPONS.sword.damage, STATS) * PARRY.bonusDamage, weapon: true,
    });

    const done = play(swingBefore("rl", 2), LANDS_AT + Math.round(PARRY.stunTime / FIXED_DT) + 2);
    assert.notEqual(kobold(done.fight).state, "parried", "the stun wears off");
  });
});

describe("the swordsman parrying the player", () => {
  const settled = 60;

  test("a swing at it while it's on guard is parried: no damage, and the player is staggered", () => {
    const { fight, events } = play((step) => step === settled ? { attack: "lr" } : {}, settled + 20, newFight(GUARD));
    assert.equal(hpOf(fight, fight.enemies[0]), GUARD.maxHp);
    const parry = events.find((e) => e.event.type === "parry");
    assert.deepEqual(parry?.event, { type: "parry", by: fight.enemies[0], target: fight.players[0] });
    const again = play((step) => step === settled ? { attack: "lr" } : {}, parry!.step, newFight(GUARD));
    assert.equal(again.fight.world.require(again.fight.players[0]!, Player).action, "stagger");
  });

  test("being parried knocks a chain's momentum back to nothing", () => {
    // Two horizontal swings fall short of it (building momentum), the vertical one reaches it and is parried.
    const far = 3.5;
    let built = 0;
    const presses: Record<number, AttackKind> = {};
    const fight = newFight(GUARD, far);
    const kinds: AttackKind[] = ["lr", "rl", "tb"];
    let next = 0;
    while (fight.steps < settled + 80) {
      const step = fight.steps + 1;
      const swing = wielderOf(fight).swing;
      const started = swing !== null && swing.step <= 1 && swing.attack === kinds[next - 1];
      const due = (step === settled && next === 0) || (next > 0 && next < kinds.length && started);
      if (due) presses[step] = kinds[next++]!;
      fight.step([input({ attack: presses[step] ?? null })]);
      built = Math.max(built, wielderOf(fight).momentum);
    }
    assert.ok(built > 0, "the chain built momentum");
    assert.equal(hpOf(fight, fight.enemies[0]), GUARD.maxHp, "the last swing was parried");
    assert.equal(wielderOf(fight).momentum, 0);
  });

  test("not right away: back on guard, it needs its reaction time before it can parry", () => {
    const quick = GUARD.attacks.weapon!.parryReaction / 2;
    const { fight } = play((step) => step === Math.round(quick / FIXED_DT) - LIVE_AFTER ? { attack: "lr" } : {}, 60,
      newFight(GUARD));
    assert.ok(hpOf(fight, fight.enemies[0]) < GUARD.maxHp, "hit before it was ready");
  });

  test("after a parry it can't parry again for a while: a second swing then lands", () => {
    const twice: Script = (step) => step === settled ? { attack: "lr" } : step === settled + 50 ? { attack: "tb" } : {};
    const { fight } = play(twice, settled + 80, newFight(GUARD));
    assert.ok((50 - LIVE_AFTER) * FIXED_DT < GUARD.attacks.weapon!.parryCooldown);
    assert.equal(hpOf(fight, fight.enemies[0]), GUARD.maxHp - physicalDamage(WEAPONS.sword.damage, STATS));
  });

  test("swinging while it recovers from its own attack lands", () => {
    // Just out of its reach: its swing misses, and the player's lands as it recovers.
    const harmless = newFight(SWORDSMAN, 2.35);
    const def = SWORDSMAN.attacks.weapon!;
    const recovering = Math.round((def.windup + def.active + 0.1) / FIXED_DT);
    const { fight } = play((step) => step === recovering ? { attack: "lr" } : {}, recovering + 30, harmless);
    assert.equal(hpOf(fight), PLAYER.maxHp, "its swing missed");
    assert.ok(hpOf(fight, fight.enemies[0]) < SWORDSMAN.maxHp, "the player's landed");
  });

  test("a stab at it on guard is blocked; at it recovering, it lands", () => {
    const guarded = play((step) => step === settled ? { attack: "stab" } : {}, settled + 30, newFight(GUARD));
    assert.equal(hpOf(guarded.fight, guarded.fight.enemies[0]), GUARD.maxHp);
    assert.notEqual(guarded.fight.world.require(guarded.fight.players[0]!, Player).action, "stagger");
    assert.ok(guarded.events.some((e) => e.event.type === "block"));

    const def = SWORDSMAN.attacks.weapon!;
    const recovering = Math.round((def.windup + def.active + 0.1) / FIXED_DT);
    const stabAt: Script = (step) => step === recovering ? { attack: "stab" } : {};
    const open = play(stabAt, recovering + 30, newFight(SWORDSMAN, 2.35));
    assert.ok(hpOf(open.fight, open.fight.enemies[0]) < SWORDSMAN.maxHp);
  });
});

describe("a parry's stun, a block and a chain's momentum, mid-flight", () => {
  /** Attacks in chains of two, again and again. */
  const DUELLIST: EnemyDef = {
    ...SWORDSMAN, maxHp: 100000,
    attacks: { weapon: swings({ moves: ["lr", "tb", "trbl"], minChain: 2, maxChain: 2, cooldown: 0.5 }) },
  };
  const duel = () => new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 100000, stamina: 1000 } })],
    enemies: [{ ...enemy(DUELLIST, { x: 0, y: 0.05, z: ENEMY_Z }), seed: 4 }],
  });

  /**
   * A player who watches the swordsman: they parry the first swing of every other chain (the reverse, its blade
   * live 2 steps before it lands), hold block through the other chains, and chain swings into it while it's stunned.
   */
  function watcher(): (fight: Fight) => PlayerInputData {
    let chainNo = 0, last = "approach", lastAttack: AttackKind = "lr";
    return (fight) => {
      const k = fight.world.require(fight.enemies[0]!, Enemy), its = wielderOf(fight, fight.enemies[0]!).swing;
      const me = fight.world.require(fight.players[0]!, Player), mine = wielderOf(fight).swing;
      if (mine) lastAttack = mine.attack;
      if (k.state === "weaponWindup" && last === "approach") chainNo++;
      last = k.state;
      if (k.state === "parried") {
        const free = me.action === "none" || (mine !== null && mine.step >= mine.letGoAt);
        return input({ attack: free && fight.steps % 2 === 0 ? (lastAttack === "lr" ? "rl" : "lr") : null });
      }
      if (chainNo % 2 === 0 && (k.state === "weaponWindup" || k.state === "weapon")) return input({ block: true });
      if (k.state === "weaponWindup" && its && isSwing(its.attack)) {
        const landsIn = Math.ceil((k.duration - k.stateTime) / FIXED_DT - 1e-6);
        if (landsIn === LIVE_AFTER + 2) return input({ attack: reverseOf(its.attack) });
      }
      return input({});
    };
  }

  test("are in the state: loaded into a new fight, or one that went its own way, it plays on the same", () => {
    const right = duel(), inputs: PlayerInputData[] = [], watch = watcher();
    const seen = { parried: 0, momentum: 0, block: 0 };
    while (right.steps < 900) {
      const i = watch(right);
      inputs.push(i);
      right.step([i]);
      const k = right.world.require(right.enemies[0]!, Enemy), me = right.world.require(right.players[0]!, Player);
      if (!seen.parried && k.state === "parried") seen.parried = right.steps;
      if (!seen.momentum && wielderOf(right).momentum > 0 && k.state === "parried") seen.momentum = right.steps;
      if (!seen.block && me.action === "block") seen.block = right.steps + 3;
    }
    assert.ok(seen.parried && seen.momentum && seen.block, JSON.stringify(seen));

    const wire = (snap: FightSnapshot): FightSnapshot => JSON.parse(JSON.stringify(snap));
    const replay = (fight: Fight) => { while (fight.steps < 900) fight.step([inputs[fight.steps]!]); };
    for (const at of Object.values(seen)) {
      const first = duel();
      while (first.steps < at) first.step([inputs[first.steps]!]);
      const loaded = duel();
      loaded.load(wire(first.save()));
      replay(loaded);
      assert.equal(dumpState(loaded), dumpState(right), `loaded at ${at}`);
      assert.equal(loaded.hash(), right.hash(), `loaded at ${at}`);

      const wrong = duel();
      while (wrong.steps < at + 40) wrong.step([input({ attack: wrong.steps % 3 === 0 ? "bt" : null, moveX: 1 })]);
      wrong.load(wire(first.save()));
      replay(wrong);
      assert.equal(wrong.hash(), right.hash(), `rolled back at ${at}`);
    }
  });
});
