/**
 * The battle mode: the 2.5D arena fight. Owns the fixed-step system lists and starts/ends fights.
 * Babylon's deterministic lockstep runs onBeforeStep / physics / onAfterStep at FIXED_DT, so the arena
 * only simulates while its scene is the one being rendered.
 */
import type { Engine } from "@babylonjs/core";
import {
  FIXED_DT, Fighter, fullVitals, Health, LocalPlayer, Stamina,
  type ArenaDef, type EnemyDef, type Entity, type System, type Vitals, type World,
} from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import { frameSeconds } from "../core/time.js";
import type { Settings } from "../settings/settings.js";
import type { BattleHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { buildArena } from "./arena.js";
import { registerBattleDisposers } from "./components.js";
import type { BattleContext } from "./context.js";
import { enemyBrainSystem } from "./enemies/behaviors/brain.js";
import { chargeAttackSystem } from "./enemies/behaviors/charge.js";
import { goreAttackSystem } from "./enemies/behaviors/gore.js";
import { enemyMotorSystem } from "./enemies/behaviors/motor.js";
import { ENEMY_MODELS } from "./enemies/models/index.js";
import { spawnEnemy } from "./enemies/spawn.js";
import { createMaterials } from "./materials.js";
import { registerPlayerDisposers } from "./player/components.js";
import { playerControllerSystem } from "./player/controller.js";
import { playerGroundSystem } from "./player/ground.js";
import { playerInputSystem } from "./player/input.js";
import { spawnPlayer } from "./player/spawn.js";
import { playerSpriteSystem } from "./player/sprite.js";
import type { BattleScene } from "./scene.js";
import { cameraSystem } from "./systems/camera.js";
import { combatSystem } from "./systems/combat.js";
import { hudSystem } from "./systems/hud.js";

export interface Battle {
  ctx: BattleContext;
  start(enemy: EnemyDef, arena: ArenaDef, vitals: Vitals): void;
  end(): { won: boolean; vitals: Vitals };
  render(): void;
}

export interface BattleOptions {
  engine: Engine;
  world: World;
  scene: BattleScene;
  keyboard: Keyboard;
  mouse: Mouse;
  settings: Settings;
  hud: Store<BattleHudState>;
  onLeave: () => void;
}

export function createBattle(opts: BattleOptions): Battle {
  const { engine, world, keyboard, mouse, settings } = opts;
  const { scene, physics, camera, shadows } = opts.scene;
  registerBattleDisposers(world);
  registerPlayerDisposers(world);
  for (const model of Object.values(ENEMY_MODELS)) model.registerDisposers(world);

  const ctx: BattleContext = {
    world, scene, physics, camera, keyboard, mouse, settings, shadows,
    materials: createMaterials(scene),
    arena: { radius: 0 },
    view: { yaw: 0, pitch: 0.32 },
    fight: { state: "fighting", time: 0 },
    shake: 0,
  };
  let arenaParts: Entity[] | null = null;
  /** Build the arena on the first fight; rebuild only if the next one is a different size. */
  const useArena = (arena: ArenaDef) => {
    if (arenaParts && arena.radius === ctx.arena.radius) return;
    for (const e of arenaParts ?? []) world.destroy(e);
    world.flush();
    ctx.arena = { ...arena };
    arenaParts = buildArena(ctx);
  };

  // After the fight, the leave key (Enter / E by default) goes back, once the result has been on screen a moment.
  const leaveSystem: System = () => {
    const pressed = keyboard.consumePressed(...settings.bindings.get().battle.leave);
    if (pressed && ctx.fight.state !== "fighting" && ctx.fight.time > 1) opts.onLeave();
  };

  // Systems. Order is the game's contract.
  const beforePhysics: System[] = [
    leaveSystem, playerInputSystem(ctx), playerControllerSystem(),
    enemyBrainSystem(), chargeAttackSystem(ctx), goreAttackSystem(), enemyMotorSystem(),
  ];
  const afterPhysics: System[] = [playerGroundSystem(ctx), combatSystem(ctx)];
  const render: System[] = [
    cameraSystem(ctx), playerSpriteSystem(ctx),
    ...Object.values(ENEMY_MODELS).map((model) => model.animation()),
    hudSystem(ctx, opts.hud),
  ];

  scene.onBeforeStepObservable.add(() => {
    for (const s of beforePhysics) s(world, FIXED_DT);
  });
  scene.onAfterStepObservable.add(() => {
    for (const s of afterPhysics) s(world, FIXED_DT);
    world.flush();
  });
  scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    for (const s of render) s(world, dt);
  });

  const clear = () => {
    for (const [e] of world.query(Fighter)) world.destroy(e);
    world.flush();
  };

  return {
    ctx,
    start(enemy, arena, vitals) {
      clear();
      useArena(arena);
      spawnPlayer(ctx, "you", { x: 0, y: 0.05, z: -8 }, vitals, true);
      spawnEnemy(ctx, enemy, { x: 0, y: 0.05, z: 6 }, Math.PI);
      ctx.view.yaw = 0;
      ctx.view.pitch = 0.32;
      ctx.fight.state = "fighting";
      ctx.fight.time = 0;
      keyboard.clearPressed();
    },
    end() {
      const won = ctx.fight.state === "won";
      const me = world.first(LocalPlayer, Health, Stamina);
      const vitals = me ? { hp: me[2].hp, stamina: me[3].value } : fullVitals();
      clear();
      return { won, vitals };
    },
    render: () => scene.render(),
  };
}
