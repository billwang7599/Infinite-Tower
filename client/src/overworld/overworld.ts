/**
 * The overworld mode: the 2D top-down map. The server decides everything here (which level, where you
 * are, encounters, the actors); this mode predicts your own walking, mirrors the actors, draws, and keeps the
 * overworld HUD (`ui.overworld`) up to date as the server's messages arrive.
 * Built once; each session joins it to that session's connection and leaves it empty again.
 */
import type { AbstractEngine } from "@babylonjs/core";
import {
  bagBurden, FIXED_DT, nearCampfire, PLAYER, walkPace,
  type Bag, type ServerMsgOf, type Stats, type System, type Vitals, type WalkInput, type World,
} from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import { frameSeconds } from "../core/time.js";
import type { Connection, Joined } from "../net/connection.js";
import type { KeyMap } from "../settings/bindings.js";
import type { Settings } from "../settings/settings.js";
import type { OverworldHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { OverworldPos, registerOverworldDisposers } from "./components.js";
import { spawnOverworldPlayer } from "./entities/player.js";
import { loadLevel, unloadLevel } from "./levels/index.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";
import type { OverworldView } from "./scene.js";
import { overworldCameraSystem, snapOverworldCamera } from "./systems/camera.js";
import { overworldSpriteSystem } from "./systems/sprites.js";

export interface Overworld {
  view: OverworldView;
  /** A session starts: your walking goes to this connection, which sends the level next. */
  join(joined: Joined): void;
  /** The session ended: forget the level and its actors. */
  leave(): void;
  update(dt: number, frozen: boolean): void;
  onLevel(msg: ServerMsgOf<"level">): void;
  onState(msg: ServerMsgOf<"state">): void;
  /** Walking stops until the player is back from the arena with the battle's result. */
  onEncounter(msg: ServerMsgOf<"encounter">): void;
  onBattleResult(msg: ServerMsgOf<"battleResult">): void;
  /** Rested, or used an item. */
  setVitals(vitals: Vitals): void;
  setBag(bag: Bag): void;
  /** Rest at the campfire you're standing by (the Rest key, or the HUD's button). */
  rest(): void;
  render(): void;
}

interface OverworldOptions {
  engine: AbstractEngine;
  world: World;
  view: OverworldView;
  keyboard: Keyboard;
  settings: Settings;
  hud: Store<OverworldHudState>;
}

export function createOverworld({ engine, world, view, keyboard, settings, hud }: OverworldOptions): Overworld {
  registerOverworldDisposers(world);
  const player = spawnOverworldPlayer(world, view, { x: 0, z: 0 });
  const actors = new ActorMirror(world, view);

  /** One per session (its input numbering starts over with the server's). */
  let prediction: Prediction | null = null;
  let net: Connection | null = null;
  /** From the encounter until back from the arena with the result: no walking, and `state` is ignored. */
  let inBattle = false;
  /** From `welcome`: stats don't change during a session. */
  let stats: Stats | null = null;

  const render: System[] = [overworldSpriteSystem(view), overworldCameraSystem(view, player)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    for (const s of render) s(world, dt);
  });

  const playerPos = () => world.require(player, OverworldPos);
  /** Walking around a level (not in or leaving a battle), next to a campfire. */
  const byCampfire = () => !!prediction && !inBattle && !!view.level && nearCampfire(view.level, playerPos());
  const rest = () => {
    if (byCampfire()) net?.send({ t: "rest" });
  };
  const setVitals = (v: Vitals) =>
    hud.set({ hpFraction: v.hp / PLAYER.maxHp, staminaFraction: v.stamina / (stats?.stamina ?? 1) });
  /** The bag's weight also sets the walking pace, which the server walks at too. */
  const setBag = (bag: Bag) => {
    hud.set({ bag });
    if (prediction && stats) prediction.pace = walkPace(bagBurden(bag, stats));
  };

  let accumulator = 0;
  return {
    view,
    join({ net: joinedNet, welcome }) {
      net = joinedNet;
      prediction = new Prediction(world, view, player, joinedNet);
      inBattle = false;
      stats = welcome.stats;
      hud.set({ levelName: "…", wins: welcome.wins, stats: welcome.stats });
      setBag(welcome.bag);
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
      const keys = settings.bindings.get().overworld;
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
      snapOverworldCamera(view, playerPos());
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
      snapOverworldCamera(view, playerPos());
      hud.set({ wins: msg.wins });
      setBag(msg.bag);
      setVitals(msg.vitals);
    },
    setVitals,
    setBag,
    rest,
    render() {
      hud.set({ nearCampfire: byCampfire() });
      view.scene.render();
    },
  };
}

/** The overworld's walk keys -> a walk input. Screen-aligned: up is +z. */
function readWalkInput(keyboard: Keyboard, keys: KeyMap["overworld"]): WalkInput {
  return { moveX: keyboard.axis(keys.left, keys.right), moveZ: keyboard.axis(keys.down, keys.up) };
}
