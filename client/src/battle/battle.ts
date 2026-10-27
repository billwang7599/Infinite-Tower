/**
 * The battle mode: the 2.5D arena fight, drawn. The server runs the fight; this keeps a copy of it (the shared Fight,
 * built from the encounter's setup) to draw. Babylon's deterministic lockstep calls onBeforeStep at FIXED_DT, only
 * while the arena's scene renders, and each call reads the keys, predicts your own fighter one step (prediction.ts)
 * and moves everyone else along the server's states (mirror.ts). Each `battleState` corrects your fighter and feeds
 * the mirror; the inputs go out once a frame. Render systems draw the fight's state once per frame.
 */
import type { AbstractEngine } from "@babylonjs/core";
import {
  FIXED_DT, LocalPlayer, type ArenaDef, type ClientMsg, type Entity, type PlayerInputData, type ServerMsgOf,
  type System, type World,
} from "@infinite-tower/shared";
import { Fight } from "@infinite-tower/shared/fight";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import { frameSeconds } from "../core/time.js";
import type { Settings } from "../settings/settings.js";
import type { BattleHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { buildArena } from "./arena.js";
import { DrawOffset, easeCorrection, registerArenaDisposers, registerFighterDisposers } from "./components.js";
import { resultShown, type BattleContext } from "./context.js";
import { ENEMY_MODELS } from "./enemies/models/index.js";
import { addEnemyModel } from "./enemies/spawn.js";
import { createMaterials } from "./materials.js";
import { FightMirror } from "./mirror.js";
import { registerPlayerDisposers } from "./player/components.js";
import { readPlayerInput } from "./player/input.js";
import { addPlayerSprite } from "./player/spawn.js";
import { playerSpriteSystem } from "./player/sprite.js";
import { BattlePrediction } from "./prediction.js";
import type { BattleScene } from "./scene.js";
import { cameraSystem } from "./systems/camera.js";
import { followSystem } from "./systems/follow.js";
import { hudSystem } from "./systems/hud.js";
import { shakeForImpacts } from "./systems/impacts.js";

/** Where the camera looks as each fight starts. */
const START_VIEW = { yaw: 0, pitch: 0.32 } as const;

export interface Battle {
  ctx: BattleContext;
  /** A fight starts: build the server's fight from `encounter`. Your inputs go out through `send`. */
  start(encounter: ServerMsgOf<"encounter">, send: (msg: ClientMsg) => void): void;
  /** The server's state of the fight. */
  onState(msg: ServerMsgOf<"battleState">): void;
  /** Leaving the arena: the fight's copy is dropped. */
  end(): void;
  render(): void;
}

export interface BattleOptions {
  engine: AbstractEngine;
  world: World;
  scene: BattleScene;
  keyboard: Keyboard;
  mouse: Mouse;
  settings: Settings;
  hud: Store<BattleHudState>;
  onLeave: () => void;
}

export function createBattle(opts: BattleOptions): Battle {
  const { engine, world, keyboard, settings } = opts;
  const { scene, camera, sunShadows } = opts.scene;
  registerArenaDisposers(world);

  const ctx: BattleContext = {
    world, scene, camera, keyboard, mouse: opts.mouse, settings, sunShadows,
    materials: createMaterials(scene),
    arena: { radius: 0 },
    view: { ...START_VIEW },
    fight: null,
    outcome: { state: "fighting", stateTime: 0 },
    shake: 0,
  };
  let arenaScenery: Entity | null = null;
  /** Build the arena on the first fight; rebuild only if the next one is a different size. */
  const useArena = (arena: ArenaDef) => {
    if (arenaScenery !== null && arena.radius === ctx.arena.radius) return;
    if (arenaScenery !== null) world.destroy(arenaScenery);
    world.flush();
    ctx.arena = { ...arena };
    arenaScenery = buildArena(ctx);
  };

  /** The fight's: made on start, dropped on end. */
  let prediction: BattlePrediction | null = null;
  let mirror: FightMirror | null = null;
  let me: Entity | null = null;

  const input: PlayerInputData = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false };
  scene.onBeforeStepObservable.add(() => {
    if (!ctx.fight || !prediction || !mirror) return;
    // After the fight, the leave key (Enter / E by default) goes back, once the result has been on screen a moment.
    const leave = keyboard.consumePressed(settings.bindings.get().battle.leave);
    if (leave && resultShown(ctx.outcome)) opts.onLeave();
    readPlayerInput(ctx, input);
    prediction.step(input);
    mirror.step();
    ctx.outcome.stateTime += FIXED_DT;
  });

  const render: System[] = [
    followSystem(), cameraSystem(ctx), playerSpriteSystem(ctx),
    ...Object.values(ENEMY_MODELS).map((model) => model.animation()),
    hudSystem(ctx, opts.hud),
  ];
  scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    prediction?.flush();
    if (ctx.fight) for (const s of render) s(ctx.fight.world, dt);
  });

  return {
    ctx,
    start({ setup, seat }, send) {
      ctx.fight?.dispose();
      useArena(setup.arena);
      const fight = new Fight(setup);
      registerFighterDisposers(fight.world);
      registerPlayerDisposers(fight.world);
      for (const model of Object.values(ENEMY_MODELS)) model.registerDisposers(fight.world);
      me = fight.players[seat]!;
      fight.world.add(me, LocalPlayer, true);
      fight.world.add(me, DrawOffset, { x: 0, y: 0, z: 0 });
      for (const e of fight.players) addPlayerSprite(ctx, fight.world, e);
      for (const e of fight.enemies) addEnemyModel(ctx, fight.world, e);
      ctx.fight = fight;
      ctx.outcome = { state: "fighting", stateTime: 0 };
      prediction = new BattlePrediction(fight, me, send);
      mirror = new FightMirror(fight, seat);
      Object.assign(ctx.view, START_VIEW);
      ctx.shake = 0;
      keyboard.clearPressed();
    },
    onState(msg) {
      if (!ctx.fight || !prediction || !mirror || me === null) return;
      easeCorrection(ctx.fight.world.require(me, DrawOffset), prediction.reconcile(msg));
      mirror.push(msg);
      shakeForImpacts(ctx, msg.events);
      if (msg.outcome === ctx.outcome.state) return;
      ctx.outcome = { state: msg.outcome, stateTime: 0 };
      if (msg.outcome !== "fighting") prediction.stop();
    },
    end() {
      ctx.fight?.dispose();
      ctx.fight = null;
      prediction = mirror = null;
      me = null;
    },
    render: () => scene.render(),
  };
}
