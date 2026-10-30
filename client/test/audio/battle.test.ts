import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, emptyBag, Enemy, IDLE_INPUT, Player, PLAYER, SkillObject, starterEquipment, WEAPONS, type EnemyDef,
  type Entity, type PlayerInputData, type Skill, type Vec3, type World,
} from "@infinite-tower/shared";
import { ENEMY_START_YAW, Fight, initPhysics, type FightEvent, type FightSetup } from "@infinite-tower/shared/fight";
import { fightEars, STRIDE_M, swingVoice, type FightToHear } from "../../src/audio/battle.js";
import { ELEMENT_SOUNDS, ENEMY_SOUNDS, STEP_SOUNDS } from "../../src/audio/sounds.js";
import type { StepEvent } from "../../src/modes/battle/sync.js";

before(() => initPhysics());

const STATS = { stamina: 100, skillpower: 10, agility: 10, strength: 10 };
const STANDER: EnemyDef = {
  id: "kobold-swordsman", name: "Stander", maxHp: 100, stats: STATS, radius: 0.6, walkSpeed: 0, turnRate: 3,
  poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
};
const FIRE_BOLT: Skill = { segments: [{ form: "bolt", elements: ["fire"], modifiers: [] }] };
const setup = (look: FightSetup["arena"]["look"] = "stone-ruins", def = STANDER): FightSetup => ({
  arena: { id: "test", radius: 16, look },
  players: [{
    at: { x: 0, y: 0.05, z: -4 }, vitals: { hp: PLAYER.maxHp, stamina: 100 }, stats: STATS, burden: "light",
    gear: { bag: emptyBag(), equipment: starterEquipment() }, book: [FIRE_BOLT],
  }],
  enemies: [{ def, at: { x: 0, y: 0.05, z: 8 }, yaw: ENEMY_START_YAW }],
});

function arena(look?: FightSetup["arena"]["look"], def?: EnemyDef) {
  const fight = new Fight(setup(look, def));
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

  test("a swing whooshes once, as its blade sets off, where its wielder is", () => {
    const { run, world, player } = arena();
    const swings = [];
    for (let i = 0; i < 60; i++) {
      const swing = run(1, { attack: "lr" }).cues.find((c) => c.sound === "swing");
      const at = world.require(player, Body).pos;
      if (swing) swings.push(swing);
      if (swing) assert.deepEqual(swing.at, { x: at.x, z: at.z });
    }
    assert.equal(swings.length, 1);
    assert.equal(sounds(run(60)).includes("swing"), false);
  });

  test("a heavier blade whooshes lower and louder, and a swing with more momentum louder", () => {
    const sword = swingVoice(WEAPONS.sword.mass, 1), great = swingVoice(WEAPONS.greatsword.mass, 1);
    assert.ok(great.rate < sword.rate && great.gain > sword.gain);
    assert.equal(sword.rate, 1);
    assert.ok(swingVoice(WEAPONS.sword.mass, 1.3).gain > sword.gain);
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

  test("a parry clangs, a block clanks, a broken guard crashes", () => {
    const { ctx, hear, player, enemy } = arena();
    ctx.events = [
      { step: 1, event: { type: "parry", by: player, target: enemy } },
      { step: 1, event: { type: "block", by: enemy, target: player, guardBreak: false } },
      { step: 2, event: { type: "block", by: enemy, target: player, guardBreak: true } },
    ];
    assert.deepEqual(sounds(hear(ctx)!), ["parry", "block", "guard-break"]);
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
    assert.equal(windup?.rate, swingVoice(WEAPONS["kobold-greatsword"].mass, 1).rate);
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
