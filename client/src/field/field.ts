/**
 * The field mode: the 2D top-down map. The server decides everything here (which level, where you
 * are, encounters, the actors); this mode predicts your own walking, mirrors the actors, and draws.
 * Built once; each session joins it to that session's connection and leaves it empty again.
 */
import type { Engine } from "@babylonjs/core";
import {
  FIXED_DT, nearCampfire, PLAYER, type MsgOf, type ServerMsg, type Stats, type System, type Vitals, type World,
} from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import { frameSeconds } from "../core/time.js";
import type { Connection } from "../net/connection.js";
import type { Settings } from "../settings/settings.js";
import type { FieldHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { FieldPos, registerFieldDisposers } from "./components.js";
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
  onRested(msg: Msg<"rested">): void;
  /** Rest at the campfire you're standing by (the Rest key, or the HUD's button). */
  rest(): void;
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
  let net: Connection | null = null;
  /** No walking between an encounter and the server's battle result. */
  let inFight = false;
  let wins = 0;
  /** From `welcome`; until then the HUD isn't drawn. */
  let vitals: Vitals = { hp: 0, stamina: 0 };
  let stats: Stats | null = null;

  const render: System[] = [fieldSpriteSystem(view), fieldCameraSystem(view)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    for (const s of render) s(world, dt);
  });

  /** Walking around a level (not in or leaving a fight), next to a campfire. */
  const byCampfire = () => !!prediction && !inFight && !!view.level && nearCampfire(view.level, world.require(player, FieldPos));

  let accumulator = 0;
  return {
    view,
    join(connection, welcome) {
      net = connection;
      prediction = new Prediction(world, view, player, connection);
      inFight = false;
      wins = welcome.wins;
      vitals = welcome.vitals;
      stats = welcome.stats;
    },
    leave() {
      prediction = null;
      net = null;
      inFight = false;
      actors.clear();
      unloadLevel(view);
    },
    update(dt, frozen) {
      const p = prediction;
      if (frozen || inFight || !view.level || !p) { accumulator = 0; return; }
      if (keyboard.consumePressed(...settings.bindings.get().field.rest)) this.rest();
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
    onRested(msg) {
      vitals = msg.vitals;
    },
    rest() {
      if (byCampfire()) net?.send({ t: "rest" });
    },
    awaitResult() {
      inFight = true;
    },
    render() {
      opts.hud.set({
        levelName: view.level?.name ?? "…", wins,
        hp: vitals.hp / PLAYER.maxHp, stamina: stats ? vitals.stamina / stats.stamina : 0, stats,
        nearCampfire: byCampfire(),
      });
      view.scene.render();
    },
  };
}
