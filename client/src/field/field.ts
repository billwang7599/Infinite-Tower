/**
 * The field mode: the 2D top-down map. The server decides everything here (which level, where you
 * are, encounters, the actors); this mode predicts your own walking, mirrors the actors, and draws.
 * Built once; each session joins it to that session's connection and leaves it empty again.
 */
import type { Engine } from "@babylonjs/core";
import { FIXED_DT, fullVitals, PLAYER, type MsgOf, type ServerMsg, type System, type World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import { frameSeconds } from "../core/time.js";
import type { Connection } from "../net/connection.js";
import type { Settings } from "../settings/settings.js";
import type { FieldHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { registerFieldDisposers } from "./components.js";
import { spawnFieldPlayer } from "./entities/player.js";
import { readWalkInput } from "./input.js";
import { loadLevel, unloadLevel } from "./levels/index.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";
import type { FieldView } from "./scene.js";
import { fieldCameraSystem, snapFieldCamera } from "./systems/camera.js";
import { fieldSpriteSystem } from "./systems/sprites.js";

type Msg<T extends ServerMsg["t"]> = MsgOf<ServerMsg, T>;

export interface Field {
  view: FieldView;
  /** A session starts: your walking goes to this connection, which sends the level next. */
  join(net: Connection, welcome: Msg<"welcome">): void;
  /** The session ended: forget the level and its actors. */
  leave(): void;
  update(dt: number, frozen: boolean): void;
  onLevel(msg: Msg<"level">): void;
  onState(msg: Msg<"state">): void;
  onEncounter(msg: Msg<"encounter">): void;
  onBattleResult(msg: Msg<"battleResult">): void;
  /** Left the arena: stop walking until the server's result arrives. */
  awaitResult(): void;
  render(): void;
}

export interface FieldOptions {
  engine: Engine;
  world: World;
  view: FieldView;
  keyboard: Keyboard;
  settings: Settings;
  hud: Store<FieldHudState>;
}

export function createField(opts: FieldOptions): Field {
  const { engine, world, view, keyboard, settings } = opts;
  registerFieldDisposers(world);
  const player = spawnFieldPlayer(world, view, { x: 0, z: 0 });
  const actors = new ActorMirror(world, view);

  /** One per session (its input numbering starts over with the server's). */
  let prediction: Prediction | null = null;
  /** No walking between an encounter and the server's battle result. */
  let inFight = false;
  let wins = 0;
  let vitals = fullVitals();

  const render: System[] = [fieldSpriteSystem(view), fieldCameraSystem(view)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    for (const s of render) s(world, dt);
  });

  let accumulator = 0;
  return {
    view,
    join(net, welcome) {
      prediction = new Prediction(world, view, player, net);
      inFight = false;
      wins = welcome.wins;
      vitals = welcome.vitals;
    },
    leave() {
      prediction = null;
      inFight = false;
      actors.clear();
      unloadLevel(view);
    },
    update(dt, frozen) {
      const p = prediction;
      if (frozen || inFight || !view.level || !p) { accumulator = 0; return; }
      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        p.step(readWalkInput(keyboard, settings.bindings.get().field));
        accumulator -= FIXED_DT;
      }
    },
    onLevel(msg) {
      actors.clear();
      loadLevel(view, msg.level);
      prediction?.reset(msg.me);
      snapFieldCamera(view, world);
    },
    onState(msg) {
      if (inFight) return;
      prediction?.reconcile(msg.ack, msg.me);
      actors.apply(msg.actors);
      wins = msg.wins;
    },
    onEncounter(msg) {
      inFight = true;
      prediction?.reset(msg.me);
    },
    onBattleResult(msg) {
      inFight = false;
      wins = msg.wins;
      vitals = msg.vitals;
      prediction?.reset(msg.me);
      snapFieldCamera(view, world);
    },
    awaitResult() {
      inFight = true;
    },
    render() {
      opts.hud.set({
        levelName: view.level?.name ?? "…", wins,
        hp: vitals.hp / PLAYER.maxHp, stamina: vitals.stamina / PLAYER.maxStamina,
      });
      view.scene.render();
    },
  };
}
