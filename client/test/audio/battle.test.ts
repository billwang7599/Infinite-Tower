import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  BASE_STATS, Body, emptyBag, packFor, Enemy, IDLE_INPUT, ITEMS, newCore, Player, SkillObject, Wielder,
  type EnemyDef, type SwingDir, type Entity, type PlayerInputData, type Skill, type Vec3, type World,
} from "@infinite-tower/shared";
import { ENEMY_START_YAW, Fight, initPhysics, type FightEvent, type FightSetup } from "@infinite-tower/shared/fight";
import { fightEars, STRIDE_M, swingVoice, type FightToHear } from "../../src/audio/battle.js";
import { ELEMENT_SOUNDS, ENEMY_SOUNDS, STEP_SOUNDS } from "../../src/audio/sounds.js";
import type { StepEvent } from "../../src/modes/battle/sync.js";
import { swingAt } from "../fixtures/swings.js";
import { armed } from "../fixtures/armed.js";

before(() => initPhysics());

const STATS = BASE_STATS;
const STANDER: EnemyDef = {
  id: "kobold-swordsman", name: "Stander", maxHp: 100, stats: STATS, radius: 0.6, walkSpeed: 0, turnRate: 3,
  poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
};
const SWORDED: EnemyDef = {
  ...STANDER, wielder: { hands: { rightHand: "kobold-blade" }, armReachM: 0.8 },
  attacks: {
    weapon: {
      triggerDist: 0, minChain: 1, maxChain: 1, heavyShare: 0, heavyFeintShare: 0, cooldown: 99, firstDelay: 99,
      blockReactTime: 0, perfectBlockChance: 0, parryChance: 0,
    },
  },
};
const FIRE_BOLT: Skill = { segments: [{ form: "bolt", elements: ["fire"], modifiers: [] }] };
const setup = (look: FightSetup["arena"]["look"] = "stone-ruins", def = STANDER): FightSetup => ({
  arena: { id: "test", radius: 16, look },
  players: [{
    at: { x: 0, y: 0.05, z: -4 }, vitals: { hp: 100, stamina: 100 }, stats: STATS, core: newCore(), burden: "light",
    gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: armed() }, book: [FIRE_BOLT],
  }],
  enemies: [{ def, at: { x: 0, y: 0.05, z: 8 }, yaw: ENEMY_START_YAW }],
});

function arena(look?: FightSetup["arena"]["look"], def?: EnemyDef) {
  const fight = new Fight(setup(look, def));
  const ctx: FightToHear = {
    fight, events: [], outcome: { state: "fighting", stateTime: 0 },
    sync: { stats: { checks: 0, mismatches: 0, restores: 0, corrections: 0, hiddenHits: 0, hiddenDodgeHits: 0 } },
    view: {
      yaw: 0, pitch: 0, fovRad: 0.9, eye: { x: 0, y: 3, z: -12 }, at: { x: 0, y: 1, z: -4 },
    },
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
      const swing = run(1, { attack: "stab" }).cues.find((c) => c.sound === "swing");
      const at = world.require(player, Body).pos;
      if (swing) swings.push(swing);
      if (swing) assert.deepEqual(swing.at, { x: at.x, z: at.z });
    }
    assert.equal(swings.length, 1);
    assert.equal(sounds(run(60)).includes("swing"), false);
  });

  test("a swing whooshes from the side its blade sets off from, as its wielder faces", () => {
    const heardFrom = (way: SwingDir) => {
      const { run, world, player } = arena();
      for (let i = 0; i < 60; i++) {
        const swing = run(1, { attack: "light", way }).cues.find((c) => c.sound === "swing");
        if (swing) return swing.at!.x - world.require(player, Body).pos.x;
      }
      throw new Error(`${way} never whooshed`);
    };
    assert.ok(heardFrom("lr") < -0.5, "from its left (it faces +z: -x)");
    assert.ok(heardFrom("rl") > 0.5, "from its right");
    assert.ok(heardFrom("trbl") > 0.5 && heardFrom("bltr") < -0.5, "the diagonals too");
    assert.ok(Math.abs(heardFrom("tb")) < 1e-9, "from overhead: neither");
  });

  test("an enemy facing you swings from its left: heard on your right", () => {
    const { run, world, enemy } = arena(undefined, SWORDED);
    const swing = swingAt("light", "lr", 0, Math.PI);
    world.require(enemy, Wielder).swing = { ...swing, step: swing.driveAt };
    const heard = run(0).cues.find((c) => c.sound === "swing");
    const at = world.require(enemy, Body).pos;
    assert.ok(heard && heard.at!.x > at.x + 0.5, JSON.stringify(heard?.at));
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

  test("a perfect block rings out where the blocker stands", () => {
    const { ctx, hear, world, player, enemy } = arena();
    ctx.events = [{ step: 1, event: { type: "block", by: enemy, target: player, perfect: true } }];
    const heard = hear(ctx)!, at = world.require(player, Body).pos;
    assert.deepEqual(sounds(heard), ["parry"]);
    assert.deepEqual(heard.cues[0]!.at, { x: at.x, z: at.z });
  });

  test("a swing parried or two clashing ring out where the parrier stands", () => {
    for (const clash of [false, true]) {
      const { ctx, hear, world, player, enemy } = arena();
      ctx.events = [{ step: 1, event: { type: "parry", by: player, target: enemy, clash } }];
      const heard = hear(ctx)!, at = world.require(player, Body).pos;
      assert.deepEqual(sounds(heard), ["parry"]);
      assert.deepEqual(heard.cues[0]!.at, { x: at.x, z: at.z });
    }
  });

  test("a feint is heard where the feinter stands, as its blade is snapped back", () => {
    const { ctx, hear, world, enemy } = arena();
    ctx.events = [{ step: 1, event: { type: "feint", by: enemy } }];
    const heard = hear(ctx)!, at = world.require(enemy, Body).pos;
    assert.deepEqual(sounds(heard), ["draw-blade"]);
    assert.deepEqual(heard.cues[0]!.at, { x: at.x, z: at.z });
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
      world.require(enemy, Wielder).swing = swingAt(next, "tb", 0);
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
