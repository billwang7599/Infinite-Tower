/**
 * The battle mode: the 2.5D arena fight, drawn. The fight itself is a shared Fight (its own world and physics);
 * Babylon's deterministic lockstep calls onBeforeStep at FIXED_DT, and each call reads the keys and steps the fight
 * once, so the arena only moves while its scene is the one being rendered. Render systems draw the fight's state
 * once per frame.
 */
import type { AbstractEngine } from "@babylonjs/core";
import {
  Health, LocalPlayer, Stamina,
  type ArenaDef, type Burden, type EnemyDef, type Entity, type PlayerInputData, type System, type Stats,
  type Vitals, type World,
} from "@infinite-tower/shared";
import { ENEMY_START, ENEMY_START_YAW, Fight, PLAYER_START } from "@infinite-tower/shared/fight";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import { frameSeconds } from "../core/time.js";
import type { Settings } from "../settings/settings.js";
import type { BattleHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { buildArena } from "./arena.js";
import { registerArenaDisposers, registerFighterDisposers } from "./components.js";
import { resultShown, type BattleContext } from "./context.js";
import { ENEMY_MODELS } from "./enemies/models/index.js";
import { addEnemyModel } from "./enemies/spawn.js";
import { createMaterials } from "./materials.js";
import { registerPlayerDisposers } from "./player/components.js";
import { readPlayerInput } from "./player/input.js";
import { addPlayerSprite } from "./player/spawn.js";
import { playerSpriteSystem } from "./player/sprite.js";
import type { BattleScene } from "./scene.js";
import { cameraSystem } from "./systems/camera.js";
import { followSystem } from "./systems/follow.js";
import { hudSystem } from "./systems/hud.js";
import { shakeForImpacts } from "./systems/impacts.js";

/** Where the camera looks as each fight starts. */
const START_VIEW = { yaw: 0, pitch: 0.32 } as const;

export interface Battle {
  ctx: BattleContext;
  /** `vitals`, `stats` and `burden` (how weighed down the bag leaves the player): what they start with. */
  start(enemy: EnemyDef, arena: ArenaDef, vitals: Vitals, stats: Stats, burden: Burden): void;
  end(): { won: boolean; vitals: Vitals };
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

  const input: PlayerInputData = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false };
  scene.onBeforeStepObservable.add(() => {
    const fight = ctx.fight;
    if (!fight) return;
    // After the fight, the leave key (Enter / E by default) goes back, once the result has been on screen a moment.
    const leave = keyboard.consumePressed(settings.bindings.get().battle.leave);
    if (leave && resultShown(fight.outcome)) opts.onLeave();
    readPlayerInput(ctx, input);
    fight.step([input]);
    shakeForImpacts(ctx, fight.events);
  });

  const render: System[] = [
    followSystem(), cameraSystem(ctx), playerSpriteSystem(ctx),
    ...Object.values(ENEMY_MODELS).map((model) => model.animation()),
    hudSystem(ctx, opts.hud),
  ];
  scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    if (ctx.fight) for (const s of render) s(ctx.fight.world, dt);
  });

  /** What the fight started with: reported back if the player somehow isn't there at the end. */
  let startVitals: Vitals = { hp: 0, stamina: 0 };

  return {
    ctx,
    start(enemy, arena, vitals, stats, burden) {
      ctx.fight?.dispose();
      useArena(arena);
      startVitals = vitals;
      const fight = new Fight({
        arena,
        players: [{ at: PLAYER_START, vitals, stats, burden }],
        enemies: [{ def: enemy, at: ENEMY_START, yaw: ENEMY_START_YAW }],
      });
      registerFighterDisposers(fight.world);
      registerPlayerDisposers(fight.world);
      for (const model of Object.values(ENEMY_MODELS)) model.registerDisposers(fight.world);
      const me = fight.players[0]!;
      fight.world.add(me, LocalPlayer, true);
      addPlayerSprite(ctx, fight.world, me);
      for (const e of fight.enemies) addEnemyModel(ctx, fight.world, e);
      ctx.fight = fight;
      Object.assign(ctx.view, START_VIEW);
      ctx.shake = 0;
      keyboard.clearPressed();
    },
    end() {
      const fight = ctx.fight;
      const won = fight?.outcome.state === "won";
      const me = fight?.world.first(LocalPlayer, Health, Stamina);
      const vitals = me ? { hp: me[2].hp, stamina: me[3].value } : startVitals;
      fight?.dispose();
      ctx.fight = null;
      return { won, vitals };
    },
    render: () => scene.render(),
  };
}
