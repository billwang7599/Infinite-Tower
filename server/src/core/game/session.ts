/**
 * One connected player's game. Starts from their save and holds what they have (vitals, wins, settings,
 * character, inventory) and where they are: walking their field, or in a battle (battle.ts). Its public methods
 * are what a player can ask for (ws/handlers.ts calls them, one per message), and it answers through its
 * `PlayerLink`. Not to be confused with a login session (core/accounts).
 */
import {
  itemDef, nearCampfire, PLAYER, type Character, type Inventory, type ItemId, type SavedSettings, type Stats,
  type Vitals,
} from "@infinite-tower/shared";
import { fullVitals, PLAYER_STATS } from "../content/player.js";
import { Field } from "../field/field.js";
import { getLevel, START_LEVEL } from "../levels/index.js";
import type { Account, PlayerLink, PlayerSave } from "../ports.js";
import { settleBattle, startBattle, type Battle } from "./battle.js";
import { removeOne } from "./inventory.js";
import { stateMsg } from "./snapshot.js";

/** Send `state` every this many ticks (60 Hz / 3 = 20 Hz). */
const STATE_EVERY_TICKS = 3;
/** Leeway on the campfire's reach (see `nearCampfire`). */
const REST_SLACK_TILES = 0.6;
/** Settings changes are written at most this often (a client sending them in a loop can't hammer the database). */
const SETTINGS_SAVE_MS = 1000;

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
  inventory: Inventory;
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
    this.inventory = saved.inventory;
  }

  /** Sends `welcome`, then puts the player in the world, unless there's no character yet: that waits for one. */
  start(): void {
    this.link.send({
      t: "welcome", wins: this.wins, vitals: this.vitals, stats: this.stats, settings: this.settings,
      character: this.character, inventory: this.inventory, dev: this.dev,
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

  setCharacter(character: Character): void {
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

  /** Use one `item`, if the player has one and it does something now (meat when already at full HP doesn't). */
  useItem(item: ItemId): void {
    const healHp = itemDef(item).healHp ?? 0;
    if (!this.inField || (this.inventory[item] ?? 0) <= 0 || healHp <= 0 || this.vitals.hp >= PLAYER.maxHp) return;
    this.inventory = removeOne(this.inventory, item);
    this.vitals = { ...this.vitals, hp: Math.min(PLAYER.maxHp, this.vitals.hp + healHp) };
    this.save();
    this.link.send({ t: "itemUsed", item, vitals: this.vitals, inventory: this.inventory });
  }

  /** Writes the save now (and cancels a pending settings save). */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.persist({
      vitals: { ...this.vitals }, wins: this.wins, settings: this.settings, character: this.character,
      inventory: this.inventory,
    });
  }

  /** The client changed a setting: saved within a second, or on disconnect, whichever is first. */
  setSettings(settings: SavedSettings): void {
    this.settings = settings;
    this.saveTimer ??= setTimeout(() => this.save(), SETTINGS_SAVE_MS);
  }

  /** Walking around a level: not in a battle, and not still making a character. */
  get inField(): boolean { return this.battle === null && this.field.hasLevel; }

  tick(dt: number): void {
    if (!this.inField) return;
    this.field.step(dt);
    if (this.inField && ++this.ticks % STATE_EVERY_TICKS === 0) this.link.send(stateMsg(this.field, this.wins));
  }

  /** Load a level and tell the client. */
  private enterLevel(id: string): void {
    const level = getLevel(id);
    this.field.enter(level);
    this.link.send({ t: "level", level: level.layout, me: this.field.playerPos() });
  }
}
