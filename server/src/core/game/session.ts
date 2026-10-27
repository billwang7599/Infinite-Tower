/**
 * One connected player's game. Starts from their save and holds what they have (vitals, wins, settings,
 * character, bag) and where they are: walking their overworld, or in a battle (battle.ts), whose fight it ticks.
 * Its public methods are what a player can ask for (ws/handlers.ts calls them, one per message), and it answers
 * through its `PlayerLink`. Not to be confused with a login session (core/accounts).
 */
import {
  bagBurden, itemAt, itemDef, moveItem, nearCampfire, PLAYER, takeOne, walkPace, type Bag, type Burden, type Cell,
  type Character, type SavedSettings, type StepInput, type Stats, type Vitals,
} from "@infinite-tower/shared";
import { fullVitals, PLAYER_STATS } from "../content/player.js";
import { Overworld } from "../overworld/overworld.js";
import { getLevel, START_LEVEL } from "../levels/index.js";
import type { Account, PlayerLink, PlayerSave } from "../ports.js";
import { leaveArena, startBattle, type Battle } from "./battle.js";
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
  readonly overworld = new Overworld((source, enemy) => startBattle(this, source, enemy));
  /** null while in the overworld; set during a battle. */
  battle: Battle | null = null;
  wins: number;
  vitals: Vitals;
  /** The same for everyone for now (content/player.ts); not saved. */
  readonly stats: Stats = { ...PLAYER_STATS };
  settings: SavedSettings;
  character: Character | null;
  private carried: Bag;
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
    this.carried = saved.bag;
    this.bag = saved.bag;
  }

  /** What the player carries. Its weight sets how fast they walk the overworld (`walkPace`). */
  get bag(): Bag { return this.carried; }
  set bag(bag: Bag) {
    this.carried = bag;
    this.overworld.playerData().pace = walkPace(this.burden);
  }

  /** How weighed down the bag leaves the player. */
  get burden(): Burden { return bagBurden(this.carried, this.stats); }

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
    if (this.inOverworld) this.overworld.input(seq, moveX, moveZ);
  }

  /**
   * What the player did in their fight: each change of input with its step, and how far their own copy has run. The
   * server runs the fight: nothing else can end it.
   */
  battleInput(upTo: number, inputs: readonly StepInput[]): void {
    const battle = this.battle;
    if (battle && !battle.over) battle.room.input(battle.seat, upTo, inputs);
  }

  /** The player's copy of their fight differs from the server's hash: send them the whole fight. */
  battleResync(): void {
    const battle = this.battle;
    if (battle && !battle.over) battle.room.resync(battle.seat);
  }

  /** The Leave key after a fight's result: back to the overworld (ignored mid-fight). */
  leaveBattle(): void {
    leaveArena(this);
  }

  /**
   * The player's connection is gone (closed, lost, or taken over by another tab). Mid-fight, they're out of it, and
   * the fight's rules say what that costs (outcome.ts: LEAVING_LOSES). Then everything is saved.
   */
  disconnect(): void {
    const battle = this.battle;
    if (battle && !battle.over) battle.room.leave(battle.seat);
    this.save();
  }

  /** Dev servers only: a battle right now, without finding one. */
  debugEncounter(): void {
    if (this.dev && this.inOverworld) startBattle(this, null, "wild-boar");
  }

  /** Makes the player's character. Only once: a character is kept for good, so with one already this does nothing. */
  setCharacter(character: Character): void {
    if (this.character) return;
    this.character = character;
    this.save();
    this.link.send({ t: "character", character });
    if (!this.overworld.hasLevel) this.enterLevel(START_LEVEL);
  }

  /** Rest at a campfire, if the server's copy of you is standing by one: HP and stamina refill. */
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

  /** Use one of the item in bag cell `at`, if it does something now (meat when already at full HP doesn't). */
  useItem(at: Cell): void {
    const item = this.bag.items[itemAt(this.bag, at)]?.item;
    const healHp = item ? itemDef(item).healHp ?? 0 : 0;
    const left = takeOne(this.bag, at);
    if (!this.inOverworld || !item || !left || healHp <= 0 || this.vitals.hp >= PLAYER.maxHp) return;
    this.bag = left;
    this.vitals = { ...this.vitals, hp: Math.min(PLAYER.maxHp, this.vitals.hp + healHp) };
    this.save();
    this.link.send({ t: "itemUsed", item, vitals: this.vitals, bag: this.bag });
  }

  /** Move what's in bag cell `from` to `to` (shared `moveItem`), on the overworld. The bag goes back either way. */
  moveItem(from: Cell, to: Cell, turned: boolean): void {
    if (!this.inOverworld) return;
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
  get inOverworld(): boolean { return this.battle === null && this.overworld.hasLevel; }

  /** One fixed step: of the battle, if there's one (its room steps at FIXED_DT), or else the overworld. */
  tick(dt: number): void {
    if (this.battle) {
      this.battle.room.tick();
      return;
    }
    if (!this.inOverworld) return;
    this.overworld.step(dt);
    if (this.inOverworld && ++this.ticks % STATE_EVERY_TICKS === 0) this.link.send(stateMsg(this.overworld));
  }

  /** Saved within SAVE_SOON_MS, or on disconnect, whichever is first. */
  private saveSoon(): void {
    this.saveTimer ??= setTimeout(() => this.save(), SAVE_SOON_MS);
  }

  /** Load a level and tell the client. */
  private enterLevel(id: string): void {
    const level = getLevel(id);
    this.overworld.enter(level);
    this.link.send({ t: "level", level: level.layout, me: this.overworld.playerPos() });
  }
}
