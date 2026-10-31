import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  BASE_STATS, Body, emptyBag, Enemy, IDLE_INPUT, WeaponAttack, ITEMS, newCore, Player, SkillObject,
  starterEquipment, type CombatStyle, type EnemyDef, type Entity, type PlayerInputData, type Skill, type Vec3,
  type World,
} from "@infinite-tower/shared";
import { ENEMY_START_YAW, Fight, initPhysics, type FightEvent, type FightSetup } from "@infinite-tower/shared/fight";
import {
  fightEars, LINE_VOICES, PERILOUS_CUE, STRIDE_M, swingVoice, type FightToHear,
} from "../../src/audio/battle.js";
import { ELEMENT_SOUNDS, ENEMY_SOUNDS, STEP_SOUNDS } from "../../src/audio/sounds.js";
import type { StepEvent } from "../../src/modes/battle/sync.js";

before(() => initPhysics());

const STATS = BASE_STATS;
const STANDER: EnemyDef = {
  id: "kobold-swordsman", name: "Stander", maxHp: 100, stats: STATS, radius: 0.6, walkSpeed: 0, turnRate: 3,
  poise: 1000, poiseRegen: 0, staggerTime: 1, posture: 100, attacks: {},
};
const SWORDED: EnemyDef = {
  ...STANDER, wielder: { hands: { rightHand: "kobold-blade" }, armReachM: 0.8 },
  attacks: {
    weapon: {
      triggerDist: 0, windup: 9, chainWindup: 9, speed: 0, recover: 1, minChain: 1, maxChain: 1, heavyShare: 0,
      cooldown: 99, firstDelay: 99,
      hybrid: {
        windupTime: 9, chainWindupTime: 9, recoverTime: 1, blockReactTime: 0, tapParryChance: 0, kickAfterTime: 99,
        kickChance: 0,
      },
      posture: {
        windupTime: 9, chainWindupTime: 9, delayTime: 0, delayChance: 0, minString: 1, maxString: 1,
        perilousChance: 0, ends: { thrust: 1, sweep: 0, grab: 0 }, recoverTime: 1, deflectChance: 0,
        thrustDeflectChance: 0, sweepStepBackChance: 0, backOffShare: 2, backOffM: 0,
      },
      oneStrike: {
        thrustWindupTime: 9, reactTime: 0.3, reactJitterTime: 0, measureM: 0.2, decideMinTime: 99, decideMaxTime: 99,
        matched: { thrust: 0, beat: 0, wait: 1 }, followChance: 0, disarmChance: 0, stepBackChance: 0,
      },
    },
  },
};
const FIRE_BOLT: Skill = { segments: [{ form: "bolt", elements: ["fire"], modifiers: [] }] };
const setup = (look: FightSetup["arena"]["look"] = "stone-ruins", def = STANDER, style?: CombatStyle): FightSetup => ({
  arena: { id: "test", radius: 16, look }, style,
  players: [{
    at: { x: 0, y: 0.05, z: -4 }, vitals: { hp: 100, stamina: 100 }, stats: STATS, core: newCore(), burden: "light",
    gear: { bag: emptyBag(), equipment: starterEquipment() }, book: [FIRE_BOLT],
  }],
  enemies: [{ def, at: { x: 0, y: 0.05, z: 8 }, yaw: ENEMY_START_YAW }],
});

function arena(look?: FightSetup["arena"]["look"], def?: EnemyDef, style?: CombatStyle) {
  const fight = new Fight(setup(look, def, style));
  const ctx: FightToHear = {
    fight, events: [], outcome: { state: "fighting", stateTime: 0 },
    sync: { stats: { checks: 0, mismatches: 0, restores: 0, corrections: 0, hiddenHits: 0, hiddenDodgeHits: 0 } },
    view: { yaw: 0, pitch: 0, eye: { x: 0, y: 3, z: -12 }, at: { x: 0, y: 1, z: -4 } },
  };
  const hear = fightEars();
  const run = (steps: number, input: Partial<PlayerInputData> = {}) => {
    ctx.events = [];
    for (let i = 0; i < steps; i++) {
      fight.step([{ ...IDLE_INPUT, ...input }]);
      ctx.events.push(...fight.events.map((event): StepEvent => ({ step: fight.steps, event })));
    }
    return hear(ctx)!;
  };
  const player = fight.players[0]!, enemy = fight.enemies[0]!;
  return { fight, ctx, hear, run, player, enemy, world: fight.world };
}
const sounds = (heard: { cues: { sound: string }[] }) => heard.cues.map((c) => c.sound);
function spawnBolt(world: World, caster: Entity, pos: Vec3): Entity {
  const bolt = world.spawn();
  world.add(bolt, SkillObject, {
    kind: "bolt", caster, skill: FIRE_BOLT, segment: 0, pos, dir: { x: 0, z: 1 }, flownM: 0, reachM: 0.3, left: 1,
    tickLeft: 0, hitsLeft: 1, held: false, target: null, fanM: { x: 0, z: 0 }, climbPerM: 0, climbUntilM: 0,
    ignore: null,
  });
  return bolt;
}

describe("the arena's ears", () => {
  test("are at the point the camera looks at, facing its way", () => {
    const { run, ctx } = arena();
    ctx.view.yaw = 1.2;
    assert.deepEqual(run(1).ears, { x: ctx.view.at.x, z: ctx.view.at.z, yaw: 1.2 });
  });

  test("an attack whooshes once, as its blade sets off, where its wielder is", () => {
    const { run, world, player } = arena();
    const swings = [];
    for (let i = 0; i < 60; i++) {
      const swing = run(1, { attack: "light" }).cues.find((c) => c.sound === "swing");
      const at = world.require(player, Body).pos;
      if (swing) swings.push(swing);
      if (swing) assert.deepEqual(swing.at, { x: at.x, z: at.z });
    }
    assert.equal(swings.length, 1);
    assert.equal(sounds(run(60)).includes("swing"), false);
  });

  test("a heavier blade whooshes lower and louder, and a heavy attack lower and louder than a light", () => {
    const sword = swingVoice(ITEMS.sword.weight, "light"), great = swingVoice(ITEMS.greatsword.weight, "light");
    assert.ok(great.rate < sword.rate && great.gain > sword.gain);
    assert.equal(sword.rate, 1);
    const heavy = swingVoice(ITEMS.sword.weight, "heavy");
    assert.ok(heavy.rate < sword.rate && heavy.gain > sword.gain);
  });

  test("a hit sounds as its kind, and the enemy hit grunts; a killing blow is its death instead", () => {
    const { ctx, hear, world, player, enemy } = arena();
    const hit = (weapon: boolean): FightEvent =>
      ({ type: "hit", by: player, target: enemy, team: "enemy", damage: 5, weapon });
    ctx.events = [{ step: 1, event: hit(true) }];
    const at = world.require(enemy, Body).pos;
    const heard = hear(ctx)!;
    assert.deepEqual(sounds(heard), ["hit-blade", ENEMY_SOUNDS[STANDER.id].hurt]);
    assert.deepEqual(heard.cues[1]!.at, { x: at.x, z: at.z });
    ctx.events = [{ step: 2, event: hit(false) }];
    assert.deepEqual(sounds(hear(ctx)!), ["hit-body", ENEMY_SOUNDS[STANDER.id].hurt]);
    Object.assign(world.require(enemy, Enemy), { state: "dead" });
    ctx.events = [{ step: 3, event: hit(true) }];
    assert.deepEqual(sounds(hear(ctx)!), ["hit-blade", ENEMY_SOUNDS[STANDER.id].death]);
    ctx.events = [];
    assert.deepEqual(sounds(hear(ctx)!), [], "it dies once");
  });

  test("a step replayed after a resync isn't heard again", () => {
    const { ctx, hear, enemy } = arena();
    ctx.events = [{ step: 4, event: { type: "slam", enemy } }];
    assert.deepEqual(sounds(hear(ctx)!), ["slam"]);
    ctx.events = [{ step: 4, event: { type: "slam", enemy } }, { step: 5, event: { type: "slam", enemy } }];
    assert.deepEqual(sounds(hear(ctx)!), ["slam"]);
  });

  test("a block clanks", () => {
    const { ctx, hear, player, enemy } = arena();
    ctx.events = [{ step: 1, event: { type: "block", by: enemy, target: player } }];
    assert.deepEqual(sounds(hear(ctx)!), ["block"]);
  });

  test("a parry rings out where the parrier stands; a guard break's grab thuds, its break crashes, its counter clanks",
    () => {
      const { ctx, hear, world, player, enemy } = arena();
      ctx.events = [{ step: 1, event: { type: "parry", by: player, target: enemy, attack: "heavy" } }];
      const heard = hear(ctx)!, at = world.require(player, Body).pos;
      assert.deepEqual(sounds(heard), ["parry"]);
      assert.deepEqual(heard.cues[0]!.at, { x: at.x, z: at.z });
      const results = ["grabbed", "broken", "teched"] as const;
      ctx.events = results.map((result, i) =>
        ({ step: 2 + i, event: { type: "guardBreak", by: enemy, target: player, result } }));
      assert.deepEqual(sounds(hear(ctx)!), ["hit-body", "guard-break", "block"]);
    });

  test("in Posture a perilous wind-up rings one sharp sound, the same for a thrust, a sweep and the Kobold's grab", () => {
    const rings = (heard: { cues: { sound: string; rate?: number }[] }) =>
      heard.cues.filter((c) => c.sound === PERILOUS_CUE.sound && c.rate === PERILOUS_CUE.rate).length;
    for (const perilous of ["thrust", "sweep"] as const) {
      const { run } = arena(undefined, STANDER, "posture");
      run(2);
      assert.equal(rings(run(1, { perilous })), 1, perilous);
      assert.equal(rings(run(30)), 0, perilous);
    }
    const { run, world, enemy } = arena(undefined, SWORDED, "posture");
    run(1);
    Object.assign(world.require(enemy, Enemy), { state: "guardBreak", stateTime: 0 });
    assert.equal(rings(run(0)), 1);
    const forHonor = arena(undefined, SWORDED);
    forHonor.run(1);
    Object.assign(forHonor.world.require(forHonor.enemy, Enemy), { state: "guardBreak", stateTime: 0 });
    assert.equal(rings(forHonor.run(0)), 0, "For Honor's guard break isn't perilous");
  });

  test("Posture's moments: a break and a deathblow thud, a Mikiri rings, a jump kick thumps, Zanshin chimes softly", () => {
    const { ctx, hear, player, enemy } = arena(undefined, STANDER, "posture");
    const whats = ["broken", "deathblow", "mikiri", "jumpKick", "zanshin"] as const;
    ctx.events = whats.map((what, i) => ({ step: 1 + i, event: { type: "posture", by: player, target: enemy, what } }));
    const heard = hear(ctx)!;
    assert.deepEqual(sounds(heard), ["guard-break", "guard-break", "parry", "hit-body", "parry"]);
    assert.ok(heard.cues[4]!.gain! < 1 && heard.cues[4]!.rate! > 1, "soft and high");
  });

  test("in One Strike a thrust's wind-up draws the blade, higher for a high line, lower for a low one", () => {
    const rates: number[] = [];
    for (const line of ["high", "middle", "low"] as const) {
      const { run } = arena(undefined, STANDER, "one-strike");
      run(12, { line });
      const drawn = run(1, { line, attack: "light" }).cues.filter((c) => c.sound === "draw-blade");
      assert.equal(drawn.length, 1, line);
      assert.equal(drawn[0]!.rate, LINE_VOICES[line].rate);
      rates.push(drawn[0]!.rate!);
      assert.equal(run(40, { line }).cues.filter((c) => c.sound === "draw-blade").length, 0, `${line}: once`);
    }
    assert.ok(rates[0]! > rates[1]! && rates[1]! > rates[2]!);
  });

  test("One Strike's moments: a clash and a disarm ring, a disarm's blade clatters, a beat knocks", () => {
    const { ctx, hear, player, enemy } = arena(undefined, STANDER, "one-strike");
    const whats = ["clash", "disarm", "beat", "offLine", "impale", "pickup"] as const;
    ctx.events = whats.map((what, i) => ({ step: 1 + i, event: { type: "strike", by: player, target: enemy, what } }));
    assert.deepEqual(sounds(hear(ctx)!), ["parry", "parry", "drop", "block", "block", "hit-body", "pickup"]);
  });

  test("a feint is heard as the blade is pulled back", () => {
    const { ctx, hear, player } = arena();
    ctx.events = [{ step: 1, event: { type: "feint", by: player } }];
    assert.deepEqual(sounds(hear(ctx)!), ["draw-blade"]);
  });

  test("a guard break lunges with a whoosh as it starts", () => {
    const { run } = arena();
    run(1);
    const heard = run(1, { guardBreak: true });
    assert.deepEqual(sounds(heard), ["grab"]);
    assert.deepEqual(sounds(run(20)), []);
  });

  test("a heavy winding up is heard, low; a light isn't", () => {
    const heavy = arena(), light = arena();
    heavy.run(1);
    light.run(1);
    const cue = heavy.run(1, { attack: "heavy" }).cues.find((c) => c.sound === "draw-blade");
    assert.ok(cue && cue.rate! < 1 && cue.gain! > 1);
    assert.equal(sounds(light.run(1, { attack: "light" })).includes("draw-blade"), false);
  });

  test("the Kobold's heavy tell is lower and louder than its light one", () => {
    const tell = (next: "light" | "heavy") => {
      const { run, world, enemy } = arena(undefined, SWORDED);
      run(1);
      Object.assign(world.require(enemy, WeaponAttack), { next });
      Object.assign(world.require(enemy, Enemy), { state: "weaponWindup", stateTime: 0 });
      return run(0).cues[0]!;
    };
    assert.ok(tell("heavy").rate! < tell("light").rate! && tell("heavy").gain! > (tell("light").gain ?? 1));
  });

  test("an enemy's wind-up is heard as it starts: the Kobold's blade drawn back", () => {
    const { run, world, enemy } = arena();
    run(1);
    Object.assign(world.require(enemy, Enemy), { state: "weaponWindup", stateTime: 0 });
    const heard = run(0);
    assert.deepEqual(sounds(heard), [ENEMY_SOUNDS["kobold-swordsman"].windup]);
    assert.deepEqual(sounds(run(0)), []);
  });

  test("a wind-up a resync takes back and replays is heard once; one long under way when first seen, never", () => {
    const { run, world, enemy } = arena();
    run(1);
    const state = world.require(enemy, Enemy);
    Object.assign(state, { state: "weaponWindup", stateTime: 0 });
    assert.equal(run(0).cues.length, 1);
    Object.assign(state, { state: "approach", stateTime: 1 });
    run(0);
    Object.assign(state, { state: "weaponWindup", stateTime: 0 });
    assert.deepEqual(sounds(run(0)), []);

    const late = arena();
    Object.assign(late.world.require(late.enemy, Enemy), { state: "weaponWindup", stateTime: 1 });
    assert.deepEqual(sounds(late.run(0)), []);
  });

  test("a heavier blade is drawn back lower", () => {
    const wielder = { hands: { rightHand: "kobold-greatsword" as const }, armReachM: 0.7 };
    const { run, world, enemy } = arena("stone-ruins", { ...STANDER, id: "kobold-greatsword", wielder });
    run(1);
    Object.assign(world.require(enemy, Enemy), { state: "weaponWindup", stateTime: 0 });
    const [windup] = run(0).cues;
    assert.equal(windup?.sound, ENEMY_SOUNDS["kobold-greatsword"].windup);
    assert.equal(windup?.rate, swingVoice(ITEMS["kobold-greatsword"].weight, "light").rate);
    assert.ok(windup!.rate! < 1);
  });

  test("a dodge and a jump are heard once each, and landing again", () => {
    const { run } = arena();
    run(1);
    assert.ok(sounds(run(1, { dodge: true })).includes("dodge"));
    assert.equal(sounds(run(1, { dodge: true })).includes("dodge"), false);
    run(60);
    assert.ok(sounds(run(1, { jump: true })).includes("jump"));
    const later = [...Array(90)].flatMap(() => sounds(run(1)));
    assert.equal(later.filter((s) => s === "land").length, 1);
  });

  test("walking makes a step every stride, on the arena's ground; nothing standing still", () => {
    const { run, world, player } = arena("mire");
    run(1);
    const body = world.require(player, Body);
    world.require(player, Player).grounded = true;
    const steps: string[] = [];
    for (let i = 0; i < 55; i++) {
      body.pos.x += STRIDE_M / 10;
      steps.push(...sounds(run(0)));
    }
    assert.equal(steps.filter((s) => s === STEP_SOUNDS.mire).length, 5);
    assert.deepEqual(sounds(run(0)), []);
  });

  test("a Bolt is heard as the fight reports its release, flies with its element's loop, bursts where it ends", () => {
    const { run, hear, ctx, world, player } = arena();
    run(1);
    const pos = { x: 1, y: 1, z: 2 }, bolt = spawnBolt(world, player, pos);
    ctx.events = [{ step: 2, event: { type: "skill", form: "bolt", elements: ["fire"], at: { ...pos } } }];
    let heard = hear(ctx)!;
    assert.deepEqual(heard.cues.map((c) => [c.sound, c.at]), [[ELEMENT_SOUNDS.fire.cast, { x: 1, z: 2 }]]);
    const loops = [...heard.loops.values()].map((l) => [l.sound, l.at]);
    assert.deepEqual(loops, [[ELEMENT_SOUNDS.fire.loop, { x: 1, z: 2 }]]);
    pos.z = 6;
    heard = hear(ctx)!;
    assert.deepEqual(heard.cues, []);
    assert.deepEqual([...heard.loops.values()][0]!.at, { x: 1, z: 6 });
    world.destroy(bolt);
    world.flush();
    heard = hear(ctx)!;
    assert.deepEqual(heard.cues.map((c) => [c.sound, c.at]), [[ELEMENT_SOUNDS.fire.impact, { x: 1, z: 6 }]]);
    assert.equal(heard.loops.size, 0);
  });

  test("a skill with no element sounds plain", () => {
    const { ctx, hear } = arena();
    ctx.events = [{ step: 1, event: { type: "skill", form: "bolt", elements: [], at: { x: 0, y: 0, z: 0 } } }];
    assert.deepEqual(sounds(hear(ctx)!), [ELEMENT_SOUNDS.plain.cast]);
  });

  test("a Nova bursts as it goes off", () => {
    const { ctx, hear } = arena();
    ctx.events = [{ step: 1, event: { type: "skill", form: "nova", elements: ["water"], at: { x: 0, y: 0, z: 0 } } }];
    assert.deepEqual(sounds(hear(ctx)!), [ELEMENT_SOUNDS.water.impact]);
  });

  test("split Bolts flying together are one loop, from their middle", () => {
    const { hear, ctx, world, player } = arena();
    spawnBolt(world, player, { x: -1, y: 1, z: 0 });
    spawnBolt(world, player, { x: 3, y: 1, z: 2 });
    assert.deepEqual([...hear(ctx)!.loops.values()].map((l) => l.at), [{ x: 1, z: 1 }]);
  });

  test("a Bolt remade by a resync's reload isn't heard bursting", () => {
    const { run, hear, ctx, world, player } = arena();
    run(1);
    spawnBolt(world, player, { x: 0, y: 1, z: 0 });
    hear(ctx);
    for (const [e] of world.query(SkillObject)) world.destroy(e);
    world.flush();
    spawnBolt(world, player, { x: 0, y: 1, z: 0.2 });
    ctx.sync = { stats: { ...ctx.sync!.stats, restores: 1 } };
    const heard = hear(ctx)!;
    assert.deepEqual(sounds(heard), []);
    assert.equal(heard.loops.size, 1);
  });

  test("a skill winding up is heard as it starts", () => {
    const { run } = arena();
    run(1);
    assert.ok(sounds(run(1, { cast: FIRE_BOLT })).includes("windup-magic"));
  });

  test("the fight's end is heard once, as the server decides it", () => {
    const { run, ctx } = arena();
    run(1);
    ctx.outcome = { state: "won", stateTime: 0 };
    assert.deepEqual(sounds(run(0)), ["victory"]);
    assert.deepEqual(sounds(run(0)), []);
  });

  test("the mire bubbles all round; the ruins are quiet", () => {
    assert.deepEqual([...arena("mire").run(1).loops.values()].map((l) => [l.sound, l.at]), [["mire", null]]);
    assert.equal(arena("stone-ruins").run(1).loops.size, 0);
  });

  test("a new fight forgets the last: its Bolts don't burst", () => {
    const first = arena(), second = arena();
    first.run(1);
    spawnBolt(first.world, first.player, { x: 0, y: 1, z: 0 });
    first.hear(first.ctx);
    const heard = first.hear(second.ctx)!;
    assert.deepEqual(sounds(heard), []);
    assert.equal(heard.loops.size, 0);
  });

  test("no fight, nothing to hear", () => {
    const { ctx, hear } = arena();
    assert.equal(hear({ ...ctx, fight: null }), null);
  });
});
