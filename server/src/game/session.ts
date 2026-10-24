/**
 * One connected player. Single-player for now: each session owns its own ECS world (its own level
 * and actors). Starts from the player's save (store/) and holds which level/mode they're in; the field
 * systems do the simulating, encounter.ts the fights, handlers.ts the incoming messages.
 */
import { World, type Entity, type SavedSettings, type Stats, type System, type Vec2, type Vitals } from "@infinite-tower/shared";
import { PLAYER_STATS } from "../content/player.js";
import { chaseSystem } from "../field/behaviors/chase.js";
import { moveSystem } from "../field/behaviors/move.js";
import { touchSystem } from "../field/behaviors/touch.js";
import { wanderSystem } from "../field/behaviors/wander.js";
import { FieldPlayer, FieldPos } from "../field/components.js";
import type { FieldContext } from "../field/context.js";
import { fieldPlayerSystem } from "../field/player.js";
import { Spawner } from "../field/spawner.js";
import { getLevel } from "../levels/index.js";
import type { LevelDef } from "../levels/level.js";
import type { Connection } from "../net/connection.js";
import type { PlayerSave } from "../store/player-store.js";
import { startEncounter, type Encounter } from "./encounter.js";
import { stateMsg } from "./snapshot.js";

/** Send `state` every this many ticks (60 Hz / 3 = 20 Hz). */
const STATE_EVERY = 3;
/** Settings changes are written at most this often (a client sending them in a loop can't hammer the database). */
const SETTINGS_SAVE_MS = 1000;

export class Session {
  readonly world = new World();
  readonly player: Entity;
  /** null while in the field; set during a fight. */
  encounter: Encounter | null = null;
  wins: number;
  vitals: Vitals;
  /** The same for everyone for now (content/player.ts); not saved. */
  readonly stats: Stats = { ...PLAYER_STATS };
  settings: SavedSettings;
  /** Highest input seq accepted (older or repeated ones are ignored). */
  lastSeq = 0;
  private level!: LevelDef;
  private spawner: Spawner | null = null;
  private readonly systems: System[];
  private readonly ctx: FieldContext;
  private ticks = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly conn: Connection,
    readonly dev: boolean,
    saved: PlayerSave,
    private readonly persist: (data: PlayerSave) => void,
  ) {
    this.vitals = saved.vitals;
    this.wins = saved.wins;
    this.settings = saved.settings;
    const session = this;
    this.ctx = {
      get level() { return session.level; },
      rng: Math.random,
      encounter: (source, enemy) => startEncounter(this, source, enemy),
    };
    this.systems = [
      fieldPlayerSystem(this.ctx), chaseSystem(), wanderSystem(this.ctx), moveSystem(this.ctx), touchSystem(this.ctx),
      (world, dt) => this.spawner?.system(world, dt),
    ];
    this.player = this.world.spawn();
    this.world.add(this.player, FieldPos, { x: 0, z: 0 });
    this.world.add(this.player, FieldPlayer, { vx: 0, vz: 0, queue: [], credits: 0, ack: 0, grassDist: 0, safeTime: 0 });
    conn.send({ t: "welcome", wins: this.wins, vitals: this.vitals, stats: this.stats, settings: this.settings, dev });
  }

  /** Called after every fight and on disconnect. */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.persist({ vitals: { ...this.vitals }, wins: this.wins, settings: this.settings });
  }

  /** The client changed a setting: saved within a second, or on disconnect, whichever is first. */
  setSettings(settings: SavedSettings): void {
    this.settings = settings;
    this.saveTimer ??= setTimeout(() => this.save(), SETTINGS_SAVE_MS);
  }

  get currentLevel(): LevelDef { return this.level; }
  get inField(): boolean { return this.encounter === null; }

  /** Load a level: clear the old one's actors, place the player, spawn the new actors, tell the client. */
  enterLevel(id: string, at?: Vec2): void {
    this.spawner?.clear();
    this.level = getLevel(id);
    this.placePlayer(at ?? this.level.spawn);
    this.spawner = new Spawner(this.world, this.ctx);
    this.conn.send({ t: "level", level: this.level.layout, me: this.playerPos() });
  }

  tick(dt: number): void {
    if (!this.inField) return;
    for (const s of this.systems) {
      s(this.world, dt);
      if (!this.inField) break; // an encounter started
    }
    this.world.flush();
    if (this.inField && ++this.ticks % STATE_EVERY === 0) this.conn.send(stateMsg(this));
  }

  /** Reset walking state: after a fight or teleport, no stale inputs or encounter progress. */
  resetWalk(safeTime: number): void {
    const fp = this.world.require(this.player, FieldPlayer);
    fp.queue.length = 0;
    fp.credits = 0;
    fp.grassDist = 0;
    fp.safeTime = safeTime;
  }

  placePlayer(at: Vec2): void {
    const pos = this.world.require(this.player, FieldPos);
    pos.x = at.x;
    pos.z = at.z;
  }

  playerPos(): Vec2 {
    const p = this.world.require(this.player, FieldPos);
    return { x: p.x, z: p.z };
  }
}
