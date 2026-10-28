/**
 * One connected player's game: what they have, and where they are (their overworld, or a battle). Its public methods
 * are what a player can ask for, one per message. Not to be confused with a login session (core/accounts).
 */
import {
  emptyCloth, gearBurden, itemAt, itemDef, moveGear, nearCampfire, PLAYER, spellProblems, takeOne, walkPace, type Bag,
  type Burden, type Character, type Gear, type GridSpot, type SavedSettings, type Spot, type StepInput, type Stats,
  type Vitals, type Word,
} from "@infinite-tower/shared";
import { isEnemyId } from "../content/enemies.js";
import { fullVitals, PLAYER_STATS } from "../content/player.js";
import { Overworld } from "../overworld/overworld.js";
import { getLevel, START_LEVEL } from "../levels/index.js";
import type { Account, PlayerLink, PlayerSave } from "../ports.js";
import { startBattle, type Battle } from "./battle.js";
import { stateMsg } from "./snapshot.js";

/** 20 a second. */
const STATE_EVERY_TICKS = 3;
/** Leeway on the campfire's reach (see `nearCampfire`). */
const REST_SLACK_TILES = 0.6;
/** Small changes (settings, the bag) are written at most this often, so a client can't hammer the database. */
const SAVE_SOON_MS = 1000;

export class GameSession {
  readonly overworld = new Overworld((source, enemy) => startBattle(this, source, enemy));
  battle: Battle | null = null;
  wins: number;
  vitals: Vitals;
  /** The same for everyone for now (content/player.ts); not saved. */
  readonly stats: Stats = { ...PLAYER_STATS };
  settings: SavedSettings;
  character: Character | null;
  private held: Gear;
  private readonly knownWords: Word[];
  private ticks = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly account: Account,
    readonly link: PlayerLink,
    private readonly dev: boolean,
    saved: PlayerSave,
    private readonly persist: (data: PlayerSave) => void,
  ) {
    this.vitals = saved.vitals;
    this.wins = saved.wins;
    this.settings = saved.settings;
    this.character = saved.character;
    this.held = { bag: saved.bag, cloth: emptyCloth(), equipment: saved.equipment };
    this.gear = this.held;
    this.knownWords = saved.knownWords;
  }

  /** Its weight sets how fast they walk the overworld. */
  get gear(): Gear { return this.held; }
  set gear(gear: Gear) {
    this.held = gear;
    this.overworld.playerData().pace = walkPace(this.burden);
  }

  get bag(): Bag { return this.held.bag; }
  set bag(bag: Bag) { this.gear = { ...this.held, bag }; }

  get burden(): Burden { return gearBurden(this.held, this.stats); }

  /** Sends `welcome`, then puts the player in the world, unless they have no character yet. */
  start(): void {
    this.link.send({
      t: "welcome", wins: this.wins, vitals: this.vitals, stats: this.stats, settings: this.settings,
      character: this.character, gear: this.gear, dev: this.dev,
    });
    if (this.character) this.enterLevel(START_LEVEL);
  }

  input(seq: number, moveX: number, moveZ: number): void {
    if (!this.inOverworld) return;
    if (moveX !== 0 || moveZ !== 0) this.closeBag();
    this.overworld.input(seq, moveX, moveZ);
  }

  battleInput(upTo: number, inputs: readonly StepInput[]): void {
    const battle = this.battle;
    if (!battle || battle.over) return;
    const known = new Set(this.knownWords);
    const allowed = inputs.map((input) =>
      input.cast && spellProblems(input.cast, known).length > 0 ? { ...input, cast: null } : input);
    battle.room.input(battle.seat, upTo, allowed);
  }

  battleResync(): void {
    const battle = this.battle;
    if (battle && !battle.over) battle.room.resync(battle.seat);
  }

  /** Ignored mid-fight. */
  leaveBattle(): void {
    if (this.battle?.over) this.battle = null;
  }

  /** Closed, lost, or taken over by another tab. Mid-fight, outcome.ts's LEAVING_LOSES says what that costs. */
  disconnect(): void {
    const battle = this.battle;
    if (battle && !battle.over) battle.room.leave(battle.seat);
    this.save();
  }

  /** Dev servers only: a battle right now against `enemy`. */
  debugEncounter(enemy = "wild-boar"): void {
    if (this.dev && this.inOverworld && isEnemyId(enemy)) startBattle(this, null, enemy);
  }

  /** Only once: a character is kept for good. */
  setCharacter(character: Character): void {
    if (this.character) return;
    this.character = character;
    this.save();
    this.link.send({ t: "character", character });
    if (!this.overworld.hasLevel) this.enterLevel(START_LEVEL);
  }

  /** Refills HP and stamina, if the server's copy of you is standing by a campfire. */
  rest(): void {
    if (!this.inOverworld) return;
    if (!nearCampfire(this.overworld.level.layout, this.overworld.playerPos(), REST_SLACK_TILES)) return;
    const full = fullVitals(this.stats);
    if (full.hp !== this.vitals.hp || full.stamina !== this.vitals.stamina) {
      this.vitals = full;
      this.save();
    }
    this.link.send({ t: "rested", vitals: this.vitals });
  }

  useItem(at: GridSpot): void {
    const grid = this.gear[at.in];
    const item = grid.items[itemAt(grid, at)]?.item;
    const healHp = item ? itemDef(item).healHp ?? 0 : 0;
    const left = takeOne(grid, at);
    if (!this.inOverworld || !item || !left || healHp <= 0 || this.vitals.hp >= PLAYER.maxHp) return;
    this.gear = { ...this.gear, [at.in]: left };
    this.vitals = { ...this.vitals, hp: Math.min(PLAYER.maxHp, this.vitals.hp + healHp) };
    this.save();
    this.link.send({ t: "itemUsed", item, vitals: this.vitals, gear: this.gear });
  }

  moveItem(from: Spot, to: Spot, turned: boolean): void {
    if (!this.inOverworld) return;
    const moved = moveGear(this.gear, from, to, turned);
    if (moved) {
      this.gear = moved;
      this.saveSoon();
    }
    this.link.send({ t: "gear", gear: this.gear });
  }

  closeBag(): void {
    if (this.gear.cloth.items.length === 0) return;
    this.gear = { ...this.gear, cloth: emptyCloth() };
    this.link.send({ t: "gear", gear: this.gear });
  }

  /** Now, cancelling a pending `saveSoon`. */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.persist({
      vitals: { ...this.vitals }, wins: this.wins, settings: this.settings, character: this.character,
      bag: this.bag, equipment: this.gear.equipment, knownWords: this.knownWords,
    });
  }

  setSettings(settings: SavedSettings): void {
    this.settings = settings;
    this.saveSoon();
  }

  /** Walking around a level: not in a battle, and not still making a character. */
  get inOverworld(): boolean { return this.battle === null && this.overworld.hasLevel; }

  /** One fixed step of the battle, if there's one (its room steps at FIXED_DT), or else the overworld. */
  tick(dt: number): void {
    if (this.battle) {
      this.battle.room.tick();
      return;
    }
    if (!this.inOverworld) return;
    this.overworld.step(dt);
    if (this.inOverworld && ++this.ticks % STATE_EVERY_TICKS === 0) this.link.send(stateMsg(this.overworld));
  }

  /** Within SAVE_SOON_MS, or on disconnect, whichever is first. */
  private saveSoon(): void {
    this.saveTimer ??= setTimeout(() => this.save(), SAVE_SOON_MS);
  }

  private enterLevel(id: string): void {
    const level = getLevel(id);
    this.overworld.enter(level);
    this.link.send({ t: "level", level: level.layout, me: this.overworld.playerPos() });
  }
}
