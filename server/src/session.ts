/**
 * One connected player. Single-player for now: each session owns its own ECS world (its own field
 * and boars). Everything that decides an outcome happens here; the client only sends inputs and
 * the claimed result of a fight.
 */
import { World, type ClientMsg, type Entity, type ServerMsg, type System, type Vec2 } from "@infinite-tower/shared";
import { isPlausibleWin } from "./battle/validate.js";
import { ARENA } from "./content/arena.js";
import { WILD_BOAR } from "./content/boar.js";
import { ENCOUNTERS, FIELD, FIELD_BOAR } from "./content/field.js";
import { FieldBoar, FieldPlayer, FieldPos } from "./field/components.js";
import { fieldBoarSystem, fieldPlayerSystem } from "./field/systems.js";

/** Send `state` every this many ticks (60 Hz / 3 = 20 Hz). */
const STATE_EVERY = 3;
const MAX_QUEUED_INPUTS = 30;

export class Session {
  private readonly world = new World();
  private readonly rng = Math.random;
  private readonly player: Entity;
  private readonly systems: System[];
  private mode: "field" | "battle" = "field";
  private encounterSource: Entity | null = null;
  private battleStartedAt = 0;
  private lastSeq = 0;
  private wins = 0;
  private boarRespawn = 0;
  private ticks = 0;

  constructor(private readonly send: (msg: ServerMsg) => void, private readonly dev: boolean) {
    this.player = this.world.spawn();
    this.world.add(this.player, FieldPos, { ...FIELD.spawn });
    this.world.add(this.player, FieldPlayer, { vx: 0, vz: 0, queue: [], credits: 0, ack: 0, grassDist: 0, safeTime: 0 });
    this.spawnBoar(FIELD_BOAR.start);
    const onEncounter = (source: Entity | null) => this.startEncounter(source);
    this.systems = [fieldPlayerSystem(this.rng, onEncounter), fieldBoarSystem(this.rng, onEncounter)];
    send({ t: "welcome", field: FIELD, arena: ARENA, me: this.pos(), wins: 0, dev });
  }

  tick(dt: number): void {
    if (this.mode !== "field") return;
    for (const s of this.systems) {
      s(this.world, dt);
      if (this.mode !== "field") break; // an encounter started
    }
    this.world.flush();
    this.respawn(dt);
    if (this.mode === "field" && ++this.ticks % STATE_EVERY === 0) this.sendState();
  }

  onMessage(raw: string): void {
    const msg = parse(raw);
    if (!msg) return;
    switch (msg.t) {
      case "input": {
        if (this.mode !== "field" || msg.seq <= this.lastSeq) return;
        this.lastSeq = msg.seq;
        const fp = this.world.require(this.player, FieldPlayer);
        if (fp.queue.length < MAX_QUEUED_INPUTS) fp.queue.push({ seq: msg.seq, moveX: msg.moveX, moveZ: msg.moveZ });
        return;
      }
      case "battleEnd":
        if (this.mode === "battle") this.endBattle(msg.won);
        return;
      case "debug":
        if (this.dev && msg.cmd === "encounter" && this.mode === "field") this.startEncounter(null);
        return;
    }
  }

  private startEncounter(source: Entity | null): void {
    this.mode = "battle";
    this.encounterSource = source;
    this.battleStartedAt = performance.now();
    this.world.require(this.player, FieldPlayer).queue.length = 0;
    this.send({ t: "encounter", source, enemy: WILD_BOAR, me: this.pos() });
  }

  private endBattle(claimedWin: boolean): void {
    const elapsed = (performance.now() - this.battleStartedAt) / 1000;
    const accepted = !claimedWin || isPlausibleWin(WILD_BOAR, elapsed);
    const won = claimedWin && accepted;
    const fp = this.world.require(this.player, FieldPlayer);
    const pos = this.world.require(this.player, FieldPos);
    if (won) {
      this.wins++;
      const src = this.encounterSource;
      if (src !== null && this.world.isAlive(src)) {
        this.world.destroy(src);
        this.world.flush();
        this.boarRespawn = FIELD_BOAR.respawn;
      }
    } else {
      pos.x = FIELD.spawn.x; // you wake up back at the start
      pos.z = FIELD.spawn.z;
    }
    fp.safeTime = ENCOUNTERS.safeTime;
    fp.grassDist = 0;
    fp.queue.length = 0;
    fp.credits = 0;
    this.mode = "field";
    this.encounterSource = null;
    this.send({ t: "battleResult", won, accepted, me: this.pos(), wins: this.wins });
  }

  /** Replace a defeated map boar after a while, on the far side from the player. */
  private respawn(dt: number): void {
    if (this.boarRespawn <= 0 || this.world.first(FieldBoar)) return;
    this.boarRespawn -= dt;
    if (this.boarRespawn > 0) return;
    const me = this.pos();
    const x = me.x > 0 ? -FIELD.halfWidth + 5 : FIELD.halfWidth - 5;
    this.spawnBoar({ x, z: (this.rng() - 0.5) * FIELD.halfDepth });
  }

  private spawnBoar(at: Vec2): void {
    const e = this.world.spawn();
    this.world.add(e, FieldPos, { ...at });
    this.world.add(e, FieldBoar, { state: "idle", t: 0, duration: 1, tx: at.x, tz: at.z, vx: 0, vz: 0, facing: -1 });
  }

  private pos(): Vec2 {
    const p = this.world.require(this.player, FieldPos);
    return { x: p.x, z: p.z };
  }

  private sendState(): void {
    const boars = [];
    for (const [id, b, p] of this.world.query(FieldBoar, FieldPos)) {
      boars.push({ id, x: p.x, z: p.z, vx: b.vx, vz: b.vz, facing: b.facing, alert: b.state === "notice" || b.state === "chase" });
    }
    const ack = this.world.require(this.player, FieldPlayer).ack;
    this.send({ t: "state", ack, me: this.pos(), boars, wins: this.wins });
  }
}

/** Never trust the wire: reject anything that isn't a well-formed ClientMsg. */
function parse(raw: string): ClientMsg | null {
  let m: unknown;
  try { m = JSON.parse(raw); } catch { return null; }
  if (typeof m !== "object" || m === null) return null;
  const o = m as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  switch (o.t) {
    case "input":
      if (!Number.isSafeInteger(o.seq) || !num(o.moveX) || !num(o.moveZ)) return null;
      return { t: "input", seq: o.seq as number, moveX: o.moveX as number, moveZ: o.moveZ as number }; // stepWalker clamps
    case "battleEnd":
      return typeof o.won === "boolean" ? { t: "battleEnd", won: o.won } : null;
    case "debug":
      return o.cmd === "encounter" ? { t: "debug", cmd: "encounter" } : null;
    default:
      return null;
  }
}
