/**
 * One connected player's game: what they have, and where they are (their overworld, or a battle). Its public methods
 * are what a player can ask for, one per message. Not to be confused with a login session (core/accounts).
 */
import {
  addFaith, blessingsOf, CLOSE_CODES, coreStats, distXZ, emptyCloth, finishUse, FIXED_DT, gearBurden, grownVitals,
  Health, heldIn, hpRegenPerSec, JOIN_RANGE_TILES, maxHpOf, moveGear, nearCampfire, NO_PILE, overworldPace,
  placePoint, roundTo, skillOf, Stamina, staminaMaxOf, startUse, stepUse, takeBackPoint, validateSkill, type Bag,
  type Burden, type Character, type Cheat, type CoinId, type CoreState, type Entity, type Faith, type Gear, type God,
  type InscriptionId, type ItemId, type SavedSettings, type ShownStat, type Skill, type Skillbook, type Spot,
  type StepInput, type Stats, type UseSpot, type Using, type Vec2, type Vitals, type Word,
} from "@infinite-tower/shared";
import { takeCore } from "@infinite-tower/shared/fight";
import { fullVitals, newPlayer } from "../content/player.js";
import type { ShopId } from "../content/shops.js";
import type { Overworld } from "../overworld/overworld.js";
import { getRegion, wakeRegion } from "../world/index.js";
import { regionOf } from "../world/world.js";
import type { Account, PlayerLink, PlayerSave } from "../ports.js";
import { arenaPileInView, arenaPiles, joinBattle, startBattle, type Battle } from "./battle.js";
import type { Chat } from "./chat.js";
import { runCheat } from "./cheats.js";
import type { Duels } from "./duels.js";
import { carveSigil, removeInscription } from "./carving.js";
import { buy, exchange, openShop, sell } from "./shop.js";
import { stateMsg } from "./snapshot.js";
import { progressStory, questbookOf, type Story } from "./story.js";
import { handOver, placeFor, takeQuest, talkTo, trainingInView, type Placed } from "./talk.js";
import { startTraining } from "./training.js";
import type { Uniques } from "./uniques.js";

/** 20 a second. */
const STATE_EVERY_TICKS = 3;
/** Leeway on a reach the server checks (a campfire's, a battle's): its copy of you trails the client's. */
export const LAG_SLACK_TILES = 0.6;
/** Small changes (settings, the bag) are written at most this often, so a client can't hammer the database. */
const SAVE_SOON_MS = 1000;

interface Walking { overworld: Overworld; me: Entity }

export interface Others {
  online(): Iterable<GameSession>;
  duels: Duels;
  chat: Chat;
  uniques: Uniques;
}

export function nearestOtherSession(
  from: GameSession, sessions: Iterable<GameSession>, rangeTiles: number, wanted: (s: GameSession) => boolean,
): GameSession | null {
  const at = from.overworld.playerPos(from.me);
  let best: { session: GameSession; dist: number } | null = null;
  for (const session of sessions) {
    if (session === from || !session.inWorld || session.overworld !== from.overworld || !wanted(session)) continue;
    const dist = distXZ(at, session.overworld.playerPos(session.me));
    if (dist <= rangeTiles && (!best || dist < best.dist)) best = { session, dist };
  }
  return best?.session ?? null;
}

export class GameSession {
  battle: Battle | null = null;
  wins: number;
  vitals: Vitals;
  settings: SavedSettings;
  character: Character | null;
  skillbook: Skillbook;
  /** Kept on death, like the words they know. */
  story: Story;
  placed: Placed = { npcs: [], traces: [] };
  shop: ShopId | null = null;
  shopsBought: ShopId[];
  faith: Faith;
  /** A dev cheat for this connection: not saved. */
  invulnerable = false;
  private held: Gear;
  private soul: CoreState;
  private readonly knownWords: Word[];
  private ticks = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private walking: Walking | null = null;
  private readonly introduced = new Set<Entity>();
  private pileOpen: Entity | null = null;
  private using: Using | null = null;
  private offWorldPad: string;
  /** The region they were last in: walking into another places the NPCs again. */
  private regionId: string | null = null;
  private wasReset = false;

  constructor(
    readonly account: Account,
    readonly link: PlayerLink,
    private readonly dev: boolean,
    saved: PlayerSave,
    private readonly persist: (data: PlayerSave) => void,
    private readonly overworldOf: () => Overworld,
    private readonly others: Others,
  ) {
    this.vitals = saved.vitals;
    this.wins = saved.wins;
    this.settings = saved.settings;
    this.character = saved.character;
    this.held = { bag: saved.bag, cloth: emptyCloth(), pile: NO_PILE, equipment: saved.equipment };
    this.gear = this.held;
    this.knownWords = saved.knownWords;
    this.skillbook = saved.skillbook;
    this.story = saved.story;
    this.shopsBought = saved.shopsBought;
    this.faith = saved.faith;
    this.offWorldPad = wakeRegion(saved.pad);
    this.soul = saved.core;
  }

  /** Its weight sets how fast they walk the overworld. */
  get gear(): Gear { return this.held; }
  set gear(gear: Gear) {
    this.held = gear;
    this.updatePace();
  }

  get core(): CoreState { return this.soul; }
  set core(core: CoreState) {
    this.soul = core;
    this.updatePace();
  }

  get stats(): Stats { return coreStats(this.soul); }

  get uniques(): Uniques { return this.others.uniques; }

  get bag(): Bag { return this.held.bag; }
  set bag(bag: Bag) { this.gear = { ...this.held, bag }; }

  get burden(): Burden { return gearBurden(this.held, this.stats); }

  /** Sends `welcome`, then puts the player in the world, unless they have no character yet. */
  start(): void {
    this.link.send({
      t: "welcome", wins: this.wins, vitals: this.vitals, core: this.core, settings: this.settings,
      character: this.character, gear: this.gear, knownWords: this.knownWords, skillbook: this.skillbook,
      chat: this.others.chat.recent(), questbook: questbookOf(this.story), dev: this.dev, faith: this.faith,
    });
    if (this.character) this.enterWorld();
  }

  input(seq: number, moveX: number, moveZ: number): void {
    if (!this.inOverworld) return;
    if (moveX !== 0 || moveZ !== 0) this.closeBag();
    this.overworld.input(this.me, seq, moveX, moveZ);
  }

  battleInput(upTo: number, inputs: readonly StepInput[]): void {
    const battle = this.arena;
    if (!battle) return;
    const known = new Set(this.knownWords);
    const unknown = (skill: Skill | undefined) => skill !== undefined && validateSkill(skill, known).length > 0;
    const unchantable = (words: readonly Word[]) => {
      const chanted = skillOf(words);
      return words.length > 0 && (chanted === null || unknown(chanted));
    };
    const allowed = inputs.map((input) => ({
      ...input,
      cast: unknown(input.cast ?? undefined) ? null : input.cast,
      chantWords: input.chantWords && unchantable(input.chantWords) ? null : input.chantWords,
      write: unknown(input.write?.skill) ? null : input.write,
    }));
    battle.room.input(battle.seat, upTo, allowed);
  }

  battleResync(): void {
    const battle = this.arena;
    if (battle) battle.room.resync(battle.seat);
  }

  /** Ignored mid-fight. */
  leaveBattle(): void {
    const battle = this.battle;
    if (!battle?.over) return;
    battle.room.leave(battle.seat);
    this.closeBag();
    this.battle = null;
    this.overworld.endFight(this.me, this.overworld.map.safeTime);
  }

  get pad(): string {
    return this.walking ? this.overworld.playerData(this.me).pad : this.offWorldPad;
  }

  get region(): string {
    return regionOf(this.overworld.map, this.overworld.playerPos(this.me)).id;
  }

  wakeOnPad(): Vec2 {
    const { spawn } = getRegion(this.pad);
    this.overworld.place(this.me, spawn);
    return spawn;
  }

  /** Closed, lost, or taken over by another tab. Mid-fight, outcome.ts's LEAVING_LOSES says what that costs. */
  disconnect(): void {
    const battle = this.battle;
    if (battle) battle.room.leave(battle.seat);
    this.offWorldPad = this.pad;
    this.walking?.overworld.leave(this.walking.me);
    this.walking = null;
    this.save();
  }

  challenge(): void {
    this.others.duels.challenge(this);
  }

  answerChallenge(accept: boolean): void {
    this.others.duels.answer(this, accept);
  }

  chat(text: string): void {
    this.others.chat.say(this, text);
  }

  joinBattle(): void {
    if (!this.inOverworld) return;
    const reach = JOIN_RANGE_TILES + LAG_SLACK_TILES;
    const host = nearestOtherSession(this, this.others.online(), reach, (s) => s.liveBattle !== null);
    if (host) joinBattle(this, host);
    else this.link.send({ t: "joinRefused", reason: "nobodyNear" });
  }

  cheat(cheat: Cheat): void {
    if (this.dev) runCheat(this, cheat);
  }

  /** Only once: a character is kept for good. */
  setCharacter(character: Character): void {
    if (this.character) return;
    this.character = character;
    this.save();
    this.link.send({ t: "character", character });
    if (!this.walking) this.enterWorld();
  }

  /** Refills HP and stamina, if the server's copy of you is standing by a campfire. */
  rest(): void {
    if (!this.inOverworld) return;
    if (!nearCampfire(this.overworld.map.layout, this.overworld.playerPos(this.me), LAG_SLACK_TILES)) return;
    const full = fullVitals(this.stats);
    if (full.hp !== this.vitals.hp || full.stamina !== this.vitals.stamina) {
      this.vitals = full;
      this.save();
    }
    this.link.send({ t: "rested", vitals: this.vitals });
  }

  bindPad(): void {
    if (!this.inOverworld) return;
    const pad = this.overworld.padInView(this.me);
    if (pad === null) return;
    const walk = this.overworld.playerData(this.me), already = walk.pad === pad;
    walk.pad = pad;
    if (!already) this.save();
    this.link.send({ t: "padBound", already });
  }

  useItem(at: UseSpot): void {
    if ((!this.inOverworld && !this.afterFight) || this.using) return;
    this.using = startUse(this.gear[at.in], at, this.useTarget());
    if (this.using) this.link.send({ t: "using", at });
  }

  get busyUsing(): boolean { return this.using !== null; }

  openShop(): void {
    openShop(this);
  }

  buy(item: ItemId): void {
    buy(this, item);
  }

  sell(at: UseSpot, count: number): void {
    sell(this, at, count);
  }

  exchange(from: CoinId, to: CoinId): void {
    exchange(this, from, to);
  }

  carve(at: UseSpot): void {
    carveSigil(this, at);
  }

  uncarve(inscription: InscriptionId): void {
    removeInscription(this, inscription);
  }

  /**
   * Taking from the pile they have open is first come first served: the overworld's copy is the one taken from. In
   * the arena after a win there's no cloth.
   */
  moveItem(from: Spot, to: Spot, turned: boolean): void {
    const inArena = this.afterFight !== null;
    if (!this.inOverworld && !inArena) return;
    this.followPile();
    const onCloth = from.in === "cloth" || to.in === "cloth";
    const refused = this.using || (inArena && onCloth);
    const moved = refused ? null : moveGear(this.gear, from, to, turned, this.stats.strength);
    if (moved) {
      this.gear = moved;
      if (from.in === "pile" && this.pileOpen !== null) this.overworld.setPileItems(this.pileOpen, moved.pile);
      this.followPile();
      this.saveSoon();
    }
    this.link.send({ t: "gear", gear: this.gear });
  }

  openPile(): void {
    const arena = this.afterFight;
    if (arena) this.pileOpen = arenaPileInView(arena, this.overworld);
    else if (this.inOverworld) this.pileOpen = this.overworld.pileInView(this.me);
    else return;
    this.followPile();
    this.link.send({ t: "gear", gear: this.gear });
  }

  talk(): void {
    talkTo(this);
  }

  train(): void {
    const foe = trainingInView(this);
    if (foe) startTraining(this, foe);
  }

  acceptQuest(quest: string): void {
    takeQuest(this, quest);
  }

  deliver(quest: string): void {
    handOver(this, quest);
  }

  closeBag(): void {
    if (this.using) {
      this.using = null;
      this.link.send({ t: "using", at: null });
    }
    if (this.shop) {
      this.shop = null;
      this.link.send({ t: "shop", shop: null });
    }
    if (this.gear.cloth.items.length === 0 && this.pileOpen === null) return;
    this.pileOpen = null;
    this.gear = { ...this.gear, cloth: emptyCloth(), pile: NO_PILE };
    this.link.send({ t: "gear", gear: this.gear });
  }

  statPoint(stat: ShownStat, add: boolean): void {
    if (!this.inOverworld) return;
    const byFire = nearCampfire(this.overworld.map.layout, this.overworld.playerPos(this.me), LAG_SLACK_TILES);
    const core = add ? placePoint(this.core, stat) : byFire ? takeBackPoint(this.core, stat) : null;
    if (core) {
      this.takeCore(core);
      this.saveSoon();
    } else this.link.send({ t: "core", core: this.core, vitals: this.vitals, brokeThrough: false });
  }

  takeCore(core: CoreState, brokeThrough = false): void {
    const before = this.stats;
    this.core = core;
    this.vitals = grownVitals(this.vitals, before, this.stats);
    this.link.send({ t: "core", core, vitals: this.vitals, brokeThrough });
  }

  gainFaith(gained: Faith): void {
    const before = blessingsOf(this.faith);
    for (const [god, amount] of Object.entries(gained) as [God, number][]) {
      this.faith = addFaith(this.faith, god, amount);
    }
    const blessed = blessingsOf(this.faith).filter((god) => !before.includes(god));
    this.saveSoon();
    this.link.send({ t: "faith", faith: this.faith, gained, blessed });
  }

  saveSkill(page: number, skill: Skill): void {
    const known = new Set(this.knownWords);
    const writable = heldIn(this.gear.equipment, "skillbook") !== null && validateSkill(skill, known).length === 0;
    if (!this.liveBattle && writable) {
      this.skillbook = this.skillbook.map((written, i) => i === page ? skill : written);
      this.saveSoon();
    }
    this.link.send({ t: "skillbook", skillbook: this.skillbook });
  }

  /** Now, cancelling a pending `saveSoon`. */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.wasReset) return;
    this.persist({
      vitals: { ...this.vitals }, wins: this.wins, settings: this.settings, character: this.character,
      bag: this.bag, equipment: this.gear.equipment, knownWords: this.knownWords, skillbook: this.skillbook,
      story: this.story, pad: this.pad, core: this.core, shopsBought: this.shopsBought, faith: this.faith,
    });
  }

  resetSave(): void {
    this.persist({ ...newPlayer(), character: this.character, settings: this.settings });
    this.wasReset = true;
    this.link.close(CLOSE_CODES.saveReset, "save reset");
  }

  setSettings(settings: SavedSettings): void {
    this.settings = settings;
    this.saveSoon();
  }

  get inOverworld(): boolean { return this.battle === null && this.walking !== null; }

  get liveBattle(): Battle | null { return this.battle && !this.battle.over ? this.battle : null; }

  /** In a battle's arena: fighting, or after a win with its drops. */
  get arena(): Battle | null { return this.battle?.room.inArena(this.battle.seat) ? this.battle : null; }

  get afterFight(): Battle | null { return this.battle?.over ? this.arena : null; }

  get name(): string { return this.character?.name ?? this.account.username; }

  get inWorld(): boolean { return this.walking !== null; }

  /** Throws while they're still making a character. */
  get overworld(): Overworld { return this.walk.overworld; }

  get me(): Entity { return this.walk.me; }

  private get walk(): Walking {
    if (!this.walking) throw new Error("not in the world yet");
    return this.walking;
  }

  tick(): void {
    if (this.battle) {
      this.battle.room.tick(this.battle.seat);
      this.tickAfterFight();
      return;
    }
    if (!this.inOverworld) return;
    this.followRegion();
    this.regen();
    this.tickUse();
    progressStory(this);
    if (this.followPile()) this.link.send({ t: "gear", gear: this.gear });
    if (++this.ticks % STATE_EVERY_TICKS === 0) {
      this.link.send({ ...stateMsg(this.overworld, this.me, this.introduced), hp: roundTo(this.vitals.hp, 2) });
    }
  }

  private regen(): void {
    const { stats } = this, max = maxHpOf(stats), { hp } = this.vitals;
    if (hp > 0 && hp < max) this.vitals = { ...this.vitals, hp: Math.min(max, hp + hpRegenPerSec(stats) * FIXED_DT) };
  }

  private updatePace(): void {
    if (this.walking) this.overworld.playerData(this.me).pace = overworldPace(this.held, this.stats);
  }

  private tickAfterFight(): void {
    const battle = this.afterFight;
    if (!battle) return;
    if (Date.now() >= (battle.drops.closesAtMs ?? Infinity)) {
      this.leaveBattle();
      this.link.send({ t: "arenaClosed" });
      return;
    }
    this.regen();
    this.tickUse();
    progressStory(this);
    if (this.followPile()) this.link.send({ t: "gear", gear: this.gear });
    const piles = arenaPiles(battle.drops, this.overworld);
    if (piles === battle.shownDrops) return;
    battle.shownDrops = piles;
    this.link.send({ t: "arenaDrops", piles: piles.map(({ pile, at }) => ({ id: pile, ...at })) });
  }

  private tickUse(): void {
    if (!this.using) return;
    const using = stepUse(this.using);
    this.using = using.stepsLeft > 0 ? using : null;
    if (this.using) return;
    const target = this.useTarget();
    const grid = finishUse(using, this.gear[using.at.in], target);
    if (!grid) {
      this.link.send({ t: "using", at: null });
      return;
    }
    this.gear = { ...this.gear, [using.at.in]: grid };
    this.vitals = { hp: target.hp, stamina: target.stamina };
    if (target.core !== this.core) this.takeCore(target.core, target.core.steps > this.core.steps);
    const battle = this.afterFight;
    // In the arena after a win the fight follows, so its HUD shows it.
    battle?.room.edit(battle.seat, (world, me) => {
      takeCore(world, me, this.core);
      world.require(me, Health).hp = this.vitals.hp;
      world.require(me, Stamina).value = this.vitals.stamina;
    });
    this.save();
    this.link.send({ t: "itemUsed", item: using.item, vitals: this.vitals, gear: this.gear });
  }

  private useTarget() {
    const { stats } = this;
    return { ...this.vitals, max: maxHpOf(stats), staminaMax: staminaMaxOf(stats), core: this.core };
  }

  /** True if the open pile changed under them (others took from it, or it vanished). */
  private followPile(): boolean {
    const items = this.pileOpen === null ? null : this.overworld.pileItems(this.pileOpen);
    if (items === null) this.pileOpen = null;
    const pile = items ?? NO_PILE;
    if (pile === this.gear.pile) return false;
    this.gear = { ...this.gear, pile };
    return true;
  }

  /** Within SAVE_SOON_MS, or on disconnect, whichever is first. */
  saveSoon(): void {
    this.saveTimer ??= setTimeout(() => this.save(), SAVE_SOON_MS);
  }

  private enterWorld(): void {
    if (!this.character || this.walking) return;
    const { pad } = this, overworld = this.overworldOf();
    const me = overworld.join(
      this.character, pad, (source, enemy, spawn) => startBattle(this, source, enemy, spawn), getRegion(pad).spawn,
    );
    this.walking = { overworld, me };
    this.regionId = this.region;
    this.introduced.clear();
    this.gear = this.held;
    const world = { ...overworld.map.layout, ...placeFor(this), pads: overworld.pads };
    this.link.send({ t: "world", world, me: overworld.playerPos(me) });
  }

  private followRegion(): void {
    const { region } = this;
    if (region === this.regionId) return;
    this.regionId = region;
    const was = JSON.stringify(this.placed), placed = placeFor(this);
    if (JSON.stringify(this.placed) !== was) this.link.send({ t: "npcs", ...placed });
  }
}
