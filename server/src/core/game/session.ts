/**
 * One connected player's game. Starts from their save and holds what they have (vitals, wins, settings,
 * character, bag) and where they are: walking their field, or in a battle (battle.ts). Its public methods
 * are what a player can ask for (ws/handlers.ts calls them, one per message), and it answers through its
 * `PlayerLink`. Not to be confused with a login session (core/accounts).
 */
import {
  itemAt, itemDef, moveItem, nearCampfire, PLAYER, takeOne, type Bag, type Cell, type Character, type SavedSettings,
  type Stats, type Vitals,
} from "@infinite-tower/shared";
import { fullVitals, PLAYER_STATS } from "../content/player.js";
import { Field } from "../field/field.js";
import { getLevel, START_LEVEL } from "../levels/index.js";
import type { Account, PlayerLink, PlayerSave } from "../ports.js";
import { settleBattle, startBattle, type Battle } from "./battle.js";
import { stateMsg } from "./snapshot.js";

/** Send `state` every this many ticks (60 Hz / 3 = 20 Hz). */
const STATE_EVERY_TICKS = 3;
/** Leeway on the campfire's reach (see `nearCampfire`). */
const REST_SLACK_TILES = 0.6;
/**
 * Small changes (settings, moving things around the bag) are written at most this often, so a client sending them
 * in a loop can't hammer the database.
 */
const SAVE_SOON_MS = 1000;

export class GameSession {
  readonly field = new Field((source, enemy) => startBattle(this, source, enemy));
  /** null while in the field; set during a battle. */
  battle: Battle | null = null;
  wins: number;
  vitals: Vitals;
  /** The same for everyone for now (content/player.ts); not saved. */
  readonly stats: Stats = { ...PLAYER_STATS };
  settings: SavedSettings;
  character: Character | null;
  bag: Bag;
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
    this.bag = saved.bag;
  }

  /** Sends `welcome`, then puts the player in the world, unless there's no character yet: that waits for one. */
  start(): void {
    this.link.send({
      t: "welcome", wins: this.wins, vitals: this.vitals, stats: this.stats, settings: this.settings,
      character: this.character, bag: this.bag, dev: this.dev,
    });
    if (this.character) this.enterLevel(START_LEVEL);
  }

  /** A walking input (the client sends one per tick while moving). */
  input(seq: number, moveX: number, moveZ: number): void {
    if (this.inField) this.field.input(seq, moveX, moveZ);
  }

  /** The client left a decided fight; battle.ts checks what it claims. */
  endBattle(claimedWin: boolean, vitals: Vitals): void {
    settleBattle(this, claimedWin, vitals);
  }

  /** Dev servers only: a battle right now, without finding one. */
  debugEncounter(): void {
    if (this.dev && this.inField) startBattle(this, null, "wild-boar");
  }

  /** Makes the player's character. Only once: a character is kept for good, so with one already this does nothing. */
  setCharacter(character: Character): void {
    if (this.character) return;
    this.character = character;
    this.save();
    this.link.send({ t: "character", character });
    if (!this.field.hasLevel) this.enterLevel(START_LEVEL);
  }

  /** Rest at a campfire, if the server's copy of you is standing by one: HP and stamina refill. */
  rest(): void {
    if (!this.inField || !nearCampfire(this.field.level.layout, this.field.playerPos(), REST_SLACK_TILES)) return;
    const full = fullVitals(this.stats);
    if (full.hp !== this.vitals.hp || full.stamina !== this.vitals.stamina) {
      this.vitals = full;
      this.save();
    }
    this.link.send({ t: "rested", vitals: this.vitals });
  }

  /** Use one of the item in bag cell `at`, if it does something now (meat when already at full HP doesn't). */
  useItem(at: Cell): void {
    const item = this.bag.items[itemAt(this.bag, at)]?.item;
    const healHp = item ? itemDef(item).healHp ?? 0 : 0;
    const left = takeOne(this.bag, at);
    if (!this.inField || !item || !left || healHp <= 0 || this.vitals.hp >= PLAYER.maxHp) return;
    this.bag = left;
    this.vitals = { ...this.vitals, hp: Math.min(PLAYER.maxHp, this.vitals.hp + healHp) };
    this.save();
    this.link.send({ t: "itemUsed", item, vitals: this.vitals, bag: this.bag });
  }

  /** Move what's in bag cell `from` to `to` (shared `moveItem`), on the field. The bag goes back either way. */
  moveItem(from: Cell, to: Cell, turned: boolean): void {
    if (!this.inField) return;
    const moved = moveItem(this.bag, from, to, turned);
    if (moved) {
      this.bag = moved;
      this.saveSoon();
    }
    this.link.send({ t: "bag", bag: this.bag });
  }

  /** Writes the save now (and cancels a pending `saveSoon`). */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.persist({
      vitals: { ...this.vitals }, wins: this.wins, settings: this.settings, character: this.character,
      bag: this.bag,
    });
  }

  /** The client changed a setting. */
  setSettings(settings: SavedSettings): void {
    this.settings = settings;
    this.saveSoon();
  }

  /** Walking around a level: not in a battle, and not still making a character. */
  get inField(): boolean { return this.battle === null && this.field.hasLevel; }

  tick(dt: number): void {
    if (!this.inField) return;
    this.field.step(dt);
    if (this.inField && ++this.ticks % STATE_EVERY_TICKS === 0) this.link.send(stateMsg(this.field));
  }

  /** Saved within SAVE_SOON_MS, or on disconnect, whichever is first. */
  private saveSoon(): void {
    this.saveTimer ??= setTimeout(() => this.save(), SAVE_SOON_MS);
  }

  /** Load a level and tell the client. */
  private enterLevel(id: string): void {
    const level = getLevel(id);
    this.field.enter(level);
    this.link.send({ t: "level", level: level.layout, me: this.field.playerPos() });
  }
}
