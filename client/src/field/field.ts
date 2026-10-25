/**
 * The field mode: the 2D top-down map. The server decides everything here (which level, where you
 * are, encounters, the actors); this mode predicts your own walking, mirrors the actors, draws, and keeps the
 * field HUD (`ui.field`) up to date as the server's messages arrive.
 * Built once; each session joins it to that session's connection and leaves it empty again.
 */
import type { AbstractEngine } from "@babylonjs/core";
import {
  FIXED_DT, nearCampfire, PLAYER,
  type Inventory, type ServerMsgOf, type System, type Vitals, type WalkInput, type World,
} from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import { frameSeconds } from "../core/time.js";
import type { Connection, Joined } from "../net/connection.js";
import type { KeyMap } from "../settings/bindings.js";
import type { Settings } from "../settings/settings.js";
import type { FieldHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { FieldPos, registerFieldDisposers } from "./components.js";
import { spawnFieldPlayer } from "./entities/player.js";
import { loadLevel, unloadLevel } from "./levels/index.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";
import type { FieldView } from "./scene.js";
import { fieldCameraSystem, snapFieldCamera } from "./systems/camera.js";
import { fieldSpriteSystem } from "./systems/sprites.js";

export interface Field {
  view: FieldView;
  /** A session starts: your walking goes to this connection, which sends the level next. */
  join(joined: Joined): void;
  /** The session ended: forget the level and its actors. */
  leave(): void;
  update(dt: number, frozen: boolean): void;
  onLevel(msg: ServerMsgOf<"level">): void;
  onState(msg: ServerMsgOf<"state">): void;
  /** Walking stops until the battle's result arrives (the server sends it once the client sends `battleEnd`). */
  onEncounter(msg: ServerMsgOf<"encounter">): void;
  onBattleResult(msg: ServerMsgOf<"battleResult">): void;
  /** Rested, or used an item. */
  setVitals(vitals: Vitals): void;
  setInventory(inventory: Inventory): void;
  /** Rest at the campfire you're standing by (the Rest key, or the HUD's button). */
  rest(): void;
  render(): void;
}

interface FieldOptions {
  engine: AbstractEngine;
  world: World;
  view: FieldView;
  keyboard: Keyboard;
  settings: Settings;
  hud: Store<FieldHudState>;
}

export function createField({ engine, world, view, keyboard, settings, hud }: FieldOptions): Field {
  registerFieldDisposers(world);
  const player = spawnFieldPlayer(world, view, { x: 0, z: 0 });
  const actors = new ActorMirror(world, view);

  /** One per session (its input numbering starts over with the server's). */
  let prediction: Prediction | null = null;
  let net: Connection | null = null;
  /** From the encounter until the server's battle result: no walking, and `state` is ignored. */
  let inBattle = false;
  /** From `welcome`: stats don't change during a session. */
  let maxStamina = 1;

  const render: System[] = [fieldSpriteSystem(view), fieldCameraSystem(view, player)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    for (const s of render) s(world, dt);
  });

  const playerPos = () => world.require(player, FieldPos);
  /** Walking around a level (not in or leaving a battle), next to a campfire. */
  const byCampfire = () => !!prediction && !inBattle && !!view.level && nearCampfire(view.level, playerPos());
  const rest = () => {
    if (byCampfire()) net?.send({ t: "rest" });
  };
  const setVitals = (v: Vitals) =>
    hud.set({ hpFraction: v.hp / PLAYER.maxHp, staminaFraction: v.stamina / maxStamina });
  const setInventory = (inventory: Inventory) => hud.set({ inventory });

  let accumulator = 0;
  return {
    view,
    join({ net: joinedNet, welcome }) {
      net = joinedNet;
      prediction = new Prediction(world, view, player, joinedNet);
      inBattle = false;
      maxStamina = welcome.stats.stamina;
      hud.set({ levelName: "…", wins: welcome.wins, stats: welcome.stats, inventory: welcome.inventory });
      setVitals(welcome.vitals);
    },
    leave() {
      prediction = null;
      net = null;
      inBattle = false;
      actors.clear();
      unloadLevel(view);
    },
    update(dt, frozen) {
      if (frozen || inBattle || !view.level || !prediction) { accumulator = 0; return; }
      const keys = settings.bindings.get().field;
      if (keyboard.consumePressed(keys.rest)) rest();
      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        prediction.step(readWalkInput(keyboard, keys));
        accumulator -= FIXED_DT;
      }
    },
    onLevel(msg) {
      actors.clear();
      loadLevel(view, msg.level);
      prediction?.reset(msg.me);
      snapFieldCamera(view, playerPos());
      hud.set({ levelName: msg.level.name });
    },
    onState(msg) {
      if (inBattle) return;
      prediction?.reconcile(msg.ack, msg.me);
      actors.apply(msg.actors);
    },
    onEncounter(msg) {
      inBattle = true;
      prediction?.reset(msg.me);
    },
    onBattleResult(msg) {
      inBattle = false;
      prediction?.reset(msg.me);
      snapFieldCamera(view, playerPos());
      hud.set({ wins: msg.wins, inventory: msg.inventory });
      setVitals(msg.vitals);
    },
    setVitals,
    setInventory,
    rest,
    render() {
      hud.set({ nearCampfire: byCampfire() });
      view.scene.render();
    },
  };
}

/** The field's walk keys -> a walk input. Screen-aligned: up is +z. */
function readWalkInput(keyboard: Keyboard, keys: KeyMap["field"]): WalkInput {
  return { moveX: keyboard.axis(keys.left, keys.right), moveZ: keyboard.axis(keys.down, keys.up) };
}
