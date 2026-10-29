import { Engine, type StandardMaterial } from "@babylonjs/core";
import {
  Enemy, heldIn, LocalPlayer, Player, SkillObject, weaponItemIn, Wielder, type EnemyId, type Entity, type Look,
  type SkillObjectKind, type World,
} from "@infinite-tower/shared";
import type { Fight, FightEvent } from "@infinite-tower/shared/fight";
import type { Mode } from "../game/transition.js";
import type { BattleContext } from "../modes/battle/context.js";
import type { StepEvent } from "../modes/battle/sync.js";
import { OverworldActor, type OverworldActorData, type OverworldState } from "../modes/overworld/components.js";
import { arenaStage } from "./battle/battle.js";
import { clash, PARRY_HIT_STOP_MS, strike } from "./battle/impact.js";
import { playerFrames, type PlayerFrames } from "./battle/materials.js";
import { playerVisual } from "./battle/player.js";
import { createBattleScene, type ArenaScene } from "./battle/scene.js";
import { beamVisual, boltVisual, cloudVisual, imbueVisual, waitVisual } from "./battle/skills.js";
import { WEAPON_LOOKS } from "./battle/weapons.js";
import { PlayerLook, type Held } from "./characters.js";
import { byEnemy } from "./enemies/index.js";
import { overworldStage } from "./overworld/overworld.js";
import { WALKERS } from "./overworld/walker.js";
import { createOverworldScene } from "./overworld/scene.js";
import { redrawSprite } from "./sprites.js";

/** `S` is the drawing's own state (meshes, smoothing), never game state. */
export interface Visual<S, Scene = ArenaScene> {
  spawn(scene: Scene, world: World, e: Entity): S;
  frame(s: S, world: World, e: Entity, dt: number): void;
  dispose(s: S): void;
}

export type VisualKind = "player" | EnemyId | SkillObjectKind;

type AnyVisual<Scene = ArenaScene> = Visual<any, Scene>;

export const VISUALS: Record<VisualKind, AnyVisual> = {
  player: playerVisual,
  ...byEnemy((look) => look.battle),
  bolt: boltVisual,
  beam: beamVisual,
  cloud: cloudVisual,
  wait: waitVisual,
  imbue: imbueVisual,
};

export function kindOf(world: World, e: Entity): VisualKind | null {
  if (world.get(e, Player)) return "player";
  return world.get(e, Enemy)?.def.id ?? world.get(e, SkillObject)?.kind ?? null;
}

const shake = (scene: ArenaScene, amount: number) => {
  scene.shake = Math.max(scene.shake, amount);
};

type Effects = {
  [T in FightEvent["type"]]?: (scene: ArenaScene, ev: Extract<FightEvent, { type: T }>, world: World) => void
};
export const EFFECTS: Effects = {
  slam: (scene) => shake(scene, 0.35),
  hit(scene, ev, world) {
    shake(scene, ev.team === "player" ? 0.15 + ev.damage * 0.008 : 0.06);
    if (ev.weapon) strike(scene, world, ev.by, ev.target);
  },
  parry(scene, ev, world) {
    shake(scene, 0.2);
    clash(scene, world, ev.target, ev.by, PARRY_HIT_STOP_MS);
  },
  block(scene, ev, world) {
    shake(scene, ev.guardBreak ? 0.2 : 0.08);
    clash(scene, world, ev.by, ev.target, 0);
  },
  skill({ skills: { bursts } }, ev) {
    if (ev.form === "nova") bursts.nova(ev.elements, ev.at, ev.radiusM ?? 1);
    else if (ev.form === "self") bursts.self(ev.elements, ev.at);
    else if (ev.form === "imbue") bursts.imbue(ev.elements, ev.at);
  },
};

/** Longer than any replay after a resync goes back. */
const EFFECT_MEMORY_STEPS = 180;

/** The events whose effects haven't gone off yet, keyed by step and event: a replayed step reports its own again. */
export class FiredEffects {
  private readonly fired = new Map<string, number>();

  take(events: readonly StepEvent[]): StepEvent[] {
    const fresh = events.filter(({ step, event }) => {
      const key = `${step} ${JSON.stringify(event)}`;
      if (this.fired.has(key)) return false;
      this.fired.set(key, step);
      return true;
    });
    const latest = Math.max(...events.map((e) => e.step));
    for (const [key, step] of this.fired) if (step < latest - EFFECT_MEMORY_STEPS) this.fired.delete(key);
    return fresh;
  }
}

type Painted = { fight: Fight; held: Held | null } | null;

interface Peer {
  frames: PlayerFrames;
  look: PlayerLook<StandardMaterial>;
  painted: Painted;
}

type Drawn<K extends string> = Map<Entity, { kind: K; state: unknown }>;

function drawEntities<K extends string, Scene>(
  visuals: Record<K, AnyVisual<Scene>>, scene: Scene, world: World, drawn: Drawn<K>, kinds: Map<Entity, K>, dt: number,
): void {
  for (const [e, kind] of kinds) {
    let d = drawn.get(e);
    if (!d) drawn.set(e, d = { kind, state: visuals[kind].spawn(scene, world, e) });
    visuals[kind].frame(d.state, world, e, dt);
  }
  for (const [e, d] of drawn) {
    if (kinds.has(e)) continue;
    visuals[d.kind].dispose(d.state);
    drawn.delete(e);
  }
}

export interface DrawnState {
  look(): Look | null;
  battle: BattleContext;
  overworld: OverworldState;
}

export interface Drawing {
  show(mode: Mode | null): void;
  frame(dt: number): void;
}

export function createDrawing(canvas: HTMLCanvasElement, from: DrawnState): Drawing {
  const engine = new Engine(canvas, true);
  window.addEventListener("resize", () => engine.resize());
  const arena = createBattleScene(engine, from.battle);
  const overworld = createOverworldScene(engine, from.overworld);
  const stage = arenaStage(arena);
  const level = overworldStage(overworld);
  const frames = { chibi: overworld.materials.player, battle: arena.materials.player };
  const playerLook = new PlayerLook(frames, redrawSprite);
  const newPeer = (i: number): Peer => {
    const peerFrames = playerFrames(arena.scene, `peer${i}`);
    return { frames: peerFrames, look: new PlayerLook({ battle: peerFrames }, redrawSprite), painted: null };
  };
  // In order among the other players, kept between fights: making materials as a fight starts would slow it.
  const peers = [newPeer(0)];
  const fighters: Drawn<VisualKind> = new Map();
  const walkers: Drawn<OverworldActorData["kind"]> = new Map();
  let fired = new FiredEffects();
  let shown: Mode | null = null;
  let fresh = false;
  let worn: Look | null = null;
  let painted: Painted = null;
  let drawnFight: Fight | null = null;

  const heldBy = (world: World, e: Entity): Held | null => {
    const { hands } = world.require(e, Wielder);
    const item = weaponItemIn(hands), hand = item && heldIn(hands, item);
    return (item && hand && { hand, art: WEAPON_LOOKS[item].sprite }) || null;
  };
  const paintHeld = (look: Pick<PlayerLook<unknown>, "hold" | "finish">, was: Painted, fight: Fight, e: Entity) => {
    const held = heldBy(fight.world, e);
    if (fight === was?.fight && held?.hand === was.held?.hand && held?.art === was.held?.art) return was;
    look.hold(held);
    look.finish();
    return { fight, held } as Painted;
  };

  /** The chibi is painted at once, the arena's frames bit by bit, and all of them before a fight shows. */
  const paintPlayer = () => {
    const look = from.look();
    if (look && look !== worn) playerLook.wear(worn = look);
    const fight = from.battle.fight;
    const me = fight?.players.find((e) => fight.world.has(e, LocalPlayer));
    arena.peerFrames.clear();
    if (!fight || me === undefined) return;
    painted = paintHeld(playerLook, painted, fight, me);
    fight.players.filter((e) => e !== me).forEach((e, i) => {
      const who = from.battle.who[fight.players.indexOf(e)];
      if (!who) return;
      const peer = peers[i] ??= newPeer(i);
      peer.look.wear(who.character.look);
      peer.painted = paintHeld(peer.look, peer.painted, fight, e);
      arena.peerFrames.set(e, peer.frames);
    });
  };

  const drawArena = (dt: number) => {
    const fight = from.battle.fight;
    if (fight !== drawnFight) {
      for (const d of fighters.values()) VISUALS[d.kind].dispose(d.state);
      fighters.clear();
      arena.skills.clear();
      fired = new FiredEffects();
      if (fight) stage.newFight(fight);
      drawnFight = fight;
    }
    if (fight) {
      const { world } = fight, kinds = new Map<Entity, VisualKind>();
      for (const type of [Player, Enemy, SkillObject]) {
        for (const [e] of world.query(type)) {
          const kind = kindOf(world, e);
          if (kind) kinds.set(e, kind);
        }
      }
      for (const { event } of fired.take(from.battle.events)) {
        (EFFECTS[event.type] as ((scene: ArenaScene, ev: FightEvent, world: World) => void) | undefined)
          ?.(arena, event, world);
      }
      drawEntities(VISUALS, arena, world, fighters, kinds, dt);
      stage.frame(world, dt);
      arena.skills.tick(dt);
    }
    arena.scene.render();
  };

  const drawOverworld = (dt: number) => {
    const { world } = from.overworld, kinds = new Map<Entity, OverworldActorData["kind"]>();
    for (const [e, actor] of world.query(OverworldActor)) kinds.set(e, actor.kind);
    level(dt, fresh);
    drawEntities(WALKERS, overworld, world, walkers, kinds, dt);
    fresh = false;
    overworld.scene.render();
  };

  return {
    show(mode) {
      if (mode === "overworld" && shown !== "overworld") fresh = true;
      shown = mode;
    },
    frame(dt) {
      engine.beginFrame();
      paintPlayer();
      if (shown === "battle") drawArena(dt);
      else if (shown === "overworld") drawOverworld(dt);
      engine.endFrame();
    },
  };
}
