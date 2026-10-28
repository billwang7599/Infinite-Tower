/**
 * The battle mode: the client's own copy of the whole fight, drawn as it runs. Each frame the keys are read and the
 * fight runs as many steps as its clock says (pace.ts) through sync.ts; then the render systems draw it.
 */
import { TransformNode, type AbstractEngine } from "@babylonjs/core";
import {
  Body, copyInput, dampFactor, Enemy, IDLE_INPUT, LocalPlayer, Player, sameSpell, type ArenaDef, type ClientMsg,
  type Entity, type Hand, type ServerMsgOf, type Spell, type System, type Vec3, type World,
} from "@infinite-tower/shared";
import { Fight } from "@infinite-tower/shared/fight";
import type { Actions } from "../../core/actions.js";
import { frameSeconds } from "../../core/time.js";
import type { Settings } from "../../settings/settings.js";
import type { ChantState } from "../../ui/spells/chant.js";
import type { BattleHudState, SpellsState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { buildArena } from "./arena.js";
import {
  BodyNode, DrawOffset, easeCorrection, registerArenaDisposers, registerFighterDisposers,
} from "./components.js";
import { resultShown, type BattleContext } from "./context.js";
import { ENEMY_MODELS } from "./enemies/models/index.js";
import { closestFoe, livingFoes, lockYaw, steerLock } from "./lock.js";
import { createMaterials } from "./materials.js";
import { registerPlayerDisposers } from "./player/components.js";
import { readPlayerInput } from "./player/input.js";
import { addPlayerSprite } from "./player/spawn.js";
import { playerSpriteSystem } from "./player/sprite.js";
import type { BattleScene } from "./scene.js";
import { FightSync } from "./sync.js";
import { addImpactShake, cameraSystem } from "./systems/camera.js";
import { hudSystem } from "./systems/hud.js";
import { lockMarkerSystem } from "./lockMarker.js";
import { createSpellEffects } from "./spells/spells.js";

const HOTBAR = ["spell1", "spell2", "spell3", "spell4"] as const;

/** Where the camera looks as each fight starts. */
const START_VIEW = { yaw: 0, pitch: 0.32 } as const;
/** How fast a correction's offset eases away (about 1/rate seconds). */
const CORRECTION_EASE_RATE = 15;

export interface Battle {
  ctx: BattleContext;
  /** Builds the server's fight from `encounter`. Your inputs go out through `send`. */
  start(encounter: ServerMsgOf<"encounter">, send: (msg: ClientMsg) => void): void;
  onHash(msg: ServerMsgOf<"battleHash">): void;
  onSync(msg: ServerMsgOf<"battleSync">): void;
  /** battleResult: now the result shows. */
  onResult(won: boolean): void;
  /** Leaving the arena: the fight's copy is dropped. */
  end(): void;
  render(): void;
}

export interface BattleOptions {
  engine: AbstractEngine;
  world: World;
  scene: BattleScene;
  actions: Actions;
  settings: Settings;
  hud: Store<BattleHudState>;
  spells: Store<SpellsState>;
  chant: Store<ChantState>;
  bag: Store<{ open: boolean }>;
  onLeave: () => void;
  onSwordHand: (hand: Hand | null) => void;
}

export function createBattle(opts: BattleOptions): Battle {
  const { engine, world, actions, settings } = opts;
  const { scene, camera, sunShadows } = opts.scene;
  registerArenaDisposers(world);

  const ctx: BattleContext = {
    world, scene, camera, polled: actions.poll(), actions, settings, sunShadows,
    materials: createMaterials(scene),
    arena: { radius: 0 },
    view: { ...START_VIEW },
    lock: null,
    fight: null,
    sync: null,
    outcome: { state: "fighting", stateTime: 0 },
    shake: 0,
    casts: [],
    writes: [],
    gearMoves: [],
  };
  const spells = createSpellEffects(ctx);
  let arenaScenery: Entity | null = null;
  /** Build the arena on the first fight; rebuild only if the next one is a different size. */
  const useArena = (arena: ArenaDef) => {
    if (arenaScenery !== null && arena.radius === ctx.arena.radius) return;
    if (arenaScenery !== null) world.destroy(arenaScenery);
    world.flush();
    ctx.arena = { ...arena };
    arenaScenery = buildArena(ctx);
  };

  const input = copyInput(IDLE_INPUT);
  let casting: Spell | null = null;
  let swordHand: Hand | null = null;
  /** The fight's steps due this frame, with the keys as they are now. */
  const runFight = (fight: Fight, sync: FightSync) => {
    // None due (held back: ahead of the server's clock): the keys wait, so a tap isn't lost.
    const steps = sync.pace.stepsDue(fight.steps);
    if (steps === 0) return;
    ctx.polled = actions.poll();
    if (ctx.polled.pressed.includes("leave") && resultShown(ctx.outcome)) opts.onLeave();
    const [, , { pos: me }, { book }] = fight.world.first(LocalPlayer, Body, Player)!;
    for (const action of ctx.polled.pressed) {
      const written = book[HOTBAR.indexOf(action as (typeof HOTBAR)[number])];
      if (written) ctx.casts.push(written);
    }
    const foes = livingFoes(fight);
    ctx.lock = steerLock(ctx.lock, ctx.polled.pressed, foes, { pos: ctx.camera.position, yaw: ctx.view.yaw }, me);
    const target = foes.find((f) => f.e === ctx.lock)?.pos;
    readPlayerInput(ctx.polled, (target && lockYaw(me, target)) ?? ctx.view.yaw, input);
    const last = casting;
    input.castHeld = last !== null && HOTBAR.some((key, i) => {
      const page = book[i];
      return ctx.polled.held.has(key) && page && sameSpell(page, last);
    });
    input.cast = last ? null : ctx.casts.shift() ?? null;
    casting = input.castHeld ? last : input.cast;
    input.locked = ctx.lock === null ? null : fight.enemies.indexOf(ctx.lock);
    input.write = input.write ? null : ctx.writes.shift() ?? null;
    input.chant = opts.chant.get().open;
    input.bag = opts.bag.get().open;
    input.gear = input.gear ? null : ctx.gearMoves.shift() ?? null;
    for (let i = 0; i < steps; i++) {
      sync.advance(input);
      addImpactShake(ctx, fight.events);
      spells.addEvents(fight.events);
    }
    sync.flush();
    opts.spells.set({ book: fight.world.first(LocalPlayer, Player)![2].book });
  };

  const render: System[] = [
    followSystem(), cameraSystem(ctx), lockMarkerSystem(ctx), playerSpriteSystem(ctx),
    ...Object.values(ENEMY_MODELS).map((model) => model.animation()),
    hudSystem(ctx, opts.hud), spells.system,
  ];
  scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    const { fight, sync } = ctx;
    if (!fight || !sync) return;
    runFight(fight, sync);
    const { sword } = fight.world.first(LocalPlayer, Player)![2].wields;
    if (sword !== swordHand) opts.onSwordHand(swordHand = sword);
    for (const s of render) s(fight.world, dt);
  });

  /** Every fighter's position, to ease the drawings over a correction. */
  const positions = (fight: Fight): Vec3[] =>
    [...fight.players, ...fight.enemies].map((e) => ({ ...fight.world.require(e, Body).pos }));

  return {
    ctx,
    start({ setup, seat }, send) {
      ctx.fight?.dispose();
      spells.clear();
      ctx.casts = [];
      ctx.writes = [];
      ctx.gearMoves = [];
      useArena(setup.arena);
      const fight = new Fight(setup);
      registerFighterDisposers(fight.world);
      registerPlayerDisposers(fight.world);
      for (const model of Object.values(ENEMY_MODELS)) model.registerDisposers(fight.world);
      fight.world.add(fight.players[seat]!, LocalPlayer, true);
      for (const e of fight.players) addPlayerSprite(ctx, fight.world, e);
      for (const e of fight.enemies) addEnemyModel(ctx, fight.world, e);
      for (const e of [...fight.players, ...fight.enemies]) fight.world.add(e, DrawOffset, { x: 0, y: 0, z: 0 });
      ctx.fight = fight;
      swordHand = fight.world.require(fight.players[seat]!, Player).wields.sword;
      ctx.sync = new FightSync(fight, seat, send);
      ctx.outcome = ctx.sync.outcome;
      const me = fight.world.require(fight.players[seat]!, Body).pos, foes = livingFoes(fight);
      ctx.lock = closestFoe(foes, me);
      const target = foes.find((f) => f.e === ctx.lock)?.pos;
      Object.assign(ctx.view, START_VIEW, { yaw: (target && lockYaw(me, target)) ?? START_VIEW.yaw });
      ctx.polled = actions.poll();
      ctx.shake = 0;
      // The last fight's result off the HUD before it shows again (its systems write it from the next frame on).
      opts.hud.set({ result: "fighting", showResult: false });
    },
    onHash(msg) {
      ctx.sync?.onHash(msg);
    },
    onSync(msg) {
      const { fight, sync } = ctx;
      if (!fight || !sync) return;
      const before = positions(fight);
      sync.onSync(msg);
      // Bodies jump to where they should be; their drawings ease after them.
      [...fight.players, ...fight.enemies].forEach((e, i) => {
        const { pos } = fight.world.require(e, Body), was = before[i]!;
        easeCorrection(fight.world.require(e, DrawOffset), { x: pos.x - was.x, y: pos.y - was.y, z: pos.z - was.z });
      });
    },
    onResult(won) {
      ctx.sync?.onResult(won);
    },
    end() {
      ctx.fight?.dispose();
      spells.clear();
      ctx.fight = null;
      ctx.sync = null;
      ctx.lock = null;
    },
    render: () => scene.render(),
  };
}

/** On the fight's enemy `e`: a node that follows its body, and the model its def names. */
function addEnemyModel(ctx: BattleContext, world: World, e: Entity): void {
  const node = new TransformNode(`enemy-${e}`, ctx.scene);
  const at = world.require(e, Body).pos;
  node.position.set(at.x, at.y, at.z);
  world.add(e, BodyNode, { node });
  const enemy = world.require(e, Enemy);
  ENEMY_MODELS[enemy.def.model].add(ctx, world, e, node, enemy.def, enemy.yaw);
}

/** Per render frame: each fighter's drawing goes where its body is, plus its easing correction. */
function followSystem(): System {
  return (world, dt) => {
    for (const [, { node }, { pos }] of world.query(BodyNode, Body)) node.position.set(pos.x, pos.y, pos.z);
    const k = 1 - dampFactor(CORRECTION_EASE_RATE, dt);
    for (const [, { node }, offset] of world.query(BodyNode, DrawOffset)) {
      offset.x *= k;
      offset.y *= k;
      offset.z *= k;
      node.position.addInPlaceFromFloats(offset.x, offset.y, offset.z);
    }
  };
}
